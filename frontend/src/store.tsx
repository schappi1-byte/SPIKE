import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { addAssessment, type Athlete, type Lineup, type LineupDraft } from "./model";
import type { PlayerAnalysis } from "./analysis";
import type { SavedPlan } from "./trainingPlan";

const DRAFT_KEY = "spike-lineup-draft-v1";

export type DraftInput = {
  skills: Athlete["assessments"][number]["skills"];
  strengths: string;
  weaknesses: string;
  priorities: string;
};

export type StoredAnalysis = { athleteId: number; sourceRecordedAt: string; generatedAt: string; analysis: PlayerAnalysis };
export type StoredPlan = SavedPlan & { planId: number };
export type Account = { role: "coach" | "player"; name: string; athleteId: number | null };

type Dashboard = {
  account: Account;
  team: { name: string; season: number };
  athletes: Athlete[];
  analyses: Record<number, StoredAnalysis>;
  plans: Record<number, StoredPlan>;
  lineups: Lineup[];
};

/** `signed-out` sends people to the login page; `unavailable` means the server or database could not answer. */
export type Status = "loading" | "ready" | "signed-out" | "unavailable";

type StoreState = Dashboard & { status: Status; draft: LineupDraft; loadWarning: string | null };

type StoreValue = StoreState & {
  refresh: () => Promise<void>;
  /** Resolves to an error message, or null once saved. */
  saveAssessment: (athleteId: number, input: DraftInput) => Promise<string | null>;
  setAnalysis: (item: StoredAnalysis) => void;
  setPlan: (athleteId: number, plan: StoredPlan) => void;
  setDraft: (draft: LineupDraft) => void;
  saveDraft: () => Promise<string | null>;
  loadLineup: (id: string) => void;
  deleteLineup: (id: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const StoreContext = createContext<StoreValue | null>(null);

function blankDraft(): LineupDraft {
  return { sourceId: null, name: "4-2 rotation 1", formation: "4-2", rotation: 1, slots: [null, null, null, null, null, null] };
}

function readDraft(): LineupDraft {
  if (typeof localStorage === "undefined") return blankDraft();
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null") as LineupDraft | null;
    return draft && Array.isArray(draft.slots) && draft.slots.length === 6 ? draft : blankDraft();
  } catch {
    return blankDraft();
  }
}

const EMPTY: Dashboard = { account: { role: "player", name: "", athleteId: null }, team: { name: "", season: 0 }, athletes: [], analyses: {}, plans: {}, lineups: [] };

async function call(path: string, init?: RequestInit): Promise<{ ok: true; body: unknown } | { ok: false; status: number; error: string }> {
  let response: Response;
  try {
    response = await fetch(path, { credentials: "same-origin", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  } catch {
    return { ok: false, status: 0, error: "The server could not be reached. Check your connection and try again." };
  }
  const body: unknown = await response.json().catch(() => null);
  if (response.ok) return { ok: true, body };
  const error = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "The server could not complete that request.";
  return { ok: false, status: response.status, error };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoreState>(() => ({ ...EMPTY, status: "loading", draft: readDraft(), loadWarning: null }));

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(state.draft));
    } catch {
      // The draft still works for this visit if storage is unavailable.
    }
  }, [state.draft]);

  const apply = useCallback((dashboard: Dashboard) => {
    setState((current) => {
      const ids = new Set(dashboard.athletes.map((athlete) => athlete.id));
      const slots = current.draft.slots.map((id) => (id != null && ids.has(id) ? id : null));
      const sourceId = dashboard.lineups.some((lineup) => lineup.id === current.draft.sourceId) ? current.draft.sourceId : null;
      return { ...current, ...dashboard, status: "ready", loadWarning: null, draft: { ...current.draft, slots, sourceId } };
    });
  }, []);

  const refresh = useCallback(async () => {
    const result = await call("/api/dashboard");
    if (result.ok) {
      apply(result.body as Dashboard);
      return;
    }
    setState((current) => {
      if (result.status === 401) return { ...current, ...EMPTY, status: "signed-out", loadWarning: null };
      if (current.status === "ready") return { ...current, loadWarning: `Could not refresh: ${result.error}` };
      return { ...current, status: "unavailable", loadWarning: result.error };
    });
  }, [apply]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<StoreValue>(() => {
    const playerIdOf = (athleteId: number | null) => state.athletes.find((athlete) => athlete.id === athleteId)?.playerId ?? null;
    return {
      ...state,
      refresh,
      saveAssessment: async (athleteId, input) => {
        const athlete = state.athletes.find((item) => item.id === athleteId);
        if (!athlete?.playerId) return "That player could not be found. Refresh and try again.";
        if (addAssessment(athlete, input) === athlete) return "This matches the latest evaluation.";
        const result = await call("/api/evaluations", {
          method: "POST",
          body: JSON.stringify({ playerId: athlete.playerId, skills: input.skills, strengths: input.strengths.trim(), weaknesses: input.weaknesses.trim(), priorities: input.priorities.trim() }),
        });
        if (!result.ok) return result.error;
        apply(result.body as Dashboard);
        return null;
      },
      setAnalysis: (item) => setState((current) => ({ ...current, analyses: { ...current.analyses, [item.athleteId]: item } })),
      setPlan: (athleteId, plan) => setState((current) => ({ ...current, plans: { ...current.plans, [athleteId]: plan } })),
      setDraft: (draft) => setState((current) => ({ ...current, draft })),
      saveDraft: async () => {
        const { draft } = state;
        const result = await call("/api/lineups", {
          method: "POST",
          body: JSON.stringify({ id: draft.sourceId, name: draft.name.trim() || "Untitled lineup", formation: draft.formation, rotation: draft.rotation, slots: draft.slots.map(playerIdOf) }),
        });
        if (!result.ok) return result.error;
        const dashboard = result.body as Dashboard;
        const saved = draft.sourceId ?? dashboard.lineups[0]?.id ?? null;
        apply(dashboard);
        setState((current) => ({ ...current, draft: { ...current.draft, sourceId: saved } }));
        return null;
      },
      loadLineup: (id) => {
        setState((current) => {
          const lineup = current.lineups.find((item) => item.id === id);
          if (!lineup) return current;
          return {
            ...current,
            draft: { sourceId: lineup.id, name: lineup.name, formation: lineup.formation, rotation: lineup.rotation, slots: [...lineup.slots] },
          };
        });
      },
      deleteLineup: async (id) => {
        const result = await call(`/api/lineups?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!result.ok) return result.error;
        apply(result.body as Dashboard);
        return null;
      },
      signOut: async () => {
        await call("/api/session", { method: "DELETE" });
        setState((current) => ({ ...current, ...EMPTY, status: "signed-out", loadWarning: null }));
      },
    };
  }, [state, refresh, apply]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside StoreProvider");
  return value;
}
