import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { SKILL_KEYS, SKILL_LABEL, historyPoints, overall, type Athlete, type Skills } from "./model";
import { SYSTEM } from "./system";

const paths: Record<string, ReactNode> = {
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  back: <path d="M19 12H5M11 18l-6-6 6-6" />,
  chart: <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />,
  check: <path d="m5 12 4 4L19 6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  court: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 12h18M12 4v16" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  team: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  zap: <path d="M13 2 4 14h7l-1 8 9-12h-7Z" />,
};

export function Icon({ name, className = "size-5" }: { name: string; className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

export function Logo({ light = false, onClick }: { light?: boolean; onClick?: () => void }) {
  return (
    <button className="flex items-center gap-2.5" onClick={onClick} type="button">
      <span className="grid size-9 place-items-center rounded-xl bg-brand text-white shadow-lg shadow-blue-500/20">
        <Icon name="zap" className="size-5 fill-current" />
      </span>
      <span className={`text-xl font-bold tracking-[0.16em] ${light ? "text-white" : "text-navy"}`}>SPIKE</span>
    </button>
  );
}

export function Avatar({ athlete, large = false }: { athlete: Pick<Athlete, "initials" | "color">; large?: boolean }) {
  return <span className={`grid shrink-0 place-items-center rounded-full font-bold ${athlete.color} ${large ? "size-16 text-xl" : "size-11 text-sm"}`}>{athlete.initials}</span>;
}

export function SkillBars({ skills }: { skills: Skills }) {
  return (
    <div className="space-y-4">
      {SKILL_KEYS.map((key) => (
        <div key={key}>
          <div className="mb-1.5 flex justify-between text-sm">
            <span className="font-medium text-slate-600">{SKILL_LABEL[key]}</span>
            <span className="font-bold tabular-nums">{skills[key]}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand" style={{ width: `${skills[key]}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RadarChart({ skills }: { skills: Skills }) {
  const cx = 140;
  const cy = 118;
  const radius = 74;
  const angle = (index: number) => -Math.PI / 2 + (index * 2 * Math.PI) / SKILL_KEYS.length;
  const at = (index: number, value: number) => {
    const a = angle(index);
    const r = (value / 100) * radius;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  };
  const polygon = SKILL_KEYS.map((key, index) => at(index, skills[key]).join(",")).join(" ");
  return (
    <figure>
      <svg role="img" aria-label="Skill profile" viewBox="0 0 280 236" className="mx-auto w-full max-w-sm">
        {[25, 50, 75, 100].map((level) => (
          <polygon key={level} fill="none" stroke="#e2e8f0" points={SKILL_KEYS.map((_, index) => at(index, level).join(",")).join(" ")} />
        ))}
        {SKILL_KEYS.map((_, index) => {
          const [x, y] = at(index, 100);
          return <line key={index} x1={cx} y1={cy} x2={x} y2={y} stroke="#e2e8f0" />;
        })}
        <polygon points={polygon} fill="rgba(52,120,246,0.18)" stroke="#3478f6" strokeWidth="2" />
        {SKILL_KEYS.map((key, index) => {
          const [x, y] = at(index, 118);
          return (
            <text key={key} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-slate-500 text-[11px] font-medium">
              {SKILL_LABEL[key]}
            </text>
          );
        })}
      </svg>
      <figcaption className="sr-only">Skill scores from the latest evaluation.</figcaption>
      <table className="mt-2 w-full text-left text-sm">
        <caption className="sr-only">Latest skill scores</caption>
        <thead className="text-xs uppercase tracking-wide text-slate-400">
          <tr><th className="py-1 font-medium">Skill</th><th className="py-1 text-right font-medium">Score</th></tr>
        </thead>
        <tbody>
          {SKILL_KEYS.map((key) => (
            <tr key={key} className="border-t border-slate-100">
              <td className="py-1.5">{SKILL_LABEL[key]}</td>
              <td className="py-1.5 text-right font-semibold tabular-nums">{skills[key]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function TrendChart({ athlete }: { athlete: Athlete }) {
  const points = historyPoints(athlete);
  const width = 360;
  const height = 168;
  const pad = 28;
  const coords = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : pad + (index * (width - pad * 2)) / (points.length - 1);
    const y = height - pad - (point.value / 100) * (height - pad * 2);
    return { ...point, x, y };
  });
  const line = coords.map((point) => `${point.x},${point.y}`).join(" ");
  return (
    <figure>
      <svg role="img" aria-label="Rating history" viewBox={`0 0 ${width} ${height}`} className="w-full">
        {[0, 50, 100].map((tick) => {
          const y = height - pad - (tick / 100) * (height - pad * 2);
          return (
            <g key={tick}>
              <line x1={pad} x2={width - 12} y1={y} y2={y} stroke="#e2e8f0" />
              <text x="0" y={y + 4} className="fill-slate-400 text-[10px]">{tick}</text>
            </g>
          );
        })}
        {coords.length > 1 && <polyline fill="none" stroke="#3478f6" strokeWidth="2.5" points={line} />}
        {coords.map((point) => (
          <g key={point.at}>
            <circle cx={point.x} cy={point.y} r="4" fill="#3478f6" />
            <text x={point.x} y={height - 8} textAnchor="middle" className="fill-slate-500 text-[10px]">{point.label}</text>
          </g>
        ))}
      </svg>
      <table className="mt-2 w-full text-left text-sm">
        <caption className="sr-only">Overall rating by evaluation date</caption>
        <thead className="text-xs uppercase tracking-wide text-slate-400">
          <tr><th className="py-1 font-medium">Evaluation</th><th className="py-1 text-right font-medium">Overall</th></tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.at} className="border-t border-slate-100">
              <td className="py-1.5">{point.label}</td>
              <td className="py-1.5 text-right font-semibold tabular-nums">{point.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function SystemPanel() {
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm font-semibold text-brand">SYSTEM</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">What is connected</h1>
      <p className="mt-3 text-slate-500">{SYSTEM.roster} {SYSTEM.persistence}</p>
      <div className="mt-6 divide-y divide-slate-100 card">
        {SYSTEM.services.map((service) => (
          <div key={service.name} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-semibold">{service.name}</p>
              <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500">{service.detail}</p>
            </div>
            <span className="w-fit rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">{service.state}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type Section = { id: string; label: string; icon: string };

export function Shell({
  label,
  section,
  sections,
  onSection,
  onExit,
  warning,
  dock = false,
  children,
}: {
  label: string;
  section: string;
  sections: Section[];
  onSection: (id: string) => void;
  onExit: () => void;
  warning: string | null;
  dock?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={dock ? "min-h-screen bg-canvas" : "min-h-screen bg-canvas lg:grid lg:grid-cols-[240px_1fr]"}>
      {!dock && <aside className="hidden bg-navy text-white lg:flex lg:min-h-screen lg:flex-col lg:px-4 lg:py-6">
        <Logo light onClick={onExit} />
        <p className="mt-8 px-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
        <nav className="mt-3 flex flex-1 flex-col gap-1" aria-label={label}>
          {sections.map((item) => (
            <button key={item.id} type="button" aria-current={section === item.id ? "page" : undefined} onClick={() => onSection(item.id)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${section === item.id ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}>
              <Icon name={item.icon} className="size-4" />
              {item.label}
            </button>
          ))}
        </nav>
        <button type="button" onClick={onExit} className="mt-4 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-300 hover:bg-white/5 hover:text-white">Exit</button>
      </aside>}
      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
          <div className="flex h-16 items-center justify-between px-4 lg:px-8">
            <div className={dock ? "" : "lg:hidden"}><Logo onClick={onExit} /></div>
            {!dock && <p className="hidden text-sm text-slate-500 lg:block">{label}</p>}
            <button type="button" onClick={onExit} className="rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-600 hover:border-brand hover:text-brand">Exit</button>
          </div>
        </header>
        {warning && <p className="mx-4 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 lg:mx-8" role="status">{warning}</p>}
        <main className={`rise px-4 py-6 pb-24 lg:px-8 ${dock ? "" : "lg:pb-10"}`}>{children}</main>
        {!dock && (
          <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-200 bg-white lg:hidden" aria-label={label}>
            {sections.map((item) => (
              <button key={item.id} type="button" aria-current={section === item.id ? "page" : undefined} onClick={() => onSection(item.id)} className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${section === item.id ? "text-brand" : "text-slate-500"}`}>
                <Icon name={item.icon} className="size-4" />
                {item.label}
              </button>
            ))}
          </nav>
        )}
        {dock && createPortal(
          <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(16,27,48,0.06)]" aria-label={label}>
            {sections.map((item) => (
              <button key={item.id} type="button" aria-current={section === item.id ? "page" : undefined} onClick={() => onSection(item.id)} className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${section === item.id ? "text-brand" : "text-slate-500"}`}>
                <Icon name={item.icon} className="size-4" />
                {item.label}
              </button>
            ))}
          </nav>,
          document.body,
        )}
      </div>
    </div>
  );
}

export function ratingOf(athlete: Athlete): number {
  return overall(athlete.assessments[athlete.assessments.length - 1].skills);
}
