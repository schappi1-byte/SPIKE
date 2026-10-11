import { useEffect, useState } from "react";
import Coach from "./Coach";
import Landing from "./Landing";
import PlayerDash from "./PlayerDash";
import { useStore } from "./store";
import { Avatar, Icon } from "./ui";

type CoachSection = "overview" | "evaluate" | "lineup" | "system";
type PlayerSection = "overview" | "analyze" | "training" | "system";
type View = "landing" | "pick" | "coach" | "player";

const PLAYER_SECTIONS: PlayerSection[] = ["overview", "analyze", "training", "system"];
type Intent = "coach" | "player";

function readHash(): { intent: Intent; athleteId: number | null; section: PlayerSection } | null {
  const hash = window.location.hash;
  if (hash === "#/coach") return { intent: "coach", athleteId: null, section: "overview" };
  if (hash === "#/player") return { intent: "player", athleteId: null, section: "overview" };
  const match = hash.match(/^#\/player\/(\d+)\/(overview|analyze|training|system)$/);
  if (!match) return null;
  const section = match[2] as PlayerSection;
  return { intent: "player", athleteId: Number(match[1]), section: PLAYER_SECTIONS.includes(section) ? section : "overview" };
}

function logIn(intent: Intent) {
  window.location.href = `/login?next=${encodeURIComponent(`/#/${intent}`)}`;
}

export default function App() {
  const { athletes, account, status, loadWarning } = useStore();
  const [view, setView] = useState<View>("landing");
  const [athleteId, setAthleteId] = useState(1);
  const [coachSection, setCoachSection] = useState<CoachSection>("overview");
  const [playerSection, setPlayerSection] = useState<PlayerSection>("overview");
  const [intent, setIntent] = useState(readHash);
  const [notice, setNotice] = useState<string | null>(null);
  const exit = () => setView("landing");

  useEffect(() => {
    if (!intent || status === "loading") return;
    setIntent(null);
    if (status === "signed-out") {
      if (window.location.hash) window.history.replaceState(null, "", window.location.pathname + window.location.search);
      return;
    }
    if (status === "unavailable") {
      setNotice(loadWarning ?? "The dashboard is unavailable right now. Try again in a moment.");
      return;
    }
    if (athletes.length === 0) {
      setNotice("No players are loaded for your team yet. Ask your coach to load the roster.");
      return;
    }
    if (intent.intent === "coach") {
      if (account.role !== "coach") {
        setNotice(`You're signed in as ${account.name}, a player. Use the Player button to open your dashboard.`);
        return;
      }
      setCoachSection("overview");
      setView("coach");
      return;
    }
    if (account.role === "player") {
      if (account.athleteId == null || !athletes.some((athlete) => athlete.id === account.athleteId)) {
        setNotice("Your login isn't linked to a player on the roster. Ask your coach.");
        return;
      }
      setAthleteId(account.athleteId);
      setPlayerSection(intent.section);
      setView("player");
      return;
    }
    if (intent.athleteId != null && athletes.some((athlete) => athlete.id === intent.athleteId)) {
      setAthleteId(intent.athleteId);
      setPlayerSection(intent.section);
      setView("player");
      return;
    }
    setView("pick");
  }, [intent, status, account, athletes, loadWarning]);

  useEffect(() => {
    if (status === "signed-out") setView("landing");
  }, [status]);

  useEffect(() => {
    if (view !== "player") {
      if (window.location.hash.startsWith("#/")) window.history.replaceState(null, "", window.location.pathname + window.location.search);
      return;
    }
    const next = `#/player/${athleteId}/${playerSection}`;
    if (window.location.hash !== next) window.history.replaceState(null, "", next);
  }, [view, athleteId, playerSection]);

  // Dashboards need a loaded roster; anything else (signed out, loading, failed) shows the landing page.
  const screen: View = status === "ready" && athletes.length > 0 ? view : "landing";

  function choose(next: Intent) {
    setNotice(null);
    if (status === "signed-out") return logIn(next);
    setIntent({ intent: next, athleteId: null, section: "overview" });
  }

  if (screen === "coach") {
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

  if (screen === "player") {
    return (
      <PlayerDash
        athleteId={athleteId}
        section={playerSection}
        onSection={setPlayerSection}
        onSwitch={account.role === "coach" ? () => setView("pick") : null}
        onExit={exit}
      />
    );
  }

  if (screen === "pick") {
    return (
      <main className="min-h-screen bg-canvas">
        <header className="border-b border-slate-200/80 bg-white">
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-end px-5">
            <button type="button" onClick={exit} className="rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-600">Exit</button>
          </div>
        </header>
        <div className="mx-auto max-w-5xl px-5 py-10">
          <button type="button" onClick={exit} className="mb-8 flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-brand-ink"><Icon name="back" className="size-4" /> Back to home</button>
          <p className="text-sm font-semibold text-brand-ink">PLAYER PORTAL</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Who is checking in?</h1>
          <p className="mt-2 text-slate-500">Choose a player to open their dashboard. Ratings and feedback are the same records you save as coach.</p>
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

  return <Landing onCoach={() => choose("coach")} onPlayer={() => choose("player")} notice={notice ?? (intent && status === "loading" ? "Checking your login…" : null)} />;
}
