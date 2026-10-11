import { createClient } from "@supabase/supabase-js";
import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import { answerPlayerQuestion, generateTrainingPlan, loadPlayerContext, planAsText } from "../../lib/coach-ai";
import { getExercises, getLatestPlan, getLiveSession, getProgress } from "../../lib/data";
import type { ChatMessage, CourtPosition, LiveRotationRow, TrainingPlan } from "../../../lib/types";
import { COURT_LABELS } from "../../../lib/volleyball";

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. Add it to backend/.env.local.`);
    process.exit(1);
  }
  return value;
}

const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SECRET_KEY"), { auth: { persistSession: false } });
const app = await Spectrum({
  projectId: env("SPECTRUM_PROJECT_ID"),
  projectSecret: env("SPECTRUM_PROJECT_SECRET"),
  providers: [imessage.config()],
});
const im = imessage(app);

const REMINDER_HOUR = Number.parseInt(process.env.REMINDER_HOUR ?? "17", 10);
const HELP =
  "SPIKE commands:\nROTATION: your spot on the court\nPLAN: your training plan\nDRILLS: drills you haven't finished\nASK + a question: ask the SPIKE coaching assistant\nSTOP: turn off texts\nAnything else goes to your coach in SPIKE chat.";

interface Contact {
  player_id: string;
  phone: string;
  texts_opt_in: boolean;
  last_reminder_at: string | null;
  players: { name: string; team_id: string } | null;
}

async function contactByPhone(phone: string): Promise<Contact | null> {
  const { data } = await db.from("player_contacts").select("*, players(name, team_id)").eq("phone", phone).maybeSingle();
  return data as Contact | null;
}

async function optedInContacts(playerIds?: string[]): Promise<Contact[]> {
  let query = db.from("player_contacts").select("*, players(name, team_id)").eq("texts_opt_in", true);
  if (playerIds) query = query.in("player_id", playerIds);
  const { data, error } = await query;
  if (error) console.error("Could not load contacts:", error.message);
  return (data ?? []) as Contact[];
}

async function textPhone(phone: string, body: string) {
  try {
    const space = await im.space.create(phone);
    await space.send(body);
  } catch (e) {
    console.error(`Could not text ${phone}:`, e instanceof Error ? e.message : e);
  }
}

async function rotationText(contact: Contact): Promise<string> {
  const teamId = contact.players?.team_id;
  if (!teamId) return "You're not on a team yet.";
  const { rows } = await getLiveSession(db, teamId);
  const mine = rows.find((r) => r.player_id === contact.player_id);
  const rotation = rows[0]?.rotation_number;
  if (!rotation) return "Your coach hasn't sent a rotation yet.";
  if (!mine) return `Rotation ${rotation}: you're off the court right now.`;
  const pos = mine.court_position as CourtPosition;
  return `Rotation ${rotation}: you're in position ${pos}, ${COURT_LABELS[pos].toLowerCase()}.`;
}

async function planText(contact: Contact): Promise<string> {
  const name = contact.players?.name ?? "Player";
  const exercises = await getExercises(db);
  const latest = await getLatestPlan(db, contact.player_id);
  if (latest) return planAsText(latest.plan, exercises, name);

  const ctx = await loadPlayerContext(db, contact.player_id);
  if (!ctx) return "I couldn't find your ratings yet, so I can't build a plan. Ask your coach.";
  const { plan } = await generateTrainingPlan(ctx);
  // texted_at is set so the insert listener doesn't send it a second time.
  await db.from("training_plans").insert({ player_id: contact.player_id, focus_skill: plan.focus_skill, plan, texted_at: new Date().toISOString() });
  return planAsText(plan, exercises, name);
}

async function drillsText(contact: Contact): Promise<string | null> {
  const [progress, exercises] = await Promise.all([getProgress(db, contact.player_id), getExercises(db)]);
  const names = new Map(exercises.map((e) => [e.exercise_id, e.name]));
  const open = progress.filter((p) => !p.completed);
  if (open.length === 0) return null;
  const lines = open.map((p) => `- ${names.get(p.exercise_id) ?? p.exercise_id} (score ${p.progress_score})`);
  return [`${contact.players?.name ?? "Hey"}, you have ${open.length} drill${open.length === 1 ? "" : "s"} to finish:`, ...lines].join("\n");
}

/** A text reply lands in the player's private chat with the coaches. */
async function postToCoachChat(contact: Contact, body: string) {
  const teamId = contact.players?.team_id;
  if (!teamId) throw new Error(`Player ${contact.player_id} has no team.`);
  const { data: profile } = await db.from("profiles").select("user_id").eq("player_id", contact.player_id).maybeSingle();
  const { error } = await db.from("messages").insert({
    team_id: teamId,
    thread_player_id: contact.player_id,
    sender_user_id: (profile as { user_id: string } | null)?.user_id ?? null,
    sender_name: contact.players?.name ?? contact.player_id,
    sender_role: "player",
    body: body.slice(0, 2000),
    via: "imessage",
    texted_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

const DAILY_AI_ANSWERS = 5;
const aiAnswers = new Map<string, number[]>();

/** Counts an AI answer for the player, or returns false once today's limit is used. */
function takeAiAnswer(playerId: string): boolean {
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const recent = (aiAnswers.get(playerId) ?? []).filter((time) => time > since);
  if (recent.length >= DAILY_AI_ANSWERS) return false;
  aiAnswers.set(playerId, [...recent, Date.now()]);
  return true;
}

/** Questions the saved data already answers, so they don't need Gemini. */
async function fixedAnswer(contact: Contact, question: string): Promise<string | null> {
  if (/\b(rotation|court position|where do i play)\b/i.test(question)) return rotationText(contact);
  if (/\b(training plan|workout plan|my plan)\b/i.test(question)) return planText(contact);
  if (/\bdrills?\b/i.test(question)) return (await drillsText(contact)) ?? "You've finished every assigned drill.";
  return null;
}

// Incoming texts: commands first, ASK goes to the coaching assistant, everything else to the coach chat.
async function handleInbound() {
  for await (const [space, message] of im.messages) {
    if (message.direction !== "inbound" || message.content.type !== "text") continue;
    const from = message.sender?.id;
    if (!from) continue;
    const textBody = message.content.text.trim();
    const command = textBody.toUpperCase();

    try {
      const contact = await contactByPhone(from);
      if (!contact) {
        await space.send("This number isn't linked to a SPIKE player yet. Ask your coach to add you.");
        continue;
      }

      if (command === "STOP") {
        await db.from("player_contacts").update({ texts_opt_in: false, updated_at: new Date().toISOString() }).eq("player_id", contact.player_id);
        await space.send("You won't get SPIKE texts anymore. Text START to turn them back on.");
        continue;
      }
      if (command === "START") {
        await db.from("player_contacts").update({ texts_opt_in: true, updated_at: new Date().toISOString() }).eq("player_id", contact.player_id);
        await space.send(`Texts are on. ${HELP}`);
        continue;
      }
      if (!contact.texts_opt_in) {
        await space.send("SPIKE texts are off for you. Text START to turn them on.");
        continue;
      }

      if (command === "HELP" || command === "?") await space.send(HELP);
      else if (command === "ROTATION") await space.send(await rotationText(contact));
      else if (command === "PLAN") await space.send(await planText(contact));
      else if (command === "DRILLS") await space.send((await drillsText(contact)) ?? "You've finished every assigned drill.");
      else if (command === "ASK" || command.startsWith("ASK ")) {
        const question = textBody.slice(3).trim();
        if (!question) {
          await space.send("Text ASK and then your question, like: ASK how do I pass a float serve?");
          continue;
        }
        const fixed = await fixedAnswer(contact, question);
        if (fixed) {
          await space.send(fixed);
          continue;
        }
        if (!takeAiAnswer(contact.player_id)) {
          await space.send(`You've used today's ${DAILY_AI_ANSWERS} coaching assistant answers. Text PLAN, DRILLS, or ROTATION anytime, or message your coach.`);
          continue;
        }
        const ctx = await loadPlayerContext(db, contact.player_id);
        const reply = ctx
          ? await answerPlayerQuestion(ctx, question, await rotationText(contact))
          : "I couldn't find your player data yet. Ask your coach.";
        await space.send(reply);
      } else {
        await postToCoachChat(contact, textBody);
        await space.send("Sent to your coach in SPIKE chat. Text HELP for commands.");
      }
    } catch (e) {
      console.error("Inbound message failed:", e instanceof Error ? e.message : e);
      await space.send("Something went wrong on SPIKE's side. Try again in a minute.");
    }
  }
}

// Rotation changes: one coach push updates six rows, so wait for the batch before texting.
const pendingSessions = new Map<string, NodeJS.Timeout>();
const lastSent = new Map<string, string>();

async function textRotation(sessionId: string) {
  const { data } = await db.from("live_rotation").select("*").eq("session_id", sessionId);
  const rows = (data ?? []) as LiveRotationRow[];
  const contacts = await optedInContacts(rows.map((r) => r.player_id));
  for (const contact of contacts) {
    const row = rows.find((r) => r.player_id === contact.player_id);
    if (!row) continue;
    const key = `${row.rotation_number}:${row.court_position}`;
    if (lastSent.get(`${sessionId}:${contact.player_id}`) === key) continue;
    lastSent.set(`${sessionId}:${contact.player_id}`, key);
    const pos = row.court_position as CourtPosition;
    await textPhone(contact.phone, `SPIKE: Rotation ${row.rotation_number}. You're in position ${pos}, ${COURT_LABELS[pos].toLowerCase()}.`);
  }
}

// Coach posts from the web go out by text: team chat to the whole team, a private chat to that player.
async function textCoachMessage(row: ChatMessage & { texted_at: string | null }) {
  if (row.via !== "web" || row.sender_role !== "coach" || row.texted_at) return;
  const contacts = (await optedInContacts(row.thread_player_id ? [row.thread_player_id] : undefined)).filter(
    (c) => c.players?.team_id === row.team_id,
  );
  const text =
    row.thread_player_id === null
      ? `${row.sender_name} (team chat): ${row.body}`
      : `${row.sender_name}: ${row.body}\nReply here to answer your coach.`;
  for (const contact of contacts) await textPhone(contact.phone, text);
  await db.from("messages").update({ texted_at: new Date().toISOString() }).eq("message_id", row.message_id);
}

db.channel("spike-messaging")
  .on("postgres_changes", { event: "*", schema: "public", table: "live_rotation" }, (payload) => {
    const sessionId = (payload.new as Partial<LiveRotationRow>).session_id;
    if (!sessionId) return;
    clearTimeout(pendingSessions.get(sessionId));
    pendingSessions.set(
      sessionId,
      setTimeout(() => {
        pendingSessions.delete(sessionId);
        void textRotation(sessionId);
      }, 1500),
    );
  })
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "training_plans" }, async (payload) => {
    const row = payload.new as { plan_id: number; player_id: string; plan: TrainingPlan; texted_at: string | null; kind?: string };
    if (row.texted_at || (row.kind ?? "drills") !== "drills") return;
    const [contact] = await optedInContacts([row.player_id]);
    if (!contact) return;
    const exercises = await getExercises(db);
    await textPhone(contact.phone, planAsText(row.plan, exercises, contact.players?.name ?? "Player"));
    await db.from("training_plans").update({ texted_at: new Date().toISOString() }).eq("plan_id", row.plan_id);
  })
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
    textCoachMessage(payload.new as ChatMessage & { texted_at: string | null }).catch((e) =>
      console.error("Could not text a coach message:", e instanceof Error ? e.message : e),
    );
  })
  .subscribe((status) => console.log(`Supabase Realtime: ${status}`));

// Daily drill reminder at REMINDER_HOUR (server local time), at most once per player per day.
async function sendReminders() {
  if (new Date().getHours() !== REMINDER_HOUR) return;
  const cutoff = Date.now() - 20 * 60 * 60 * 1000;
  for (const contact of await optedInContacts()) {
    if (contact.last_reminder_at && Date.parse(contact.last_reminder_at) > cutoff) continue;
    const body = await drillsText(contact);
    if (!body) continue;
    await textPhone(contact.phone, `${body}\nText DRILLS anytime to see this list.`);
    await db.from("player_contacts").update({ last_reminder_at: new Date().toISOString() }).eq("player_id", contact.player_id);
  }
}
setInterval(() => void sendReminders(), 10 * 60 * 1000);
void sendReminders();

console.log("SPIKE messaging is running. Text the line HELP to try it.");
await handleInbound();
