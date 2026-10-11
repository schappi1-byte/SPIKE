import type { ReactNode } from "react";

function Button({ children, onClick, secondary = false }: { children: ReactNode; onClick: () => void; secondary?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`w-full rounded-xl px-6 py-3.5 text-sm font-semibold transition duration-200 active:scale-[0.98] sm:w-44 ${secondary ? "bg-white text-navy hover:bg-blue-50" : "bg-brand text-white shadow-lg shadow-blue-500/25 hover:bg-brand-dark"}`}>
      {children}
    </button>
  );
}

function Volleyball() {
  return (
    <svg className="pointer-events-none absolute left-[calc(50%-0.033em)] top-[0.06em] h-[0.23em] w-[0.23em] -translate-x-1/2" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="13.2" fill="#f4f7fb" stroke="#3478f6" strokeWidth="1.7" />
      <path d="M16 2.8c3.2 4.2 4.8 8.6 4.8 13.2S19.2 25 16 29.2C12.8 25 11.2 20.6 11.2 16S12.8 7 16 2.8Z" fill="none" stroke="#3478f6" strokeWidth="1.4" />
      <path d="M4.2 11.2c4.6 2.2 9.4 2.6 14.2.4M13.6 20.4c4.8-2.2 9.6-1.8 14.2.4" fill="none" stroke="#3478f6" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export default function Landing({ onCoach, onPlayer }: { onCoach: () => void; onPlayer: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-navy px-6 text-white">
      <div className="flex w-full max-w-3xl flex-col items-center text-center">
        <h1 className="text-7xl font-bold tracking-[-0.04em] sm:text-8xl lg:text-9xl">
          SP<span className="relative inline-block">i<Volleyball /></span>KE
        </h1>
        <p className="mt-4 text-lg font-medium text-slate-300 sm:text-xl">Smarter Coaching. Stronger Players.</p>
        <div className="mt-8 flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
          <Button onClick={onCoach}>Coach</Button>
          <Button onClick={onPlayer} secondary>Player</Button>
        </div>
      </div>
    </main>
  );
}
