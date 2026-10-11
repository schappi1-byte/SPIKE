import type { ReactNode } from "react";
import { Icon, Logo } from "./ui";

function Button({ children, onClick, secondary = false, className = "" }: { children: ReactNode; onClick: () => void; secondary?: boolean; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold transition active:scale-[0.98] ${secondary ? "border border-white/15 bg-white/5 text-white hover:border-white/40" : "bg-brand text-white shadow-lg shadow-blue-500/20 hover:bg-brand-dark"} ${className}`}>
      {children}
    </button>
  );
}

export default function Landing({ onCoach, onPlayer }: { onCoach: () => void; onPlayer: () => void }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-navy text-white">
      <div className="absolute -right-32 -top-32 size-[30rem] rounded-full bg-brand/15 blur-3xl" />
      <div className="absolute -bottom-52 -left-28 size-[34rem] rounded-full bg-blue-700/15 blur-3xl" />
      <nav className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
        <Logo light />
        <span className="text-sm text-slate-400">Player development, elevated.</span>
      </nav>
      <section className="relative mx-auto flex min-h-[calc(100vh-88px)] max-w-5xl flex-col items-center justify-center px-6 pb-20 text-center">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-200">
          <span className="size-1.5 rounded-full bg-brand" />
          Built for better volleyball
        </div>
        <h1 className="max-w-4xl text-5xl font-bold leading-[1.05] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
          Smarter Coaching.
          <br />
          <span className="text-brand">Stronger Players.</span>
        </h1>
        <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">One focused platform to track progress, sharpen performance, and bring every player closer to their best.</p>
        <div className="mt-10 grid w-full max-w-lg gap-3 sm:grid-cols-2">
          <Button onClick={onCoach} className="py-4">Coach <Icon name="arrow" /></Button>
          <Button onClick={onPlayer} secondary className="py-4">Player <Icon name="arrow" /></Button>
        </div>
        <div className="mt-14 flex items-center gap-6 text-xs font-medium uppercase tracking-widest text-slate-500">
          <span>Track</span><span className="size-1 rounded-full bg-slate-600" /><span>Develop</span><span className="size-1 rounded-full bg-slate-600" /><span>Perform</span>
        </div>
      </section>
    </main>
  );
}
