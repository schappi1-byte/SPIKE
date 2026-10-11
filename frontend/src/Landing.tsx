import type { ReactNode } from "react";
import { Volleyball } from "./ui";

function Button({ children, onClick, secondary = false }: { children: ReactNode; onClick: () => void; secondary?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`w-full rounded-xl px-6 py-3.5 text-sm font-medium transition duration-200 active:scale-[0.98] sm:w-44 ${secondary ? "border border-white/60 bg-white/10 text-white backdrop-blur hover:bg-white/20" : "bg-brand text-navy shadow-lg shadow-brand/30 hover:bg-brand-light"}`}>
      {children}
    </button>
  );
}

export default function Landing({ actions = [], notice = null }: { actions?: { label: string; onClick: () => void; secondary?: boolean }[]; notice?: string | null }) {
  return (
    <main className="aurora grid min-h-dvh place-items-center px-6 text-white">
      <div className="flex w-full max-w-3xl flex-col items-center text-center">
        <h1 aria-label="SPiKE" className="font-display text-7xl font-bold italic tracking-[-0.02em] sm:text-8xl lg:text-9xl">
          SP<span className="relative inline-block" aria-hidden="true">ı<Volleyball /></span>KE
        </h1>
        <p className="mt-5 text-xl text-white sm:text-2xl">Smarter Coaching. Stronger Players.</p>
        <p className="mt-3 max-w-md text-sm leading-6 text-white/80 sm:text-base">AI-powered volleyball coaching, performance analytics, and personalized training in one platform.</p>
        {actions.length > 0 && (
          <div className="mt-8 flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
            {actions.map((action) => <Button key={action.label} onClick={action.onClick} secondary={action.secondary}>{action.label}</Button>)}
          </div>
        )}
        {notice && <p className="mt-6 max-w-md rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-sm text-white backdrop-blur" role="status">{notice}</p>}
      </div>
    </main>
  );
}
