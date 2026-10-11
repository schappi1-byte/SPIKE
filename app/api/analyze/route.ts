import { analyzePlayer } from "@/frontend/server/gemini";
import { dashboardAccount, geminiOptions, geminiPayload, latestEvaluationId, loadAthleteFor } from "@/backend/lib/dashboard";
import { adminClient } from "@/backend/lib/supabase";

/** Gemini analysis of a player's saved evaluations. Saved on the evaluation it was based on. */
export async function POST(request: Request) {
  const account = await dashboardAccount();
  if (account instanceof Response) return account;

  const body = (await request.json().catch(() => null)) as { playerId?: unknown } | null;
  const playerId = typeof body?.playerId === "string" ? body.playerId : null;
  if (!playerId) return Response.json({ error: "playerId is required." }, { status: 400 });

  const db = adminClient();
  const found = await loadAthleteFor(db, account, playerId);
  if (!found) return Response.json({ error: "You can only analyze your own profile, or players on your team as a coach." }, { status: 403 });

  const result = await analyzePlayer(geminiPayload(found.athlete), geminiOptions());
  if (!("analysis" in result.body)) return Response.json(result.body, { status: result.status });

  try {
    const evaluationId = await latestEvaluationId(db, found.athlete);
    const generatedAt = new Date().toISOString();
    const { data, error } = await db
      .from("evaluations")
      .update({ analysis: result.body.analysis, analysis_at: generatedAt })
      .eq("evaluation_id", evaluationId)
      .select("recorded_at")
      .single<{ recorded_at: string }>();
    if (error || !data) throw new Error(error?.message ?? "Could not save the analysis.");
    return Response.json({
      analysis: { athleteId: found.athlete.id, sourceRecordedAt: data.recorded_at, generatedAt, analysis: result.body.analysis },
    });
  } catch (error) {
    return Response.json({ error: `The analysis was created but not saved: ${error instanceof Error ? error.message : "unknown error"}` }, { status: 500 });
  }
}
