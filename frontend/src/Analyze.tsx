import { useEffect, useRef, useState } from "react";
import { requestAnalysis, skillDelta, type Recommendation, type SavedAnalysis } from "./analysis";
import { formatWhen, latestAssessment, sameTime, SKILL_KEYS, SKILL_LABEL, type Athlete, type SkillKey } from "./model";
import { useStore } from "./store";
import { ratingOf } from "./ui";

const STEPS = ["Sending the latest evaluation…", "Waiting for Gemini…"];

export default function Analyze({ athlete, onTraining }: { athlete: Athlete; onTraining: () => void }) {
  const latest = latestAssessment(athlete);
  const previous = athlete.assessments.length > 1 ? athlete.assessments[athlete.assessments.length - 2].skills : null;
  const ranked = [...SKILL_KEYS].sort((a, b) => latest.skills[b] - latest.skills[a] || SKILL_LABEL[a].localeCompare(SKILL_LABEL[b]));
  const { analyses, setAnalysis, refresh } = useStore();
  const stored: SavedAnalysis | null = analyses[athlete.id] ?? null;
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const stale = stored != null && stored.athleteId === athlete.id && !sameTime(stored.sourceRecordedAt, latest.recordedAt);

  useEffect(() => {
    request.current += 1;
    setError(null);
    setLoading(false);
  }, [athlete.id]);

  useEffect(() => {
    if (!loading) return;
    setStep(0);
    const id = window.setInterval(() => setStep((current) => Math.min(current + 1, STEPS.length - 1)), 1600);
    return () => window.clearInterval(id);
  }, [loading]);

  async function run() {
    const ticket = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const next = await requestAnalysis(athlete);
      if (request.current !== ticket) return;
      setAnalysis(next);
      await refresh();
    } catch (caught) {
      if (request.current !== ticket) return;
      setError(caught instanceof Error ? caught.message : "Gemini could not complete the analysis.");
    } finally {
      if (request.current === ticket) setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <section className="card p-6">
        <p className="text-sm font-semibold text-brand-ink">ANALYZE</p>
        <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{athlete.name}</h1>
            <p className="mt-1 text-sm text-slate-500">#{athlete.number} · {athlete.position} · {athlete.grade}</p>
          </div>
          <div>
            <p className="text-3xl font-bold tabular-nums">{ratingOf(athlete)}</p>
            <p className="text-xs text-slate-500">Overall rating</p>
          </div>
        </div>
      </section>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="font-bold">Latest coach feedback</h2>
          <p className="mt-1 text-sm text-slate-500">Saved {formatWhen(latest.recordedAt)}</p>
          <div className="mt-4 space-y-3 text-sm leading-6">
            <p><span className="font-semibold">Strengths. </span>{latest.strengths || "No note saved."}</p>
            <p><span className="font-semibold">To improve. </span>{latest.weaknesses || "No note saved."}</p>
            <p><span className="font-semibold">Priority. </span>{latest.priorities || "No note saved."}</p>
          </div>
        </section>
        <section className="card p-6">
          <h2 className="font-bold">Skill trends</h2>
          <p className="mt-1 text-sm text-slate-500">From saved evaluations{previous ? `, since ${formatWhen(athlete.assessments[athlete.assessments.length - 2].recordedAt)}` : ""}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <SkillList title="Strongest" skills={ranked.slice(0, 3)} ratings={latest.skills} previous={previous} />
            <SkillList title="Weakest" skills={[...ranked.slice(-3)].reverse()} ratings={latest.skills} previous={previous} />
          </div>
          <ul className="mt-4 space-y-2">
            {SKILL_KEYS.map((key) => {
              const delta = skillDelta(latest.skills, previous, key);
              return (
                <li key={key} className="flex items-center justify-between text-sm">
                  <span>{SKILL_LABEL[key]}</span>
                  <span className="font-semibold tabular-nums">{latest.skills[key]} <span className={delta != null && delta < 0 ? "text-rose-600" : "text-slate-500"}>{delta == null ? "· no earlier evaluation" : `${delta > 0 ? "+" : ""}${delta}`}</span></span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
      <div className="mt-6">
        <button type="button" onClick={run} disabled={loading} className="w-full rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-navy hover:bg-brand-light disabled:opacity-60 sm:w-auto">
          {loading ? "Analyzing…" : error ? "Try again" : "Analyze My Performance"}
        </button>
        {loading && <p className="mt-3 text-sm font-medium text-slate-600" role="status">{STEPS[step]}</p>}
        {error && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">{error}</p>}
        {stale && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">Your coach saved a newer evaluation. This analysis is outdated and should be run again.</p>}
      </div>
      {stored ? <Results stored={stored} onTraining={onTraining} /> : <p className="mt-6 text-sm text-slate-500">Run Analyze My Performance to request a Gemini review of this evaluation.</p>}
    </div>
  );
}

function SkillList({ title, skills, ratings, previous }: { title: string; skills: SkillKey[]; ratings: Athlete["assessments"][number]["skills"]; previous: Athlete["assessments"][number]["skills"] | null }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <ul className="mt-2 space-y-1">
        {skills.map((key) => {
          const delta = skillDelta(ratings, previous, key);
          return <li key={key} className="text-sm font-semibold">{SKILL_LABEL[key]} · {ratings[key]}{delta == null ? "" : ` (${delta > 0 ? "+" : ""}${delta})`}</li>;
        })}
      </ul>
    </div>
  );
}

function Results({ stored, onTraining }: { stored: SavedAnalysis; onTraining: () => void }) {
  const { analysis } = stored;
  const generated = new Date(stored.generatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return (
    <div className="mt-6 space-y-6">
      <p className="text-sm text-slate-500">Generated {generated} from the {formatWhen(stored.sourceRecordedAt)} evaluation</p>
      <section className="card p-6">
        <h2 className="font-bold">Performance summary</h2>
        <p className="mt-3 text-sm leading-6 text-slate-700">{analysis.summary}</p>
      </section>
      <Section title="Priority improvements" items={analysis.priorities} />
      <Section title="Volleyball drills" items={analysis.drills} />
      <Section title="Gym exercises" items={analysis.gym} />
      <Section title="Improvement goals" items={analysis.goals} />
      <button type="button" onClick={onTraining} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-navy hover:border-brand hover:text-brand-ink">Go to Training</button>
    </div>
  );
}

function Section({ title, items }: { title: string; items: Recommendation[] }) {
  return (
    <section className="card p-6">
      <h2 className="font-bold">{title}</h2>
      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <article key={`${title}-${item.skill}-${item.title}`} className="rounded-xl border border-slate-100 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-ink">{item.skill}</p>
            <h3 className="mt-1 font-bold">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-700"><span className="font-semibold">Why. </span>{item.explanation}</p>
            <p className="mt-1 text-sm leading-6 text-slate-700"><span className="font-semibold">How. </span>{item.instructions}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600"><span className="font-semibold">Amount. </span>{item.dosage}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600"><span className="font-semibold">Purpose. </span>{item.purpose}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
