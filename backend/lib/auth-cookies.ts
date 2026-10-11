import type { CookieOptionsWithName } from "@supabase/ssr";

/** Session cookies are httpOnly: the browser never talks to Supabase, so page scripts don't need the token. */
export const AUTH_COOKIE_OPTIONS: CookieOptionsWithName = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
