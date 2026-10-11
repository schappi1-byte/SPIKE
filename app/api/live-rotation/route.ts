import { requireCoach } from "@/backend/lib/auth";
import { getLiveSession, getRoster } from "@/backend/lib/data";
import { adminClient, isSupabaseConfigured, publicClient } from "@/backend/lib/supabase";
import { courtSlots, optimizeFourTwo } from "@/lib/volleyball";

export const dynamic = "force-dynamic";

/** Current live court for a team. The live page polls this so the browser never needs a Supabase key. */
export async function GET(request: Request) {
  const teamId = new URL(request.url).searchParams.get("team_id");
  if (!teamId) return Response.json({ error: "team_id is required." }, { status: 400 });
  if (!isSupabaseConfigured()) return Response.json({ error: "Supabase keys are not set on the server." }, { status: 503 });
  const session = await getLiveSession(publicClient(), teamId);
  return Response.json(session, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const coach = await requireCoach();
  if (coach instanceof Response) return coach;

  const body = (await request.json().catch(() => null)) as { team_id?: unknown; rotation_number?: unknown } | null;
  const teamId = typeof body?.team_id === "string" ? body.team_id : null;
  const rotationNumber = typeof body?.rotation_number === "number" ? body.rotation_number : NaN;
  if (!teamId || !Number.isInteger(rotationNumber) || rotationNumber < 1 || rotationNumber > 6) {
    return Response.json({ error: "team_id and a rotation_number from 1 to 6 are required." }, { status: 400 });
  }
  if (teamId !== coach.team_id) return Response.json({ error: "You can only change your own team's court." }, { status: 403 });

  const db = adminClient();
  const roster = await getRoster(db, teamId);
  if (roster.length === 0) return Response.json({ error: "Team not found." }, { status: 404 });

  // The lineup is computed here so a request can't place arbitrary players on the court.
  const plan = optimizeFourTwo(roster);
  const { sessionId } = await getLiveSession(db, teamId);
  const updatedAt = new Date().toISOString();
  const rows = courtSlots(plan, rotationNumber).map((slot) => ({
    session_id: sessionId,
    team_id: teamId,
    rotation_number: rotationNumber,
    player_id: slot.onCourtPlayerId,
    court_position: slot.courtPosition,
    updated_at: updatedAt,
    update_status: "synced",
  }));

  const { error } = await db.from("live_rotation").upsert(rows, { onConflict: "session_id,court_position" });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ session_id: sessionId, rotation_number: rotationNumber, rows });
}
