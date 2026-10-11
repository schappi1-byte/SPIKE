import Link from "next/link";
import { redirect } from "next/navigation";
import { SetupNotice } from "@/components/SetupNotice";
import { getAccount } from "@/backend/lib/auth";
import { adminClient, isSupabaseConfigured } from "@/backend/lib/supabase";
import type { Role } from "@/lib/types";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const { next = "/chat" } = await searchParams;
  if (await getAccount()) redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/chat");

  // Names only. The list is what people pick from instead of typing a username.
  const { data } = await adminClient().from("profiles").select("username, display_name, role").order("display_name");
  const accounts = (data ?? []) as { username: string; display_name: string; role: Role }[];

  return (
    <div className="auth-card">
      <h1>Log in</h1>
      <p className="muted">Pick your name and enter your passcode.</p>
      {accounts.length === 0 ? (
        <p className="panel">
          Nobody has signed up yet. <Link href="/signup">Sign up</Link> first.
        </p>
      ) : (
        <LoginForm accounts={accounts} next={next} />
      )}
      <p className="muted">
        New here? <Link href="/signup">Sign up</Link>
      </p>
    </div>
  );
}
