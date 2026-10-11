"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logOut } from "@/app/auth-actions";
import { Wordmark } from "./Wordmark";

const FULL_SCREEN = ["/login", "/signup"];

export function SiteChrome({ account, children }: { account: { name: string; role: "coach" | "player" } | null; children: React.ReactNode }) {
  if (FULL_SCREEN.includes(usePathname())) return <>{children}</>;
  return (
    <>
      <header className="site">
        <div className="brand">
          <Wordmark />
          {account ? <span className="pill">{account.role === "coach" ? "Coach" : "Player"}</span> : null}
        </div>
        <div className="account">
          {account ? (
            <>
              <span className="who">{account.name}</span>
              <form action={logOut}>
                <button type="submit" className="secondary small">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login">Log in</Link>
              <Link href="/signup" className="button small">
                Sign up
              </Link>
            </>
          )}
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
