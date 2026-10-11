import { useEffect, useState } from "react";
import Coach from "./Coach";
import Landing from "./Landing";
import PlayerDash from "./PlayerDash";
import { useStore } from "./store";
import { Avatar, Icon } from "./ui";

type CoachSection = "overview" | "evaluate" | "lineup" | "system";
type PlayerSection = "overview" | "analyze" | "training" | "system";
type CoachView = "coach" | "player" | "pick";

function readHash(): { athleteId: number; section: PlayerSection } | null {
  const match = window.location.hash.match(/^#\/player\/(\d+)\/(overview|analyze|training|system)$/);
  return match ? { athleteId: Number(match[1]), section: match[2] as PlayerSection } : null;
}

const go = (path: string) => () => { window.location.href = path; };

export default function App() {
  const { athletes, account, status, loadWarning, signOut } = useStore();
  const [initial] = useState(readHash);
  const [coachView, setCoachView] = useState<CoachView>(() => (initial ? "player" : "coach"));
  const [athleteId, setAthleteId] = useState(initial?.athleteId ?? 1);
  const [coachSection, setCoachSection] = useState<CoachSection>("overview");
  const [playerSection, setPlayerSection] = useState<PlayerSection>(initial?.section ?? "overview");

  const isCoach = account.role === "coach";
  const ownAthlete = athletes.find((athlete) => athlete.id === account.athleteId);
  const coachTarget = athletes.some((athlete) => athlete.id === athleteId) ? coachView : coachView === "player" ? "coach" : coachView;
  const screen = status !== "ready" || athletes.length === 0 ? null : isCoach ? coachTarget : ownAthlete ? "player" : null;
  const shownAthleteId = isCoach ? athleteId : ownAthlete?.id ?? 0;

  useEffect(() => {
    const next = screen === "player" ? `#/player/${shownAthleteId}/${playerSection}` : "";
    if (window.location.hash !== next) window.history.replaceState(null, "", window.location.pathname + window.location.search + next);
  }, [screen, shownAthleteId, playerSection]);

  if (screen === "coach") {
    return (
      <Coach
        section={coachSection}
        athleteId={athleteId}
        onSection={setCoachSection}
        onAthlete={setAthleteId}
        onOpenPlayer={() => { setPlayerSection("overview"); setCoachView("player"); }}
      />
    );
  }

  if (screen === "player") {
    return (
      <PlayerDash
        athleteId={shownAthleteId}
        section={playerSection}
        onSection={setPlayerSection}
        onSwitch={isCoach ? () => setCoachView("pick") : null}
        onBack={isCoach ? () => setCoachView("coach") : null}
      />
    );
  }

  if (screen === "pick") {
    return (
      <main className="min-h-screen bg-canvas">
        <div className="mx-auto max-w-5xl px-5 py-10">
          <button type="button" onClick={() => setCoachView("coach")} className="mb-8 flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-brand-ink"><Icon name="back" className="size-4" /> Back to coach dashboard</button>
          <p className="text-sm font-semibold text-brand-ink">PLAYER DASHBOARDS</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Whose dashboard do you want to see?</h1>
          <p className="mt-2 text-slate-500">You see exactly what each player sees on their own dashboard.</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {athletes.map((athlete) => (
              <button key={athlete.id} type="button" onClick={() => { setAthleteId(athlete.id); setPlayerSection("overview"); setCoachView("player"); }} className="card flex items-center gap-4 p-4 text-left hover:border-brand/40">
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

  if (status === "loading") return <Landing notice="Opening your dashboard…" />;
  if (status === "signed-out") return <Landing actions={[{ label: "Log in", onClick: go("/login") }, { label: "Sign up", onClick: go("/signup"), secondary: true }]} />;

  const signOutAction = [{ label: "Sign out", onClick: () => void signOut(), secondary: true }];
  if (status === "unavailable") return <Landing notice={loadWarning ?? "The dashboard is unavailable right now. Try again in a moment."} actions={signOutAction} />;
  if (athletes.length === 0) return <Landing notice="No players are loaded for your team yet. Ask your coach to load the roster." actions={signOutAction} />;
  return <Landing notice="Your login isn't linked to a player on the roster. Ask your coach." actions={signOutAction} />;
}
