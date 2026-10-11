import { useEffect, useMemo, useState } from "react";
import {
  FORMATIONS,
  SKILL_KEYS,
  SKILL_LABEL,
  adherence,
  attentionReason,
  courtRoles,
  formatWhen,
  latestAssessment,
  overall,
  placeAthlete,
  sameSkills,
  suggestSlots,
  trainingPlan,
  trendDelta,
  withRotation,
  type Athlete,
  type Formation,
  type Skills,
} from "./model";
import { useStore, type DraftInput } from "./store";
import { Avatar, Icon, RadarChart, Shell, SystemPanel, TrendChart, ratingOf } from "./ui";

type Section = "overview" | "evaluate" | "lineup" | "system";

const sections = [
  { id: "overview", label: "Overview", icon: "team" },
  { id: "evaluate", label: "Evaluate", icon: "chart" },
  { id: "lineup", label: "Lineup", icon: "court" },
  { id: "system", label: "System", icon: "clock" },
];

const spots = [
  { index: 0, label: "4" },
  { index: 1, label: "3" },
  { index: 2, label: "2" },
  { index: 3, label: "5" },
  { index: 4, label: "6" },
  { index: 5, label: "1" },
];

export default function Coach({
  section,
  athleteId,
  onSection,
  onAthlete,
  onOpenPlayer,
  onExit,
}: {
  section: Section;
  athleteId: number;
  onSection: (section: Section) => void;
  onAthlete: (id: number) => void;
  onOpenPlayer: () => void;
  onExit: () => void;
}) {
  const { loadWarning } = useStore();
  return (
    <Shell label="Coach" section={section} sections={sections} onSection={(id) => onSection(id as Section)} onExit={onExit} warning={loadWarning}>
      {section === "overview" && <Overview onOpen={(id) => { onAthlete(id); onSection("evaluate"); }} />}
      {section === "evaluate" && <Evaluate athleteId={athleteId} onAthlete={onAthlete} onOpenPlayer={onOpenPlayer} />}
      {section === "lineup" && <LineupBoard />}
      {section === "system" && <SystemPanel />}
    </Shell>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function Overview({ onOpen }: { onOpen: (id: number) => void }) {
  const { athletes } = useStore();
  const [query, setQuery] = useState("");
  const ratings = athletes.map((athlete) => ratingOf(athlete));
  const average = Math.round((ratings.reduce((sum, value) => sum + value, 0) / ratings.length) * 10) / 10;
  const plans = athletes.map(trainingPlan);
  const assigned = plans.reduce((sum, plan) => sum + plan.length, 0);
  const done = plans.reduce((sum, plan) => sum + plan.filter((item) => item.done).length, 0);
  const completion = assigned ? Math.round((done / assigned) * 100) : 0;
  const attention = athletes.filter((athlete) => attentionReason(athlete));
  const filtered = athletes.filter((athlete) => `${athlete.name} ${athlete.position} ${athlete.number}`.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-brand">SQUAD</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{greeting()}, Coach</h1>
          <p className="mt-2 text-sm text-slate-500">Prototype roster stored on this device. Ratings update when you save an evaluation.</p>
        </div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Active athletes" value={String(athletes.length)} note="On this roster" />
        <Metric label="Squad rating" value={average.toFixed(1)} note="Latest evaluations" />
        <Metric label="Training completion" value={`${completion}%`} note={`${done}/${assigned} exercises`} />
        <Metric label="Needs attention" value={String(attention.length)} note="Rating, trend, or training" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_0.9fr]">
        <section className="card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold">Roster</h2>
              <p className="text-sm text-slate-500">Select an athlete to evaluate</p>
            </div>
            <label className="relative block">
              <span className="sr-only">Search roster</span>
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or position" className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm sm:w-64" />
            </label>
          </div>
          {filtered.length === 0 ? <p className="px-5 py-8 text-sm text-slate-500">No athletes match that search.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Athlete</th>
                    <th className="px-3 py-3 font-medium">Rating</th>
                    <th className="px-3 py-3 font-medium">Trend</th>
                    <th className="px-3 py-3 font-medium">Training</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((athlete) => {
                    const delta = trendDelta(athlete);
                    const reason = attentionReason(athlete);
                    return (
                      <tr key={athlete.id} className="border-t border-slate-100">
                        <td className="px-5 py-3">
                          <button type="button" onClick={() => onOpen(athlete.id)} className="flex items-center gap-3 text-left">
                            <Avatar athlete={athlete} />
                            <span>
                              <span className="block font-semibold">{athlete.name}</span>
                              <span className="block text-xs text-slate-500">#{athlete.number} · {athlete.position}</span>
                            </span>
                          </button>
                        </td>
                        <td className="px-3 py-3 font-bold tabular-nums">{ratingOf(athlete)}</td>
                        <td className={`px-3 py-3 font-semibold tabular-nums ${delta !== null && delta < 0 ? "text-rose-600" : "text-emerald-700"}`}>{delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta}`}</td>
                        <td className="px-3 py-3 tabular-nums">{adherence(athlete)}%</td>
                        <td className="px-5 py-3 text-xs font-semibold">{reason ? <span className="text-amber-700">{reason}</span> : <span className="text-emerald-700">On track</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="card p-5">
          <h2 className="font-bold">Needs a look</h2>
          <p className="mt-1 text-sm text-slate-500">Athletes under 78, with a decline, or with training still open.</p>
          <div className="mt-4 space-y-2">
            {attention.length === 0 && <p className="text-sm text-slate-500">No athletes are flagged right now.</p>}
            {attention.map((athlete) => (
              <button key={athlete.id} type="button" onClick={() => onOpen(athlete.id)} className="flex w-full items-center gap-3 rounded-xl border border-slate-100 px-3 py-3 text-left hover:border-brand/40">
                <Avatar athlete={athlete} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{athlete.name}</span>
                  <span className="block text-xs text-amber-700">{attentionReason(athlete)}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="card p-5">
      <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      <p className="mt-1 text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </div>
  );
}

function Evaluate({ athleteId, onAthlete, onOpenPlayer }: { athleteId: number; onAthlete: (id: number) => void; onOpenPlayer: () => void }) {
  const { athletes, saveAssessment } = useStore();
  const athlete = athletes.find((item) => item.id === athleteId) ?? athletes[0];
  const latest = latestAssessment(athlete);
  const [draft, setDraft] = useState<DraftInput>(() => draftFrom(athlete));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = athletes.find((item) => item.id === athleteId) ?? athletes[0];
    setDraft(draftFrom(next));
    setMessage(null);
    setError(null);
  }, [athleteId]);

  const dirty = !sameSkills(draft.skills, latest.skills) || draft.strengths.trim() !== latest.strengths || draft.weaknesses.trim() !== latest.weaknesses || draft.priorities.trim() !== latest.priorities;

  function updateSkill(key: keyof Skills, value: number) {
    setDraft((current) => ({ ...current, skills: { ...current.skills, [key]: value } }));
    setMessage(null);
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[220px_1fr]">
      <div className="card max-h-[70vh] overflow-auto p-2">
        {athletes.map((item) => (
          <button key={item.id} type="button" onClick={() => onAthlete(item.id)} aria-pressed={item.id === athlete.id} className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left ${item.id === athlete.id ? "bg-blue-50" : "hover:bg-slate-50"}`}>
            <Avatar athlete={item} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{item.name}</span>
              <span className="block text-xs text-slate-500">{item.position}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <form
          className="card p-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (!dirty) {
              setError("This matches the latest evaluation.");
              return;
            }
            const saved = saveAssessment(athlete.id, draft);
            if (!saved) {
              setError("This matches the latest evaluation.");
              return;
            }
            setError(null);
            setMessage("Evaluation saved. The athlete dashboard now uses this assessment.");
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-brand">EVALUATION</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">{athlete.name}</h1>
              <p className="mt-1 text-sm text-slate-500">#{athlete.number} · {athlete.position} · last saved {formatWhen(latest.recordedAt)}</p>
            </div>
            <button type="button" onClick={onOpenPlayer} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-brand hover:text-brand">Open athlete view</button>
          </div>
          <div className="mt-6 space-y-4">
            {SKILL_KEYS.map((key) => (
              <label key={key} className="block text-sm">
                <span className="mb-1 flex justify-between font-medium text-slate-600"><span>{SKILL_LABEL[key]}</span><span className="font-bold text-navy tabular-nums">{draft.skills[key]}</span></span>
                <input type="range" min={0} max={100} value={draft.skills[key]} aria-valuetext={`${SKILL_LABEL[key]} ${draft.skills[key]}`} onChange={(event) => updateSkill(key, Number(event.target.value))} className="w-full accent-[#3478f6]" />
              </label>
            ))}
          </div>
          <Field label="Strengths" value={draft.strengths} onChange={(strengths) => setDraft({ ...draft, strengths })} />
          <Field label="Needs work" value={draft.weaknesses} onChange={(weaknesses) => setDraft({ ...draft, weaknesses })} />
          <Field label="Development priority" value={draft.priorities} onChange={(priorities) => setDraft({ ...draft, priorities })} />
          {error && <p className="mt-4 text-sm font-medium text-amber-700" role="alert">{error}</p>}
          {message && <p className="mt-4 text-sm font-medium text-emerald-700" role="status">{message}</p>}
          <div className="mt-5 flex gap-2">
            <button type="submit" className="rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white hover:bg-brand-dark">Save evaluation</button>
            <button type="button" onClick={() => { setDraft(draftFrom(athlete)); setMessage(null); setError(null); }} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600">Cancel</button>
          </div>
        </form>
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="font-bold">Saved profile</h2>
            <p className="mt-1 text-sm text-slate-500">Overall {overall(latest.skills)} · this updates after you save</p>
            <div className="mt-4"><RadarChart skills={latest.skills} /></div>
          </section>
          <section className="card p-6">
            <h2 className="font-bold">Rating history</h2>
            <div className="mt-4"><TrendChart athlete={athlete} /></div>
          </section>
        </div>
      </div>
    </div>
  );
}

function draftFrom(athlete: Athlete): DraftInput {
  const latest = latestAssessment(athlete);
  return { skills: { ...latest.skills }, strengths: latest.strengths, weaknesses: latest.weaknesses, priorities: latest.priorities };
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="mt-4 block text-sm font-medium text-slate-600">
      {label}
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal text-navy" />
    </label>
  );
}

function LineupBoard() {
  const { athletes, draft, lineups, setDraft, saveDraft, loadLineup, deleteLineup } = useStore();
  const [selected, setSelected] = useState<number | null>(athletes[0]?.id ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const roles = useMemo(() => courtRoles(draft.formation), [draft.formation]);
  const byId = new Map(athletes.map((athlete) => [athlete.id, athlete]));

  function place(index: number, athleteId: number) {
    setDraft({ ...draft, slots: placeAthlete(draft.slots, index, athleteId) });
    setMessage("Court updated. Save the lineup to keep it.");
  }

  function renderSpot(spot: { index: number; label: string }) {
    const athlete = draft.slots[spot.index] ? byId.get(draft.slots[spot.index] as number) : undefined;
    return (
      <button
        key={spot.index}
        type="button"
        draggable={Boolean(athlete)}
        onDragStart={(event) => { if (athlete) event.dataTransfer.setData("text/plain", String(athlete.id)); }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const id = Number(event.dataTransfer.getData("text/plain"));
          if (id) place(spot.index, id);
        }}
        onClick={() => { if (selected) place(spot.index, selected); }}
        className={`grid min-w-0 place-items-center rounded-2xl border px-2 py-3 text-center ${athlete ? "border-white/30 bg-white text-navy" : "border-dashed border-white/30 bg-white/10 text-white"}`}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{spot.label} · {roles[spot.index]}</span>
        <span className="mt-0.5 truncate text-sm font-bold">{athlete ? athlete.initials : "Empty"}</span>
      </button>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 xl:grid-cols-[1fr_300px]">
      <section className="card p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-semibold text-brand">LINEUP</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Court</h1>
            <p className="mt-1 max-w-xl text-sm text-slate-500">Choose an athlete, then choose a spot. Changing rotation moves the athletes. Suggest placement uses current ratings and is not an optimizer.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setDraft({ ...draft, slots: suggestSlots(athletes, draft.formation) }); setMessage("Placement uses the skill each spot needs. The lineup optimizer is not connected."); }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold">Suggest placement</button>
            <button type="button" onClick={() => { setDraft({ ...draft, slots: [null, null, null, null, null, null] }); setMessage("Court cleared."); }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600">Clear</button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <label className="text-sm font-medium text-slate-600">
            Formation
            <select value={draft.formation} onChange={(event) => setDraft({ ...draft, formation: event.target.value as Formation })} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2">
              {FORMATIONS.map((formation) => <option key={formation}>{formation}</option>)}
            </select>
          </label>
          <div>
            <p className="text-sm font-medium text-slate-600">Rotation</p>
            <div className="mt-1 flex gap-1">
              {[1, 2, 3, 4, 5, 6].map((rotation) => (
                <button key={rotation} type="button" aria-pressed={draft.rotation === rotation} onClick={() => setDraft(withRotation(draft, rotation))} className={`size-9 rounded-lg text-sm font-bold ${draft.rotation === rotation ? "bg-brand text-white" : "border border-slate-200"}`}>{rotation}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="mx-auto mt-6 max-w-2xl rounded-3xl bg-[#163056] px-3 py-4 sm:px-6 sm:py-6">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">{spots.slice(0, 3).map(renderSpot)}</div>
          <div className="my-3 flex items-center gap-3 sm:my-4">
            <div className="h-1 flex-1 bg-white/80" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">Net</p>
            <div className="h-1 flex-1 bg-white/80" />
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">{spots.slice(3).map(renderSpot)}</div>
        </div>
        {message && <p className="mt-4 text-sm font-medium text-slate-600" role="status">{message}</p>}
      </section>
      <div className="space-y-6">
        <section className="card p-4">
          <h2 className="px-2 font-bold">Athletes</h2>
          <p className="px-2 pb-2 text-xs text-slate-500">Select, or drag onto a spot.</p>
          <div className="max-h-80 space-y-1 overflow-auto">
            {athletes.map((athlete) => (
              <button key={athlete.id} type="button" draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", String(athlete.id))} aria-pressed={selected === athlete.id} onClick={() => setSelected(athlete.id)} className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left ${selected === athlete.id ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                <Avatar athlete={athlete} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{athlete.name}</span>
                  <span className="block text-xs text-slate-500">{athlete.position} · {ratingOf(athlete)}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
        <section className="card p-4">
          <h2 className="px-2 font-bold">Saved lineups</h2>
          <label className="mt-3 block px-2 text-sm font-medium text-slate-600">
            Name
            <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal" />
          </label>
          <button type="button" onClick={() => { saveDraft(); setMessage(draft.sourceId ? "Saved lineup updated." : "Lineup saved on this device."); }} className="mx-2 mt-3 w-[calc(100%-1rem)] rounded-xl bg-brand py-3 text-sm font-semibold text-white">Save lineup</button>
          <div className="mt-3 space-y-2">
            {lineups.length === 0 && <p className="px-2 text-sm text-slate-500">No saved lineups yet.</p>}
            {lineups.map((lineup) => (
              <div key={lineup.id} className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2">
                <button type="button" onClick={() => { loadLineup(lineup.id); setMessage(`Loaded ${lineup.name}.`); }} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-semibold">{lineup.name}</span>
                  <span className="block text-xs text-slate-500">{lineup.formation} · rotation {lineup.rotation}</span>
                </button>
                <button type="button" onClick={() => deleteLineup(lineup.id)} className="text-xs font-semibold text-slate-400 hover:text-rose-600">Delete</button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
