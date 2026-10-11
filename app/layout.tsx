import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "SPIKE",
  description: "AI-powered volleyball coaching with lineup optimization, personalized training plans, and real-time team rotations.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
