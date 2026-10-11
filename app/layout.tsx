import type { Metadata } from "next";
import { SiteChrome } from "@/components/SiteChrome";
import { getAccount } from "@/backend/lib/auth";
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
        <SiteChrome account={account ? { name: account.display_name, role: account.role } : null}>{children}</SiteChrome>
      </body>
    </html>
  );
}
