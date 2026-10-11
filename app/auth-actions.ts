"use server";

import { redirect } from "next/navigation";
import { emailFor, isValidUsername, matchesSecret, userClient } from "@/backend/lib/auth";
import { getTeams } from "@/backend/lib/data";
import { adminClient, isSupabaseConfigured } from "@/backend/lib/supabase";

export interface FormState {
  error: string | null;
  /** What the person typed, minus passcodes, so the form can refill itself after an error. */
  values?: Record<string, string>;
  /** Changes on every failed attempt. React clears a form after its action runs, so the form is re-keyed with this to show `values` again. */
  attempt?: string;
}

const MIN_PASSCODE = 6;
const MAX_PASSCODE = 72;

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/** Only same-site paths, so a crafted link can't send someone to another site after logging in. */
function safeNext(value: string): string {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function logIn(_prev: FormState, form: FormData): Promise<FormState> {
  const state = await tryLogIn(form);
  return state.error ? { ...state, values: { username: field(form, "username") }, attempt: crypto.randomUUID() } : state;
}

async function tryLogIn(form: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return { error: "Supabase keys are not set on the server." };
  const username = field(form, "username");
  const passcode = field(form, "passcode");
  if (!isValidUsername(username) || !passcode) return { error: "Pick your name and enter your passcode." };

  const db = await userClient();
  const { error } = await db.auth.signInWithPassword({ email: emailFor(username), password: passcode });
  if (error) {
    return { error: error.status === 429 ? "Too many tries. Wait a minute, then try again." : "That passcode doesn't match." };
  }
  redirect(safeNext(field(form, "next")));
}

export async function signUp(_prev: FormState, form: FormData): Promise<FormState> {
  const state = await trySignUp(form);
  const isCoach = field(form, "role") === "coach";
  const values = { code: isCoach ? "" : field(form, "code"), player_id: field(form, "player_id"), name: field(form, "name") };
  return state.error ? { ...state, values, attempt: crypto.randomUUID() } : state;
}

async function trySignUp(form: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return { error: "Supabase keys are not set on the server." };
  const role = field(form, "role") === "coach" ? "coach" : "player";
  const code = field(form, "code");
  const passcode = field(form, "passcode");

  if (passcode.length < MIN_PASSCODE || passcode.length > MAX_PASSCODE) {
    return { error: `Your passcode needs ${MIN_PASSCODE} to ${MAX_PASSCODE} characters.` };
  }
  if (passcode !== field(form, "confirm")) return { error: "The two passcodes don't match." };

  const admin = adminClient();
  const [team] = await getTeams(admin);
  if (!team) return { error: "No team is loaded yet. Run npm run db:seed." };

  let username: string;
  let displayName: string;
  let playerId: string | null = null;

  if (role === "player") {
    if (!process.env.TEAM_JOIN_CODE) return { error: "TEAM_JOIN_CODE is not set on the server." };
    if (!matchesSecret(code.trim(), process.env.TEAM_JOIN_CODE)) return { error: "That team join code is wrong. Ask your coach for it." };
    const { data: player } = await admin
      .from("players")
      .select("player_id, name, team_id")
      .eq("player_id", field(form, "player_id"))
      .maybeSingle<{ player_id: string; name: string; team_id: string }>();
    if (!player || player.team_id !== team.team_id) return { error: "Pick your name from the roster." };
    username = player.player_id;
    displayName = player.name;
    playerId = player.player_id;
  } else {
    if (!process.env.COACH_PASSCODE) return { error: "COACH_PASSCODE is not set on the server." };
    if (!matchesSecret(code.trim(), process.env.COACH_PASSCODE)) return { error: "That coach code is wrong." };
    displayName = field(form, "name").trim().replace(/\s+/g, " ");
    const slug = displayName
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (displayName.length < 2 || displayName.length > 60 || !slug) return { error: "Enter your name, 2 to 60 characters." };
    username = `coach-${slug}`;
  }

  const { data: taken } = await admin.from("profiles").select("user_id").eq("username", username).maybeSingle();
  if (taken) {
    return {
      error: role === "player" ? "Someone already signed up as this player. Log in instead." : "A coach with that name already has an account. Log in instead.",
    };
  }

  const email = emailFor(username);
  let created = await admin.auth.admin.createUser({ email, password: passcode, email_confirm: true });
  if (created.error?.code === "email_exists") {
    // A login left behind when its profile was removed (for example, a player dropped from the roster and re-added).
    await deleteOrphanedLogin(email);
    created = await admin.auth.admin.createUser({ email, password: passcode, email_confirm: true });
  }
  const user = created.data.user;
  if (created.error || !user) return { error: created.error?.message ?? "Could not create the account." };

  const { error: profileError } = await admin
    .from("profiles")
    .insert({ user_id: user.id, username, team_id: team.team_id, role, player_id: playerId, display_name: displayName });
  if (profileError) {
    await admin.auth.admin.deleteUser(user.id);
    return { error: "Someone just signed up with that name. Log in instead." };
  }

  const db = await userClient();
  const { error: signInError } = await db.auth.signInWithPassword({ email, password: passcode });
  if (signInError) return { error: "Your account is ready. Log in to continue." };
  redirect("/");
}

async function deleteOrphanedLogin(email: string) {
  const admin = adminClient();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return;
    const user = data.users.find((u) => u.email === email);
    if (user) {
      const { data: profile } = await admin.from("profiles").select("user_id").eq("user_id", user.id).maybeSingle();
      if (!profile) await admin.auth.admin.deleteUser(user.id);
      return;
    }
    if (data.users.length < 200) return;
  }
}

export async function logOut() {
  if (isSupabaseConfigured()) await (await userClient()).auth.signOut();
  redirect("/");
}
