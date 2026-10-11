import { useEffect, useMemo, useState } from "react";
import {
  COURT_SPOTS,
  FORMATIONS,
  SKILL_KEYS,
  SKILL_LABEL,
  adherence,
  attentionReason,
  formatWhen,
  latestAssessment,
  lineupNotes,
  moveOnCourt,
  overall,
  sameSkills,
  scoreLineup,
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

function shortPosition(position: string): string {
  if (position.startsWith("Outside")) return "Outside";
  if (position.startsWith("Middle")) return "Middle";
  if (position.startsWith("Defensive")) return "Defense";
  return position;
}

const OUR_MARKERS = [
  { index: 0, x: 20, y: 28 },
  { index: 1, x: 50, y: 28 },
  { index: 2, x: 80, y: 28 },
  { index: 3, x: 20, y: 70 },
  { index: 4, x: 50, y: 70 },
  { index: 5, x: 80, y: 70 },
];

function noteLabel(note: string): string {
  if (note === "Missing player") return "Incomplete lineup";
  if (note === "Duplicate assignment") return "Duplicate player";
  return note;
}

function LineupBoard() {
  const { athletes, draft, lineups, setDraft, saveDraft, loadLineup, deleteLineup } = useStore();
  const [selected, setSelected] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [benchOver, setBenchOver] = useState(false);
  const [popover, setPopover] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const byId = new Map(athletes.map((athlete) => [athlete.id, athlete]));
  const scores = useMemo(() => scoreLineup(draft.slots, draft.rotation, athletes), [draft.slots, draft.rotation, athletes]);
  const notes = useMemo(() => lineupNotes(draft.slots, draft.formation, draft.rotation, athletes), [draft.slots, draft.formation, draft.rotation, athletes]);
  const onCourt = new Set(draft.slots.filter((id): id is number => id != null));
  const popoverAthlete = popover != null ? byId.get(popover) : undefined;
  const bench = athletes.filter((athlete) => !onCourt.has(athlete.id));

  function clearSpot(index: number) {
    const next = [...draft.slots];
    next[index] = null;
    setDraft({ ...draft, slots: next });
    setPopover(null);
    setMessage("Player moved to the bench.");
  }

  function dropOnBench(athleteId: number) {
    const index = draft.slots.indexOf(athleteId);
    if (index >= 0) clearSpot(index);
  }

  function place(index: number, athleteId: number) {
    setDraft({ ...draft, slots: moveOnCourt(draft.slots, index, athleteId) });
    setPopover(null);
    setMessage("Court updated. Save the lineup to keep it.");
  }

  function rotateTo(rotation: number) {
    const next = ((rotation - 1 + 6) % 6) + 1;
    setDraft(withRotation(draft, next));
    setPopover(null);
    setMessage(`Rotation ${next}.`);
  }

  function onSpotClick(index: number) {
    const occupant = draft.slots[index] ?? null;
    if (selected != null && selected !== occupant) {
      place(index, selected);
      return;
    }
    if (occupant != null) {
      setSelected(occupant);
      setPopover((current) => (current === occupant ? null : occupant));
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="card p-4 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold text-brand">LINEUP</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Court</h1>
            <p className="mt-1 max-w-xl text-sm text-slate-500">Six players on the court. Everyone else stays on the bench. Drag between the court and the bench, or select a player and tap a spot.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setDraft({ ...draft, slots: suggestSlots(athletes, draft.formation, draft.rotation) }); setMessage("Placement uses the skill each spot needs. The lineup optimizer is not connected."); }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold">Suggest placement</button>
            <button type="button" onClick={() => { setDraft({ ...draft, rotation: 1, slots: [null, null, null, null, null, null] }); setPopover(null); setMessage("Lineup reset."); }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600">Reset lineup</button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-end gap-4">
          <label className="text-sm font-medium text-slate-600">
            Formation
            <select value={draft.formation} onChange={(event) => setDraft({ ...draft, formation: event.target.value as Formation })} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2">
              {FORMATIONS.map((formation) => <option key={formation}>{formation}</option>)}
            </select>
          </label>
          <div>
            <p className="text-sm font-medium text-slate-600">Rotation {draft.rotation}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1" role="group" aria-label="Rotation">
              <button type="button" onClick={() => rotateTo(draft.rotation - 1)} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold">Previous</button>
              {[1, 2, 3, 4, 5, 6].map((rotation) => (
                <button key={rotation} type="button" aria-pressed={draft.rotation === rotation} onClick={() => rotateTo(rotation)} className={`size-9 rounded-lg text-sm font-bold ${draft.rotation === rotation ? "bg-brand text-white" : "border border-slate-200"}`}>{rotation}</button>
              ))}
              <button type="button" onClick={() => rotateTo(draft.rotation + 1)} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold">Next</button>
            </div>
          </div>
        </div>
        <div className="relative mt-5 aspect-[5/4] w-full overflow-hidden rounded-md shadow-inner" style={{ background: "repeating-linear-gradient(90deg, #e7c99a 0 14px, #dfbe88 14px 15px), linear-gradient(180deg, #efd7ae, #d7b07a 48%, #c99658)" }} onClick={() => setPopover(null)}>
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 80" aria-hidden="true">
            <rect x="6" y="8" width="88" height="68" fill="none" stroke="white" strokeWidth="1.2" />
            <line x1="6" y1="30" x2="94" y2="30" stroke="white" strokeWidth="0.8" />
          </svg>
          <div className="pointer-events-none absolute inset-x-[6%] top-0 z-20 h-3 border-b-2 border-white bg-[repeating-linear-gradient(90deg,#ffffff_0_3px,#dbe4ef_3px_5px)]" />
          <span className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#6b4a22]">Net</span>
          <span className="pointer-events-none absolute bottom-[5%] left-[8%] text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b4a22]">Rotation {draft.rotation}</span>
          {OUR_MARKERS.map((marker) => {
            const spot = COURT_SPOTS[marker.index];
            const athlete = draft.slots[marker.index] != null ? byId.get(draft.slots[marker.index] as number) : undefined;
            const open = selected != null && !athlete;
            return (
              <div key={spot.number} className="absolute z-10 flex w-[22%] -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: `${marker.x}%`, top: `${marker.y}%` }} onDragOver={(event) => event.preventDefault()} onDragEnter={() => setOver(marker.index)} onDragLeave={() => setOver((current) => (current === marker.index ? null : current))} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); setOver(null); const id = Number(event.dataTransfer.getData("text/plain")); if (id) place(marker.index, id); }}>
                <button type="button" draggable={Boolean(athlete)} onDragStart={(event) => { if (athlete) event.dataTransfer.setData("text/plain", String(athlete.id)); }} onClick={(event) => { event.stopPropagation(); onSpotClick(marker.index); }} aria-label={athlete ? `Position ${spot.number}, ${athlete.name}` : `Open position ${spot.number}`} className={`grid aspect-square w-[72%] place-items-center rounded-full text-sm font-bold shadow-md ${athlete ? "bg-brand text-white ring-2 ring-white" : "border-2 border-dashed border-white/80 bg-white/20 text-white"} ${open || over === marker.index ? "ring-2 ring-brand ring-offset-2 ring-offset-[#d7b07a]" : ""} ${athlete && selected === athlete.id ? "ring-4 ring-white" : ""}`}>
                  {athlete ? athlete.number : spot.number}
                </button>
                <span className="mt-0.5 max-w-full truncate text-[10px] font-semibold leading-tight text-[#3d2a12] sm:text-xs">{athlete ? athlete.name.split(" ")[0] : "Open"}</span>
                <span className="text-[9px] leading-tight text-[#3d2a12]/80">{athlete ? `${shortPosition(athlete.position)} · ${spot.number}` : `Zone ${spot.number}`}</span>
                {popoverAthlete && athlete?.id === popoverAthlete.id && (
                  <div className="absolute bottom-[calc(100%+6px)] z-30 w-36 rounded-xl bg-white p-2.5 text-left shadow-lg" role="dialog" aria-label={popoverAthlete.name} onClick={(event) => event.stopPropagation()}>
                    <p className="text-sm font-bold">{popoverAthlete.name}</p>
                    <p className="text-xs text-slate-500">{popoverAthlete.position}</p>
                    <p className="mt-1 text-sm font-bold text-brand">{ratingOf(popoverAthlete)} rating</p>
                    <button type="button" onClick={() => clearSpot(marker.index)} className="mt-2 text-xs font-semibold text-rose-600">To bench</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {notes.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Lineup notes">
            {notes.map((note) => <li key={note} className={`rounded-full px-3 py-1 text-xs font-semibold ${note.startsWith("Strong") ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{noteLabel(note)}</li>)}
          </ul>
        )}
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
          <Score label="Current rotation" value={scores.current} note={`Rotation ${draft.rotation}`} />
          <Score label="Front row" value={scores.front} note="4, 3, 2" />
          <Score label="Back row" value={scores.back} note="5, 6, 1" />
          <Score label="Overall lineup" value={scores.overall} note="All 6 rotations" />
          <Score label="Best rotation" value={scores.best.score} note={`Rotation ${scores.best.rotation}`} />
          <Score label="Weakest rotation" value={scores.weakest.score} note={`Rotation ${scores.weakest.rotation}`} />
        </div>
        {message && <p className="mt-4 text-sm font-medium text-slate-600" role="status">{message}</p>}
      </section>
      <div className="space-y-6">
        <section className={`card p-4 ${benchOver ? "ring-2 ring-brand" : ""}`} onDragOver={(event) => event.preventDefault()} onDragEnter={() => setBenchOver(true)} onDragLeave={() => setBenchOver(false)} onDrop={(event) => { event.preventDefault(); setBenchOver(false); const id = Number(event.dataTransfer.getData("text/plain")); if (id) dropOnBench(id); }}>
          <h2 className="px-2 font-bold">Bench</h2>
          <p className="px-2 pb-2 text-xs text-slate-500">{bench.length} waiting. Drag a court player here to sub them out.</p>
          {bench.length === 0 ? <p className="px-2 py-3 text-sm text-slate-500">Everyone is on the court.</p> : (
            <div className="max-h-80 space-y-1 overflow-auto">
              {bench.map((athlete) => (
                <button key={athlete.id} type="button" draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", String(athlete.id))} aria-pressed={selected === athlete.id} onClick={() => { setPopover(null); setSelected((current) => current === athlete.id ? null : athlete.id); }} className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left ${selected === athlete.id ? "bg-blue-50 ring-2 ring-brand" : "hover:bg-slate-50"}`}>
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white">{athlete.number}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{athlete.name}</span>
                    <span className="block text-xs text-slate-500">{athlete.position} · {ratingOf(athlete)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
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

function Score({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="flex aspect-square flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-1 text-center">
      <p className="text-xl font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-[11px] font-semibold leading-tight">{label}</p>
      <p className="text-[10px] leading-tight text-slate-500">{note}</p>
    </div>
  );
}
