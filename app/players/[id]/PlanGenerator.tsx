"use client";

import { useState } from "react";
import { useCoachPasscode } from "@/components/useCoachPasscode";
import type { TrainingPlan } from "@/lib/types";

interface Props {
  playerId: string;
  exerciseNames: Record<string, string>;
  initialPlan: TrainingPlan | null;
  initialCreatedAt: string | null;
}

export function PlanGenerator({ playerId, exerciseNames, initialPlan, initialCreatedAt }: Props) {
  const [passcode, setPasscode] = useCoachPasscode();
  const [plan, setPlan] = useState(initialPlan);
  const [createdAt, setCreatedAt] = useState(initialCreatedAt);
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/training-plan", {
        method: "POST",
        headers: { "content-type": "application/json", "x-coach-passcode": passcode },
        body: JSON.stringify({ player_id: playerId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not generate a plan.");
      setPlan(body.plan);
      setCreatedAt(body.created_at);
      setSource(body.source);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate a plan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <div className="row">
        <input type="password" placeholder="Coach passcode" value={passcode} onChange={(e) => setPasscode(e.target.value)} />
        <button onClick={generate} disabled={loading || !passcode}>
          {loading ? "Generating…" : plan ? "Generate a new plan" : "Generate plan"}
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}

      {plan ? (
        <div className="plan" style={{ marginTop: 16 }}>
          <p>
            <span className="pill" style={{ textTransform: "capitalize" }}>
              Focus: {plan.focus_skill}
            </span>{" "}
            {createdAt ? <span className="muted">Created {new Date(createdAt).toLocaleString()}</span> : null}
            {source === "fallback" ? <span className="muted"> · Built without Gemini</span> : null}
          </p>
          <p>{plan.reason}</p>
          <ol>
            {plan.sessions.map((s, i) => (
              <li key={i}>
                <strong>
                  {s.day}: {exerciseNames[s.exercise_id] ?? s.exercise_id}
                </strong>{" "}
                <span className="muted">
                  {s.duration_minutes} min · {s.reps} reps
                </span>
                <div>{s.coaching_cue}</div>
              </li>
            ))}
          </ol>
          <p className="muted">If this player has texts turned on, the SPIKE messaging service texts them this plan.</p>
        </div>
      ) : (
        <p className="muted">No plan yet. Generating one uses this player&apos;s stats, ratings, coach feedback, and completed drills.</p>
      )}
    </div>
  );
}
