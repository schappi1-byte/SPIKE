import { useState, type ReactNode } from "react";
import { players, type Player } from "./data";

type View = "landing" | "coach" | "select" | "player";

const Icon = ({ name, className = "size-5" }: { name: string; className?: string }) => {
  const paths: Record<string, ReactNode> = {
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /><path d="m15.5 9.5 3.5 2.5-3.5 2.5" /></>,
    back: <><path d="M19 12H5M11 18l-6-6 6-6" /></>,
    chart: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    play: <><circle cx="12" cy="12" r="9" /><path d="m10 8 6 4-6 4Z" /></>,
    team: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    trophy: <><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0Z" /><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" /></>,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
    zap: <path d="M13 2 4 14h7l-1 8 9-12h-7Z" />,
  };
  return <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
};

const Logo = ({ light = false }: { light?: boolean }) => (
  <button className="flex items-center gap-2.5" onClick={() => window.location.reload()} aria-label="Return home">
    <span className="grid size-9 place-items-center rounded-xl bg-brand text-white shadow-lg shadow-blue-500/20"><Icon name="zap" className="size-5 fill-current" /></span>
    <span className={`text-xl font-bold tracking-[0.16em] ${light ? "text-white" : "text-navy"}`}>SPIKE</span>
  </button>
);

const Button = ({ children, onClick, secondary = false, className = "" }: { children: ReactNode; onClick: () => void; secondary?: boolean; className?: string }) => (
  <button onClick={onClick} className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold transition active:scale-[0.98] ${secondary ? "border border-slate-200 bg-white text-navy hover:border-brand hover:text-brand" : "bg-brand text-white shadow-lg shadow-blue-500/20 hover:bg-brand-dark"} ${className}`}>{children}</button>
);

const Avatar = ({ player, large = false }: { player: Player; large?: boolean }) => (
  <span className={`grid shrink-0 place-items-center rounded-full font-bold ${player.color} ${large ? "size-20 text-xl" : "size-11 text-sm"}`}>{player.initials}</span>
);

const Header = ({ onHome, label }: { onHome: () => void; label: string }) => (
  <header className="border-b border-slate-200/80 bg-white">
    <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 lg:px-8">
      <div onClick={onHome}><Logo /></div>
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-slate-500 sm:block">{label}</span>
        <button onClick={onHome} className="rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand hover:text-brand">Exit</button>
      </div>
    </div>
  </header>
);

const StatCard = ({ icon, label, value, note }: { icon: string; label: string; value: string; note: string }) => (
  <div className="card p-5">
    <div className="mb-5 flex items-start justify-between">
      <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-brand"><Icon name={icon} /></span>
      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{note}</span>
    </div>
    <p className="text-2xl font-bold tracking-tight">{value}</p>
    <p className="mt-1 text-sm text-slate-500">{label}</p>
  </div>
);

function Landing({ go }: { go: (view: View) => void }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-navy text-white">
      <div className="absolute -right-32 -top-32 size-[30rem] rounded-full bg-brand/15 blur-3xl" />
      <div className="absolute -bottom-52 -left-28 size-[34rem] rounded-full bg-blue-700/15 blur-3xl" />
      <nav className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8"><Logo light /><span className="text-sm text-slate-400">Player development, elevated.</span></nav>
      <section className="relative mx-auto flex min-h-[calc(100vh-88px)] max-w-5xl flex-col items-center justify-center px-6 pb-20 text-center">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-200"><span className="size-1.5 rounded-full bg-brand" /> Built for better volleyball</div>
        <h1 className="max-w-4xl text-5xl font-bold leading-[1.05] tracking-[-0.04em] sm:text-6xl lg:text-7xl">Smarter Coaching.<br /><span className="text-brand">Stronger Players.</span></h1>
        <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">One focused platform to track progress, sharpen performance, and bring every player closer to their best.</p>
        <div className="mt-10 grid w-full max-w-lg gap-3 sm:grid-cols-2">
          <Button onClick={() => go("coach")} className="py-4">Coach <Icon name="arrow" /></Button>
          <Button onClick={() => go("select")} secondary className="border-white/15 bg-white/5 py-4 text-white hover:border-white/40 hover:text-white">Player <Icon name="arrow" /></Button>
        </div>
        <div className="mt-14 flex items-center gap-6 text-xs font-medium uppercase tracking-widest text-slate-500"><span>Track</span><span className="size-1 rounded-full bg-slate-600" /><span>Develop</span><span className="size-1 rounded-full bg-slate-600" /><span>Perform</span></div>
      </section>
    </main>
  );
}

function CoachDashboard({ onHome }: { onHome: () => void }) {
  return (
    <div className="min-h-screen bg-canvas">
      <Header onHome={onHome} label="Coach workspace" />
      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="mb-2 text-sm font-semibold text-brand">TEAM OVERVIEW</p><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Good afternoon, Coach</h1><p className="mt-2 text-slate-500">Here’s how your team is progressing this week.</p></div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600"><Icon name="clock" /> Next practice · Today, 4:30 PM</div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon="team" label="Active players" value="8" note="Full roster" />
          <StatCard icon="chart" label="Team attendance" value="96%" note="+2.4%" />
          <StatCard icon="target" label="Avg. skill score" value="82.7" note="+5.2%" />
          <StatCard icon="trophy" label="Goals completed" value="18/24" note="75%" />
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.65fr_1fr]">
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-6"><div><h2 className="font-bold">Player roster</h2><p className="mt-1 text-sm text-slate-500">Individual development at a glance</p></div><button className="text-sm font-semibold text-brand">View all</button></div>
            <div className="divide-y divide-slate-100">
              {players.slice(0, 5).map((player) => <div key={player.id} className="flex items-center gap-3 px-5 py-3.5 sm:px-6"><Avatar player={player} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{player.name}</p><p className="text-xs text-slate-500">#{player.number} · {player.position}</p></div><div className="hidden text-right sm:block"><p className="text-sm font-bold">{Math.round((player.serve + player.attack + player.blocks) / 3)}</p><p className="text-xs text-slate-400">skill score</p></div><span className="ml-2 flex items-center text-xs font-semibold text-emerald-600">+{player.trend}%</span><Icon name="chevron" className="size-4 text-slate-300" /></div>)}
            </div>
          </section>
          <section className="card p-6">
            <div className="mb-6"><h2 className="font-bold">Today’s focus</h2><p className="mt-1 text-sm text-slate-500">Practice plan · 90 minutes</p></div>
            {[["Warm-up & movement", "15 min", true], ["Serve receive", "25 min", true], ["Transition offense", "30 min", false], ["Six-on-six scenarios", "20 min", false]].map(([name, time, done], index) => <div className="relative flex gap-3 pb-6 last:pb-0" key={String(name)}>{index < 3 && <span className="absolute left-3 top-7 h-full w-px bg-slate-200" />}<span className={`z-10 grid size-6 shrink-0 place-items-center rounded-full ${done ? "bg-brand text-white" : "border-2 border-slate-200 bg-white text-slate-400"}`}>{done ? <Icon name="check" className="size-3.5" /> : <span className="text-[10px] font-bold">{index + 1}</span>}</span><div className="flex flex-1 justify-between gap-2"><p className="text-sm font-semibold">{name}</p><p className="whitespace-nowrap text-xs text-slate-400">{time}</p></div></div>)}
          </section>
        </div>
      </main>
    </div>
  );
}

function PlayerSelect({ onHome, choose }: { onHome: () => void; choose: (player: Player) => void }) {
  return (
    <div className="min-h-screen bg-canvas">
      <Header onHome={onHome} label="Player portal" />
      <main className="mx-auto max-w-5xl px-5 py-10 lg:px-8">
        <button onClick={onHome} className="mb-8 flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-brand"><Icon name="back" className="size-4" /> Back to home</button>
        <div className="mb-8"><p className="mb-2 text-sm font-semibold text-brand">PLAYER PORTAL</p><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Who’s checking in?</h1><p className="mt-2 text-slate-500">Select your profile to view your dashboard and progress.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          {players.map((player) => <button key={player.id} onClick={() => choose(player)} className="card group flex items-center gap-4 p-4 text-left transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg"><Avatar player={player} /><div className="min-w-0 flex-1"><p className="font-semibold">{player.name}</p><p className="mt-0.5 text-sm text-slate-500">#{player.number} · {player.position}</p></div><Icon name="chevron" className="size-5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand" /></button>)}
        </div>
      </main>
    </div>
  );
}

const SkillBar = ({ label, value }: { label: string; value: number }) => (
  <div><div className="mb-2 flex justify-between text-sm"><span className="font-medium text-slate-600">{label}</span><span className="font-bold">{value}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand" style={{ width: `${value}%` }} /></div></div>
);

function PlayerDashboard({ player, onHome, change }: { player: Player; onHome: () => void; change: () => void }) {
  const score = Math.round((player.serve + player.attack + player.blocks) / 3);
  return (
    <div className="min-h-screen bg-canvas">
      <Header onHome={onHome} label="Player dashboard" />
      <main className="mx-auto max-w-6xl px-5 py-8 lg:px-8">
        <button onClick={change} className="mb-7 flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-brand"><Icon name="back" className="size-4" /> Switch player</button>
        <section className="relative mb-6 overflow-hidden rounded-3xl bg-navy p-6 text-white shadow-xl sm:p-8">
          <div className="absolute -right-16 -top-24 size-64 rounded-full bg-brand/20 blur-2xl" />
          <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-5"><Avatar player={player} large /><div><p className="text-sm font-medium text-blue-200">Welcome back,</p><h1 className="mt-1 text-3xl font-bold">{player.name}</h1><p className="mt-1 text-sm text-slate-400">#{player.number} · {player.position} · {player.grade}</p></div></div>
            <div className="flex gap-7 border-t border-white/10 pt-5 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0"><div><p className="text-3xl font-bold">{score}</p><p className="text-xs text-slate-400">Skill score</p></div><div><p className="text-3xl font-bold text-emerald-400">+{player.trend}%</p><p className="text-xs text-slate-400">This month</p></div></div>
          </div>
        </section>
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="card p-6"><div className="mb-7 flex items-center justify-between"><div><h2 className="font-bold">Skill development</h2><p className="mt-1 text-sm text-slate-500">Your latest coach assessment</p></div><span className="text-xs font-medium text-slate-400">Updated May 24</span></div><div className="space-y-6"><SkillBar label="Serving" value={player.serve} /><SkillBar label="Attacking" value={player.attack} /><SkillBar label="Blocking" value={player.blocks} /></div></section>
          <section className="card p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-bold">Weekly goal</h2><p className="mt-1 text-sm text-slate-500">Assigned by Coach Ellis</p></div><span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-brand"><Icon name="target" /></span></div><h3 className="text-lg font-bold">Serve with consistency</h3><p className="mt-2 text-sm leading-6 text-slate-500">Complete 50 targeted serves with at least 85% landing in zone.</p><div className="mt-6"><div className="mb-2 flex justify-between text-sm"><span className="font-medium">38 of 50 serves</span><span className="font-bold text-brand">76%</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-3/4 rounded-full bg-brand" /></div></div></section>
          <section className="card p-6 lg:col-span-2"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-bold">Recommended for you</h2><p className="mt-1 text-sm text-slate-500">Based on your latest performance</p></div><button className="text-sm font-semibold text-brand">View all</button></div><div className="grid gap-3 sm:grid-cols-3">{[["Platform control", "8 min", "Serve receive"], ["High contact point", "12 min", "Attacking"], ["Read the setter", "10 min", "Blocking"]].map(([title, time, type]) => <button key={title} className="group flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-brand/40"><span className="grid size-11 place-items-center rounded-lg bg-navy text-white group-hover:bg-brand"><Icon name="play" className="size-5" /></span><span><span className="block text-sm font-semibold">{title}</span><span className="mt-0.5 block text-xs text-slate-400">{type} · {time}</span></span></button>)}</div></section>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<View>("landing");
  const [player, setPlayer] = useState(players[0]);
  const home = () => setView("landing");
  if (view === "coach") return <CoachDashboard onHome={home} />;
  if (view === "select") return <PlayerSelect onHome={home} choose={(selected) => { setPlayer(selected); setView("player"); }} />;
  if (view === "player") return <PlayerDashboard player={player} onHome={home} change={() => setView("select")} />;
  return <Landing go={setView} />;
}
