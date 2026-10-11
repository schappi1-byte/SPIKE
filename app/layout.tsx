import type { Metadata } from "next";
import Link from "next/link";
import { getAccount } from "@/backend/lib/auth";
import { logOut } from "./auth-actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "SPIKE",
  description: "AI-powered volleyball coaching with lineup optimization, personalized training plans, and real-time team rotations.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccount();

  return (
    <html lang="en">
      <body>
        <header className="site">
          <Link href="/" className="brand">
            SPIKE
          </Link>
          <nav>
            <Link href="/">Roster</Link>
            <Link href="/lineup">Lineup</Link>
            <Link href="/live">Live court</Link>
            <Link href="/insights">Insights</Link>
            {account ? <Link href="/chat">Chat</Link> : null}
          </nav>
          <div className="account">
            {account ? (
              <>
                <span>
                  {account.display_name} <span className="pill">{account.role === "coach" ? "Coach" : "Player"}</span>
                </span>
                <form action={logOut}>
                  <button type="submit" className="link">
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
        <main>{children}</main>
      </body>
    </html>
  );
}
