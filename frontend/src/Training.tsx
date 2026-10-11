import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { formatClock, formatWhen, latestAssessment, sameTime, type Athlete } from "./model";
import { useStore } from "./store";

const Trainer = lazy(() => import("./Trainer"));
import {
  exerciseSeconds,
  finishEffort,
  progressKey,
  requestTrainingPlan,
  savePlan,
  startSession,
  tickSession,
  syncProgress,
  todayIndex,
  withLocalProgress,
  type PlanExercise,
  type SavedPlan,
  type Session,
} from "./trainingPlan";

const PHASES = { warmup: "Warm-up", work: "Work", cooldown: "Cool-down" };

export default function TrainingBoard({ athlete }: { athlete: Athlete }) {
  const latest = latestAssessment(athlete);
  const { analyses, plans, setPlan } = useStore();
  const analysis = analyses[athlete.id] ?? null;
  const server = plans[athlete.id] ?? null;
  const [saved, setSaved] = useState<SavedPlan | null>(() => (server ? withLocalProgress(server) : null));
  const [day, setDay] = useState(todayIndex);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const request = useRef(0);
  const synced = useRef(server ? progressKey(server) : "");

  useEffect(() => {
    request.current += 1;
    setSaved(server ? withLocalProgress(server) : null);
    synced.current = server ? progressKey(server) : "";
    setError(null);
    setSyncError(null);
    setLoading(false);
    setDay(todayIndex());
  }, [athlete.id, server?.generatedAt]);

  function update(next: SavedPlan | null) {
    setSaved(next);
    if (!next) return;
    savePlan(next);
    const planId = next.planId;
    const key = progressKey(next);
    if (planId == null || key === synced.current) return;
    synced.current = key;
    void syncProgress(planId, next).then((problem) => {
      setSyncError(problem);
      if (problem) synced.current = "";
      else setPlan(athlete.id, { ...next, planId });
    });
  }

  async function generate() {
    const ticket = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const plan = await requestTrainingPlan(athlete);
      if (request.current !== ticket) return;
      synced.current = progressKey(plan);
      savePlan(plan);
      setPlan(athlete.id, plan);
      setSaved(plan);
    } catch (caught) {
      if (request.current !== ticket) return;
      setError(caught instanceof Error ? caught.message : "Gemini could not build a training plan.");
    } finally {
      if (request.current === ticket) setLoading(false);
    }
  }

  if (!saved || saved.athleteId !== athlete.id) {
    return (
      <div className="mx-auto max-w-3xl">
        <Header />
        <section className="card mt-4 overflow-hidden">
          <TrainerFrame move="rest" paused={false} />
        </section>
        <p className="mt-3 text-sm leading-6 text-slate-500">{analysis ? "A Gemini analysis is saved and will be sent with your ratings and coach notes." : "No Gemini analysis is saved yet. The plan will use your ratings, history, and coach feedback."}</p>
        <button type="button" onClick={generate} disabled={loading} className="mt-5 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-navy hover:bg-brand-light disabled:opacity-60">{loading ? "Building your week…" : "Create my week"}</button>
        {error && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">{error}</p>}
      </div>
    );
  }

  const stale = !sameTime(saved.sourceRecordedAt, latest.recordedAt) || (analysis != null && !sameTime(saved.analysisAt ?? "", analysis.generatedAt));
  if (saved.session) {
    return (
      <>
        {syncError && <p className="mx-auto mb-3 max-w-5xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">{syncError}</p>}
        <Workout saved={saved} onChange={update} />
      </>
    );
  }

  const selected = saved.plan.days[day];
  const finished = saved.done[day] ?? [];
  const today = todayIndex();
  const todayDone = saved.done[today] ?? [];
  const weekDone = saved.done.reduce((sum, list) => sum + list.length, 0);
  const weekTotal = saved.plan.days.reduce((sum, item) => sum + item.exercises.length, 0);
  const minutes = Math.max(1, Math.round(selected.exercises.reduce((sum, item) => sum + exerciseSeconds(item), 0) / 60));

  return (
    <div className="mx-auto max-w-5xl">
      <Header />
      <section className="card mt-4 overflow-hidden">
        <TrainerFrame move="rest" paused={false} />
      </section>
      <section className="card mt-4 p-6">
        <p className="text-sm font-semibold text-brand-ink">Primary goal</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">{saved.plan.goal}</h2>
        <p className="mt-2 text-sm text-slate-500">Created {formatWhen(saved.generatedAt)}. Practice guidance only. It does not prevent injuries or guarantee improvement. Stop if something hurts.</p>
        {stale && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">A newer evaluation or analysis is saved. Create a new week when you want the plan to match it.</p>}
        {syncError && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">{syncError}</p>}
      </section>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat label="Today" value={`${todayDone.length}/${saved.plan.days[today].exercises.length}`} note={saved.plan.days[today].name} />
        <Stat label="This week" value={`${weekDone}/${weekTotal}`} note={`${minutes} min selected day`} />
      </div>
      <div className="mt-4 flex gap-2 overflow-auto" role="group" aria-label="Training days">
        {saved.plan.days.map((item, index) => (
          <button key={item.name} type="button" aria-pressed={index === day} onClick={() => setDay(index)} className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold ${index === day ? "bg-brand text-navy" : "border border-slate-200 bg-white"}`}>{item.name}</button>
        ))}
      </div>
      <section className="card mt-4 p-4">
        <h2 className="px-2 font-bold">{selected.name}</h2>
        <ol className="mt-2 space-y-2">
          {selected.exercises.map((item, index) => (
            <li key={`${item.name}-${index}`} className="flex items-start justify-between gap-3 rounded-xl px-2 py-2">
              <span>
                <span className="block text-sm font-semibold">{index + 1}. {item.name}</span>
                <span className="block text-xs text-slate-500">{PHASES[item.phase]} · {item.skill} · {dose(item)} · {item.difficulty}</span>
              </span>
              <span className={`text-xs font-semibold ${finished.includes(index) ? "text-emerald-700" : "text-slate-400"}`}>{finished.includes(index) ? "Done" : "Open"}</span>
            </li>
          ))}
        </ol>
        <button type="button" onClick={() => update({ ...saved, session: { ...startSession(day), exercise: Math.max(0, selected.exercises.findIndex((_, index) => !finished.includes(index))) } })} className="mx-2 mt-3 w-[calc(100%-1rem)] rounded-xl bg-brand py-3 text-sm font-semibold text-navy">Start training</button>
        <button type="button" onClick={generate} disabled={loading} className="mx-2 mt-2 text-sm font-semibold text-slate-500">{loading ? "Building your week…" : "Create a new week"}</button>
        {error && <p className="mx-2 mt-3 text-sm text-amber-800" role="alert">{error}</p>}
      </section>
    </div>
  );
}

function Workout({ saved, onChange }: { saved: SavedPlan; onChange: (next: SavedPlan) => void }) {
  const session = saved.session as Session;
  const day = saved.plan.days[session.day];
  const exercise = day.exercises[session.exercise];
  const next = day.exercises[session.exercise + 1] ?? null;
  const waiting = session.phase === "exercising" && exercise.reps > 0 && session.shownReps >= exercise.reps;
  const running = session.phase === "countdown" || session.phase === "resting" || (session.phase === "exercising" && !waiting);
  const savedRef = useRef(saved);
  const keep = useRef(true);
  savedRef.current = saved;

  useEffect(() => {
    if (!running) return;
    let previous = Date.now();
    const id = window.setInterval(() => {
      const current = savedRef.current.session;
      const planDay = savedRef.current.plan.days[current?.day ?? 0];
      if (!current || !planDay) return;
      const move = planDay.exercises[current.exercise];
      const upcoming = planDay.exercises[current.exercise + 1] ?? null;
      const delta = (Date.now() - previous) / 1000;
      previous = Date.now();
      const step = tickSession(current, move, upcoming, delta);
      const finishedNow = step.finished || (step.session.afterRest === "exercise" && current.afterRest !== "exercise") || (step.session.phase === "completed" && current.phase !== "completed");
      const done = finishedNow ? markDone(savedRef.current, current.exercise) : savedRef.current.done;
      onChange({ ...savedRef.current, done, session: step.session });
    }, 200);
    return () => window.clearInterval(id);
  }, [running, session.phase, session.exercise, session.set, session.day]);

  useEffect(() => {
    return () => {
      const current = savedRef.current;
      if (!keep.current || !current.session || current.session.phase === "paused" || current.session.phase === "completed") return;
      const paused = { ...current, session: { ...current.session, phase: "paused" as const, resume: current.session.phase } };
      savePlan(paused);
      if (current.planId != null) void syncProgress(current.planId, paused);
    };
  }, []);

  function patch(nextSession: Session, finishedExercise: number | null = null) {
    if (nextSession.phase === "completed") keep.current = false;
    const done = finishedExercise == null ? saved.done : markDone(saved, finishedExercise);
    onChange({ ...saved, done, session: nextSession });
  }

  if (session.phase === "completed") {
    return (
      <div className="mx-auto max-w-xl card overflow-hidden p-6 text-center">
        <TrainerFrame move="rest" paused={false} />
        <h1 className="mt-4 text-2xl font-bold">Workout complete</h1>
        <p className="mt-2 text-sm text-slate-500">{day.name} is checked off. This records the sets you confirmed. It does not measure your repetitions.</p>
        <button type="button" onClick={() => { keep.current = false; onChange({ ...saved, session: null }); }} className="mt-5 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-navy">Back to the week</button>
      </div>
    );
  }

  const demonstrating = (session.phase === "exercising" || (session.phase === "paused" && session.resume === "exercising")) && !waiting;
  const move = demonstrating ? exercise.animation : "rest";
  const clock = session.phase === "exercising" && exercise.reps > 0 ? `${Math.min(exercise.reps, Math.floor(session.shownReps))} / ${exercise.reps}` : formatClock(session.remaining);

  return (
    <div className="mx-auto grid max-w-5xl items-start gap-4 md:grid-cols-[1.1fr_0.9fr]">
      <section className="card px-3 py-2 md:px-4 md:py-6">
        <TrainerFrame move={move} paused={session.phase === "paused" || waiting} />
        {exercise.animation === "none" && session.phase === "exercising" && <p className="px-4 text-center text-sm text-slate-500">This exercise has no matching animation. Follow the written instructions.</p>}
      </section>
      <section className="card p-4 md:p-5">
        <p className="text-sm font-semibold text-brand-ink">{PHASES[exercise.phase]} · {exercise.skill} · {exercise.difficulty}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{exercise.name}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{exercise.instructions}</p>
        <p className="mt-4 text-sm font-semibold text-slate-500">Set {session.set + 1} of {exercise.sets}{exercise.reps > 0 ? ` · ${exercise.reps} demonstrations` : ` · ${exercise.durationSec}s`}</p>
        <p className="mt-2 text-center text-4xl font-bold tabular-nums sm:text-5xl" aria-live="polite">{session.phase === "paused" ? "Paused" : labelFor(session.phase, waiting)} {session.phase === "paused" ? "" : clock}</p>
        {exercise.reps > 0 && <p className="mt-2 text-center text-xs text-slate-500">The figure demonstrates the set. It does not verify your repetitions.</p>}
        {waiting && <button type="button" onClick={() => { const step = finishEffort(session, exercise); patch(step.session, step.session.afterRest === "exercise" ? session.exercise : null); }} className="mt-4 w-full rounded-xl bg-brand py-3 text-sm font-semibold text-navy">I finished this set</button>}
        {session.phase === "resting" && <button type="button" onClick={() => patch({ ...session, remaining: session.remaining + 30 })} className="mt-4 w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold">Add 30 seconds of rest</button>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => patch(session.phase === "paused" ? { ...session, phase: session.resume ?? "exercising", resume: null } : { ...session, phase: "paused", resume: session.phase })} className="rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white">{session.phase === "paused" ? "Resume" : "Pause"}</button>
          <button type="button" onClick={() => patch({ ...session, set: 0, phase: "countdown", remaining: 3, shownReps: 0, resume: null })} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold">Restart</button>
          <button type="button" onClick={() => patch(next ? { ...startSession(session.day), exercise: session.exercise + 1 } : { ...session, phase: "completed" })} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold">Skip</button>
          <button type="button" onClick={() => { keep.current = false; onChange({ ...saved, session: null }); }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500">End workout</button>
        </div>
      </section>
    </div>
  );
}

function markDone(saved: SavedPlan, exercise: number): number[][] {
  const done = saved.done.map((list) => [...list]);
  const day = saved.session?.day ?? 0;
  if (!done[day]?.includes(exercise)) done[day] = [...(done[day] ?? []), exercise];
  return done;
}

function dose(item: PlanExercise): string {
  const work = item.reps > 0 ? `${item.reps} reps` : `${item.durationSec}s`;
  return `${item.sets} × ${work} · ${item.restSec}s rest`;
}

function labelFor(phase: Session["phase"], waiting: boolean): string {
  if (waiting) return "Set ready";
  if (phase === "countdown") return "Get ready";
  if (phase === "resting") return "Rest";
  if (phase === "exercising") return "Go";
  return "";
}

function TrainerFrame({ move, paused }: { move: Parameters<typeof Trainer>[0]["move"]; paused: boolean }) {
  return (
    <Suspense fallback={<div className="grid h-64 place-items-center bg-navy text-sm text-slate-300 sm:h-80 md:h-[42vh] md:max-h-[480px]">Loading 3D trainer…</div>}>
      <Trainer move={move} paused={paused} />
    </Suspense>
  );
}

function Header() {
  return (
    <div>
      <p className="text-sm font-semibold text-brand-ink">TRAINING</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">This week</h1>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="card p-4">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-sm font-semibold">{label}</p>
      <p className="text-xs text-slate-500">{note}</p>
    </div>
  );
}
