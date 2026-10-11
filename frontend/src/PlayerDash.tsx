import { adherence, formatWhen, latestAssessment, SKILL_LABEL, trainingPlan, trendDelta, type Athlete } from "./model";
import { useStore } from "./store";
import Analyze from "./Analyze";
import TrainingBoard from "./Training";
import { Avatar, RadarChart, Shell, SkillBars, SystemPanel, TrendChart, ratingOf } from "./ui";

type Section = "overview" | "analyze" | "training" | "system";

const sections = [
  { id: "overview", label: "Overview", icon: "chart" },
  { id: "analyze", label: "Analyze", icon: "search" },
  { id: "training", label: "Training", icon: "target" },
  { id: "system", label: "System", icon: "clock" },
];

export default function PlayerDash({
  athleteId,
  section,
  onSection,
  onSwitch,
  onExit,
}: {
  athleteId: number;
  section: Section;
  onSection: (section: Section) => void;
  onSwitch: () => void;
  onExit: () => void;
}) {
  const { athletes, loadWarning } = useStore();
  const athlete = athletes.find((item) => item.id === athleteId) ?? athletes[0];
  return (
    <Shell dock label="Player" section={section} sections={sections} onSection={(id) => onSection(id as Section)} onExit={onExit} warning={loadWarning}>
      <button type="button" onClick={onSwitch} className="mb-6 text-sm font-semibold text-slate-500 hover:text-brand">Switch player</button>
      {section === "overview" && <Overview athlete={athlete} />}
      {section === "analyze" && <Analyze athlete={athlete} onTraining={() => onSection("training")} />}
      {section === "training" && <TrainingBoard athlete={athlete} />}
      {section === "system" && <SystemPanel />}
    </Shell>
  );
}

function Overview({ athlete }: { athlete: Athlete }) {
  const latest = latestAssessment(athlete);
  const rating = ratingOf(athlete);
  const delta = trendDelta(athlete);
  const plan = trainingPlan(athlete);
  const done = plan.filter((item) => item.done).length;
  return (
    <div className="mx-auto max-w-6xl">
      <section className="relative overflow-hidden rounded-3xl bg-navy p-6 text-white sm:p-8">
        <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-5">
            <Avatar athlete={athlete} large />
            <div>
              <p className="text-sm text-blue-200">Welcome back</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">{athlete.name}</h1>
              <p className="mt-1 text-sm text-slate-400">#{athlete.number} · {athlete.position} · {athlete.grade}</p>
            </div>
          </div>
          <div className="flex gap-7 border-t border-white/10 pt-5 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
            <div>
              <p className="text-3xl font-bold tabular-nums">{rating}</p>
              <p className="text-xs text-slate-400">Overall rating</p>
            </div>
            <div>
              <p className={`text-3xl font-bold tabular-nums ${delta !== null && delta < 0 ? "text-rose-300" : "text-emerald-300"}`}>{delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta}`}</p>
              <p className="text-xs text-slate-400">Since last evaluation</p>
            </div>
          </div>
        </div>
      </section>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <p className="text-sm font-semibold text-brand">How am I performing?</p>
          <h2 className="mt-1 font-bold">Latest skill profile</h2>
          <p className="mt-1 text-sm text-slate-500">Updated {formatWhen(latest.recordedAt)} · prototype roster until a coach saves a new evaluation</p>
          <div className="mt-5"><RadarChart skills={latest.skills} /></div>
        </section>
        <section className="card p-6">
          <p className="text-sm font-semibold text-brand">What is my coach saying?</p>
          <h2 className="mt-1 font-bold">Latest evaluation</h2>
          <div className="mt-5 space-y-4 text-sm leading-6">
            <Note label="Strength" text={latest.strengths} />
            <Note label="To improve" text={latest.weaknesses} />
            <Note label="Priority" text={latest.priorities} />
          </div>
          {athlete.assessments.length > 1 && (
            <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Feedback history</p>
              {[...athlete.assessments].slice(0, -1).reverse().map((item) => (
                <div key={item.id}>
                  <p className="text-xs text-slate-400">{formatWhen(item.recordedAt)}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.priorities || item.weaknesses || "No note saved."}</p>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="card p-6">
          <p className="text-sm font-semibold text-brand">What should I work on?</p>
          <h2 className="mt-1 font-bold">This cycle</h2>
          <p className="mt-1 text-sm text-slate-500">Built from the three lowest saved ratings. Not an AI recommendation.</p>
          <ul className="mt-5 space-y-3">
            {plan.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 px-3 py-3">
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-xs text-slate-500">{SKILL_LABEL[item.skill]} · {item.minutes} min</p>
                </div>
                <span className={`text-xs font-semibold ${item.done ? "text-emerald-700" : "text-slate-400"}`}>{item.done ? "Done" : "Open"}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-6">
          <p className="text-sm font-semibold text-brand">Am I improving?</p>
          <h2 className="mt-1 font-bold">Rating history and training</h2>
          <div className="mt-4"><TrendChart athlete={athlete} /></div>
          <p className="mt-4 text-sm text-slate-600"><span className="font-bold text-navy">{done} of {plan.length}</span> exercises done since {formatWhen(latest.recordedAt)} · {adherence(athlete)}% of this cycle</p>
          <div className="mt-3"><SkillBars skills={latest.skills} /></div>
        </section>
      </div>
    </div>
  );
}

function Note({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-slate-700">{text || "No note saved."}</p>
    </div>
  );
}

