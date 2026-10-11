import "server-only";
import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Account } from "../../lib/types";
import { AUTH_COOKIE_OPTIONS } from "./auth-cookies";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "./supabase";

const PROFILE_COLUMNS = "user_id, username, team_id, role, player_id, display_name";

/** Hidden login email for a username. Players use their player_id; coaches use `coach-<name>`. */
export function emailFor(username: string): string {
  return `${username}@spike.local`;
}

export function isValidUsername(username: string): boolean {
  return /^[a-z0-9-]{1,80}$/.test(username);
}

/** Constant-time comparison for sign-up codes. */
export function matchesSecret(given: string, expected: string | undefined): boolean {
  if (!expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Supabase client acting as the signed-in user, so row-level security applies. */
export async function userClient(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(supabaseUrl() ?? "", supabasePublishableKey() ?? "", {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll: () => store.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) store.set(name, value, options);
        } catch {
          // Server Components can't set cookies. proxy.ts refreshes the session before they render.
        }
      },
    },
  });
}

/** The signed-in account, or null. */
export const getAccount = cache(async (): Promise<Account | null> => {
  if (!isSupabaseConfigured()) return null;
  const db = await userClient();
  const { data } = await db.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return null;
  const { data: profile } = await db.from("profiles").select(PROFILE_COLUMNS).eq("user_id", userId).maybeSingle();
  return (profile as Account | null) ?? null;
});

/** For coach-only pages: anyone else goes back to their own dashboard (or the login screen). */
export async function coachPage(): Promise<Account> {
  const account = await getAccount();
  if (account?.role !== "coach") redirect("/");
  return account;
}

/** The signed-in coach, or an error response to return. */
export async function requireCoach(): Promise<Account | Response> {
  if (!isSupabaseConfigured()) return Response.json({ error: "Supabase keys are not set on the server." }, { status: 503 });
  const account = await getAccount();
  if (!account) return Response.json({ error: "Log in as a coach first." }, { status: 401 });
  if (account.role !== "coach") return Response.json({ error: "Only coaches can do this." }, { status: 403 });
  return account;
}
