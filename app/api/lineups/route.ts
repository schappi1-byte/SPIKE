import { requireCoach } from "@/backend/lib/auth";
import { loadDashboard } from "@/backend/lib/dashboard";
import { adminClient } from "@/backend/lib/supabase";

const FORMATIONS = new Set(["4-2", "5-1", "6-2"]);

/** Saves a lineup for the coach's team. With an id, updates that lineup. */
export async function POST(request: Request) {
  const coach = await requireCoach();
  if (coach instanceof Response) return coach;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const formation = typeof body?.formation === "string" && FORMATIONS.has(body.formation) ? body.formation : null;
  const rotation = typeof body?.rotation === "number" && Number.isInteger(body.rotation) && body.rotation >= 1 && body.rotation <= 6 ? body.rotation : null;
  const slots = Array.isArray(body?.slots) && body.slots.length === 6 && body.slots.every((slot) => slot === null || typeof slot === "string") ? (body.slots as (string | null)[]) : null;
  const id = typeof body?.id === "string" && /^\d+$/.test(body.id) ? Number(body.id) : null;
  if (!name || name.length > 80 || !formation || !rotation || !slots) {
    return Response.json({ error: "A lineup needs a name, a formation, a rotation from 1 to 6, and six court spots." }, { status: 400 });
  }

  const db = adminClient();
  const chosen = slots.filter((slot): slot is string => slot != null);
  if (chosen.length) {
    const { data } = await db.from("players").select("player_id").eq("team_id", coach.team_id).in("player_id", chosen);
    if ((data ?? []).length !== new Set(chosen).size) return Response.json({ error: "Every player in the lineup must be on your team." }, { status: 400 });
  }

  const row = { team_id: coach.team_id, name, formation, rotation, slots, saved_at: new Date().toISOString() };
  const { data: existing } = id == null ? { data: null } : await db.from("lineups").select("lineup_id").eq("lineup_id", id).eq("team_id", coach.team_id).maybeSingle();
  const { error } = existing ? await db.from("lineups").update(row).eq("lineup_id", id) : await db.from("lineups").insert(row);
  if (error) return Response.json({ error: `The lineup was not saved: ${error.message}` }, { status: 500 });

  return Response.json(await loadDashboard(db, coach));
}

export async function DELETE(request: Request) {
  const coach = await requireCoach();
  if (coach instanceof Response) return coach;

  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^\d+$/.test(id)) return Response.json({ error: "Which lineup? Send its id." }, { status: 400 });

  const db = adminClient();
  const { error } = await db.from("lineups").delete().eq("lineup_id", Number(id)).eq("team_id", coach.team_id);
  if (error) return Response.json({ error: `The lineup was not deleted: ${error.message}` }, { status: 500 });
  return Response.json(await loadDashboard(db, coach));
}
