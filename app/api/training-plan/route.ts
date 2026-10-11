import { generateTrainingPlan, loadPlayerContext } from "@/backend/lib/coach-ai";
import { requireCoach } from "@/backend/lib/coach-auth";
import { adminClient } from "@/backend/lib/supabase";

export async function POST(request: Request) {
  const denied = requireCoach(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as { player_id?: unknown } | null;
  const playerId = typeof body?.player_id === "string" ? body.player_id : null;
  if (!playerId) return Response.json({ error: "player_id is required." }, { status: 400 });

  const db = adminClient();
  const ctx = await loadPlayerContext(db, playerId);
  if (!ctx) return Response.json({ error: "Player not found, has no skill ratings, or no exercises are loaded." }, { status: 404 });

  const { plan, source } = await generateTrainingPlan(ctx);
  const { data, error } = await db
    .from("training_plans")
    .insert({ player_id: playerId, focus_skill: plan.focus_skill, plan })
    .select("plan_id, created_at")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ plan, source, plan_id: data.plan_id, created_at: data.created_at });
}
