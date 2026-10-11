import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing ${name}. Add it to backend/.env.local (and to Vercel for deploys).`);
  return value;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY);
}

/** Read-only client. Row-level security allows reads only. */
export function publicClient(): SupabaseClient {
  return createClient(
    required("SUPABASE_URL", process.env.SUPABASE_URL),
    required("SUPABASE_PUBLISHABLE_KEY", process.env.SUPABASE_PUBLISHABLE_KEY),
    { auth: { persistSession: false } },
  );
}

/** Bypasses row-level security. */
export function adminClient(): SupabaseClient {
  return createClient(
    required("SUPABASE_URL", process.env.SUPABASE_URL),
    required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY),
    { auth: { persistSession: false } },
  );
}
