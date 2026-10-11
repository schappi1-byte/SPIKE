import { useEffect, useState } from "react";
import Coach from "./Coach";
import Landing from "./Landing";
import PlayerDash from "./PlayerDash";
import { useStore } from "./store";
import { Avatar, Icon, Logo } from "./ui";

type CoachSection = "overview" | "evaluate" | "lineup" | "system";
type PlayerSection = "overview" | "analyze" | "training" | "system";
type View = "landing" | "pick" | "coach" | "player";

const PLAYER_SECTIONS: PlayerSection[] = ["overview", "analyze", "training", "system"];

function readPlayerHash(athleteIds: number[]): { athleteId: number; section: PlayerSection } | null {
  const match = window.location.hash.match(/^#\/player\/(\d+)\/(overview|analyze|training|system)$/);
  if (!match) return null;
  const athleteId = Number(match[1]);
  const section = match[2] as PlayerSection;
  if (!athleteIds.includes(athleteId) || !PLAYER_SECTIONS.includes(section)) return null;
  return { athleteId, section };
}

export default function App() {
  const { athletes } = useStore();
  const restored = readPlayerHash(athletes.map((athlete) => athlete.id));
  const [view, setView] = useState<View>(restored ? "player" : "landing");
  const [athleteId, setAthleteId] = useState(restored?.athleteId ?? athletes[0]?.id ?? 1);
  const [coachSection, setCoachSection] = useState<CoachSection>("overview");
  const [playerSection, setPlayerSection] = useState<PlayerSection>(restored?.section ?? "overview");
  const exit = () => setView("landing");

  useEffect(() => {
    if (view !== "player") {
      if (window.location.hash.startsWith("#/player/")) window.history.replaceState(null, "", window.location.pathname + window.location.search);
      return;
    }
    const next = `#/player/${athleteId}/${playerSection}`;
    if (window.location.hash !== next) window.history.replaceState(null, "", next);
  }, [view, athleteId, playerSection]);

  if (view === "coach") {
    return (
      <Coach
        section={coachSection}
        athleteId={athleteId}
        onSection={setCoachSection}
        onAthlete={setAthleteId}
        onOpenPlayer={() => { setPlayerSection("overview"); setView("player"); }}
        onExit={exit}
      />
    );
  }

  if (view === "player") {
    return (
      <PlayerDash
        athleteId={athleteId}
        section={playerSection}
        onSection={setPlayerSection}
        onSwitch={() => setView("pick")}
        onExit={exit}
      />
    );
  }

  if (view === "pick") {
    return (
      <main className="min-h-screen bg-canvas">
        <header className="border-b border-slate-200/80 bg-white">
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
            <Logo onClick={exit} />
            <button type="button" onClick={exit} className="rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-600">Exit</button>
          </div>
        </header>
        <div className="mx-auto max-w-5xl px-5 py-10">
          <button type="button" onClick={exit} className="mb-8 flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-brand-ink"><Icon name="back" className="size-4" /> Back to home</button>
          <p className="text-sm font-semibold text-brand-ink">PLAYER PORTAL</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Who is checking in?</h1>
          <p className="mt-2 text-slate-500">Choose a profile. Ratings and feedback are the same records the coach saves.</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {athletes.map((athlete) => (
              <button key={athlete.id} type="button" onClick={() => { setAthleteId(athlete.id); setPlayerSection("overview"); setView("player"); }} className="card flex items-center gap-4 p-4 text-left hover:border-brand/40">
                <Avatar athlete={athlete} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{athlete.name}</span>
                  <span className="mt-0.5 block text-sm text-slate-500">#{athlete.number} · {athlete.position}</span>
                </span>
                <Icon name="arrow" className="size-4 text-slate-300" />
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return <Landing onCoach={() => { setCoachSection("overview"); setView("coach"); }} onPlayer={() => setView("pick")} />;
}
