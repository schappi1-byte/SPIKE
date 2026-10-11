import { getAccount, userClient } from "@/backend/lib/auth";
import { getMessages } from "@/backend/lib/data";
import type { Account } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_LENGTH = 2000;

/** "team" is the team chat; anything else is a player id for that player's private chat with the coaches. */
function parseThread(value: unknown, account: Account): { thread: string | null } | { error: Response } {
  if (value === "team") return { thread: null };
  if (typeof value !== "string" || !value) return { error: Response.json({ error: "thread is required." }, { status: 400 }) };
  if (account.role === "player" && value !== account.player_id) {
    return { error: Response.json({ error: "You can only read your own chat with the coach." }, { status: 403 }) };
  }
  return { thread: value };
}

export async function GET(request: Request) {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Log in to read messages." }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const parsed = parseThread(params.get("thread"), account);
  if ("error" in parsed) return parsed.error;
  const after = Number.parseInt(params.get("after") ?? "0", 10);

  try {
    const messages = await getMessages(await userClient(), account.team_id, parsed.thread, Number.isFinite(after) ? after : 0);
    return Response.json({ messages }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Could not load messages." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Log in to send messages." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { thread?: unknown; body?: unknown } | null;
  const parsed = parseThread(body?.thread, account);
  if ("error" in parsed) return parsed.error;
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (!text) return Response.json({ error: "Type a message first." }, { status: 400 });
  if (text.length > MAX_LENGTH) return Response.json({ error: `Messages can be up to ${MAX_LENGTH} characters.` }, { status: 400 });

  // Inserted as the signed-in user, so row-level security decides whether this chat is theirs.
  const db = await userClient();
  const { data, error } = await db
    .from("messages")
    .insert({
      team_id: account.team_id,
      thread_player_id: parsed.thread,
      sender_user_id: account.user_id,
      sender_name: account.display_name,
      sender_role: account.role,
      body: text,
    })
    .select("message_id, team_id, thread_player_id, sender_user_id, sender_name, sender_role, body, via, created_at")
    .single();
  if (error) return Response.json({ error: error.message }, { status: error.code === "42501" ? 403 : 500 });
  return Response.json({ message: data });
}
