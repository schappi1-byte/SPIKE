import { coachResults, dashboardAccount, loadAthleteFor } from "@/backend/lib/dashboard";
import { adminClient } from "@/backend/lib/supabase";

/** Gemini analysis of a player's latest evaluation, reused until a newer evaluation is saved. */
export async function POST(request: Request) {
  const account = await dashboardAccount();
  if (account instanceof Response) return account;

  const body = (await request.json().catch(() => null)) as { playerId?: unknown } | null;
  const playerId = typeof body?.playerId === "string" ? body.playerId : null;
  if (!playerId) return Response.json({ error: "playerId is required." }, { status: 400 });

  const db = adminClient();
  const found = await loadAthleteFor(db, account, playerId);
  if (!found) return Response.json({ error: "You can only analyze your own profile, or players on your team as a coach." }, { status: 403 });

  const result = await coachResults(db, found, "analysis");
  if (result instanceof Response) return result;
  return Response.json({ analysis: result.analysis });
}
