import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing ${name}. Add it to backend/.env.local (and to Vercel for deploys).`);
  return value;
}

/** The Supabase–Vercel integration names these with a NEXT_PUBLIC_ prefix; either name works. */
export const supabaseUrl = () => process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
export const supabasePublishableKey = () => process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl() && supabasePublishableKey());
}

/** Read-only client. Row-level security allows reads only. */
export function publicClient(): SupabaseClient {
  return createClient(
    required("SUPABASE_URL", supabaseUrl()),
    required("SUPABASE_PUBLISHABLE_KEY", supabasePublishableKey()),
    { auth: { persistSession: false } },
  );
}

/** Bypasses row-level security. */
export function adminClient(): SupabaseClient {
  return createClient(
    required("SUPABASE_URL", supabaseUrl()),
    required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY),
    { auth: { persistSession: false } },
  );
}
