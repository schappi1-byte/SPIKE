import { dashboardAccount, loadDashboard } from "@/backend/lib/dashboard";
import { adminClient } from "@/backend/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await dashboardAccount();
  if (account instanceof Response) return account;
  try {
    return Response.json(await loadDashboard(adminClient(), account));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load the dashboard." }, { status: 500 });
  }
}
