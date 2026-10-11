import { userClient } from "@/backend/lib/auth";
import { isSupabaseConfigured } from "@/backend/lib/supabase";

/** Signs out from the dashboard. */
export async function DELETE() {
  if (isSupabaseConfigured()) await (await userClient()).auth.signOut();
  return Response.json({ ok: true });
}
