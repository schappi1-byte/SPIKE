import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { addAssessment, markSession, type Athlete, type Exercise, type Lineup, type LineupDraft } from "./model";
import { prototypeAthletes } from "./seed";

const STORAGE_KEY = "spike-athlete-store-v1";

export type DraftInput = {
  skills: Athlete["assessments"][number]["skills"];
  strengths: string;
  weaknesses: string;
  priorities: string;
};

type Persisted = {
  athletes: Athlete[];
  lineups: Lineup[];
  draft: LineupDraft;
};

type StoreState = Persisted & { loadWarning: string | null };

type StoreValue = StoreState & {
  saveAssessment: (athleteId: number, input: DraftInput) => boolean;
  completeExercise: (athleteId: number, exercise: Exercise) => void;
  setDraft: (draft: LineupDraft) => void;
  saveDraft: () => void;
  loadLineup: (id: string) => void;
  deleteLineup: (id: string) => void;
};

const StoreContext = createContext<StoreValue | null>(null);

function blankDraft(): LineupDraft {
  return { sourceId: null, name: "4-2 rotation 1", formation: "4-2", rotation: 1, slots: [null, null, null, null, null, null] };
}

function prototypeState(): Persisted {
  return { athletes: prototypeAthletes(), lineups: [], draft: blankDraft() };
}

function readState(): StoreState {
  if (typeof localStorage === "undefined") return { ...prototypeState(), loadWarning: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...prototypeState(), loadWarning: null };
    const parsed = JSON.parse(raw) as Persisted;
    if (!Array.isArray(parsed.athletes) || parsed.athletes.length === 0 || !parsed.draft) {
      return { ...prototypeState(), loadWarning: "Saved data was empty, so the prototype roster was loaded." };
    }
    return { athletes: parsed.athletes, lineups: parsed.lineups ?? [], draft: parsed.draft, loadWarning: null };
  } catch {
    return { ...prototypeState(), loadWarning: "Saved data could not be read, so the prototype roster was loaded." };
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoreState>(readState);

  useEffect(() => {
    const payload: Persisted = { athletes: state.athletes, lineups: state.lineups, draft: state.draft };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [state]);

  const value = useMemo<StoreValue>(() => {
    return {
      ...state,
      saveAssessment: (athleteId, input) => {
        const athlete = state.athletes.find((item) => item.id === athleteId);
        if (!athlete) return false;
        const now = new Date().toISOString();
        const next = addAssessment(athlete, input, now);
        if (next === athlete) return false;
        setState((current) => ({
          ...current,
          athletes: current.athletes.map((item) => (item.id === athleteId ? addAssessment(item, input, now) : item)),
        }));
        return true;
      },
      completeExercise: (athleteId, exercise) => {
        setState((current) => ({
          ...current,
          athletes: current.athletes.map((athlete) => (athlete.id === athleteId ? markSession(athlete, exercise) : athlete)),
        }));
      },
      setDraft: (draft) => setState((current) => ({ ...current, draft })),
      saveDraft: () => {
        setState((current) => {
          const savedAt = new Date().toISOString();
          if (current.draft.sourceId) {
            return {
              ...current,
              lineups: current.lineups.map((lineup) =>
                lineup.id === current.draft.sourceId
                  ? { ...lineup, name: current.draft.name.trim() || lineup.name, formation: current.draft.formation, rotation: current.draft.rotation, slots: [...current.draft.slots], savedAt }
                  : lineup,
              ),
            };
          }
          const id = `lineup-${savedAt}`;
          const lineup: Lineup = {
            id,
            name: current.draft.name.trim() || "Untitled lineup",
            formation: current.draft.formation,
            rotation: current.draft.rotation,
            slots: [...current.draft.slots],
            savedAt,
          };
          return { ...current, lineups: [...current.lineups, lineup], draft: { ...current.draft, sourceId: id } };
        });
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
      deleteLineup: (id) => {
        setState((current) => ({
          ...current,
          lineups: current.lineups.filter((lineup) => lineup.id !== id),
          draft: current.draft.sourceId === id ? { ...current.draft, sourceId: null } : current.draft,
        }));
      },
    };
  }, [state]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside StoreProvider");
  return value;
}
