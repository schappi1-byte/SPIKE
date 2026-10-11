import Link from "next/link";
import { redirect } from "next/navigation";
import { SetupNotice } from "@/components/SetupNotice";
import { getAccount, userClient } from "@/backend/lib/auth";
import { getMessages, getRoster } from "@/backend/lib/data";
import { adminClient, isSupabaseConfigured } from "@/backend/lib/supabase";
import { ChatRoom } from "./ChatRoom";

export const dynamic = "force-dynamic";

interface Thread {
  key: string;
  title: string;
  subtitle: string;
}

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ thread?: string }> }) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const account = await getAccount();
  if (!account) redirect("/login?next=/chat");

  const roster = await getRoster(adminClient(), account.team_id);
  const isCoach = account.role === "coach";

  const team: Thread = { key: "team", title: "Team chat", subtitle: "Everyone on the team" };
  let privateThreads: Thread[];
  if (isCoach) {
    // Linked phones get coach messages by text, so the coach can see who will.
    const { data: phones } = await adminClient().from("player_contacts").select("player_id").eq("texts_opt_in", true);
    const texted = new Set((phones ?? []).map((r: { player_id: string }) => r.player_id));
    privateThreads = roster.map((p) => ({
      key: p.player_id,
      title: p.name,
      subtitle: texted.has(p.player_id) ? "Private · also gets your messages by text" : "Private",
    }));
  } else {
    privateThreads = account.player_id ? [{ key: account.player_id, title: "Coach", subtitle: "Private chat with your coaches" }] : [];
  }

  const { thread: requested = privateThreads.length && !isCoach ? privateThreads[0]!.key : "team" } = await searchParams;
  const current = [team, ...privateThreads].find((t) => t.key === requested) ?? team;
  const initial = await getMessages(await userClient(), account.team_id, current.key === "team" ? null : current.key);

  return (
    <>
      <a href="/" className="back">
        ← Back to dashboard
      </a>
      <h1>Chat</h1>
      <p className="muted">
        {isCoach
          ? "Message the whole team or one player. Players with texts turned on get your messages by iMessage and can reply by text."
          : "Message your team or your coaches. If your phone is linked, coach messages also come by text, and you can reply by text."}
      </p>
      <div className="chat" style={{ marginTop: 16 }}>
        <nav className="panel threads" aria-label="Chats">
          <Link href="/chat?thread=team" className={current.key === "team" ? "active" : ""}>
            Team chat
          </Link>
          {privateThreads.length > 0 ? <div className="heading">{isCoach ? "Players" : "Private"}</div> : null}
          {privateThreads.map((t) => (
            <Link key={t.key} href={`/chat?thread=${encodeURIComponent(t.key)}`} className={current.key === t.key ? "active" : ""}>
              {t.title}
            </Link>
          ))}
        </nav>
        <ChatRoom key={current.key} thread={current.key} title={current.title} subtitle={current.subtitle} me={account.user_id} initialMessages={initial} />
      </div>
    </>
  );
}
