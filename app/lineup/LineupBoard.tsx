"use client";

import Link from "next/link";
import { useState } from "react";
import { Court } from "@/components/Court";
import { useCoachPasscode } from "@/components/useCoachPasscode";
import type { Position } from "@/lib/types";
import { courtSlots, POSITION_NAMES, type RotationPlan } from "@/lib/volleyball";

export interface PlayerInfo {
  name: string;
  position: Position;
}

interface Props {
  teamId: string;
  plan: RotationPlan;
  players: Record<string, PlayerInfo>;
}

export function LineupBoard({ teamId, plan, players }: Props) {
  const [rotation, setRotation] = useState(1);
  const [passcode, setPasscode] = useCoachPasscode();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);

  const cells = courtSlots(plan, rotation).map((slot) => {
    const player = players[slot.onCourtPlayerId];
    const subbedFor = slot.onCourtPlayerId !== slot.rotationPlayerId ? players[slot.rotationPlayerId]?.name : null;
    const role = player ? POSITION_NAMES[player.position] : "";
    return {
      courtPosition: slot.courtPosition,
      name: player?.name ?? slot.onCourtPlayerId,
      detail: subbedFor ? `${role}, in for ${subbedFor}` : slot.isFrontRowSetter ? `${role}, setting` : role,
      highlight: slot.isFrontRowSetter,
    };
  });

  async function pushLive() {
    setPushing(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/live-rotation", {
        method: "POST",
        headers: { "content-type": "application/json", "x-coach-passcode": passcode },
        body: JSON.stringify({ team_id: teamId, rotation_number: rotation }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not update the live court.");
      setStatus(`Rotation ${rotation} is live.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the live court.");
    } finally {
      setPushing(false);
    }
  }

  return (
    <div className="panel">
      <div className="rotation-tabs">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <button key={n} className={n === rotation ? "active" : ""} onClick={() => setRotation(n)}>
            Rotation {n}
          </button>
        ))}
      </div>

      <Court cells={cells} />
      <p className="muted">Outlined: the setter running the offense this rotation.</p>

      <div className="row" style={{ marginTop: 16 }}>
        <input type="password" placeholder="Coach passcode" value={passcode} onChange={(e) => setPasscode(e.target.value)} />
        <button onClick={pushLive} disabled={pushing || !passcode}>
          {pushing ? "Updating…" : `Send rotation ${rotation} to the live court`}
        </button>
        <Link href="/live">Open live court →</Link>
      </div>
      {status ? <p style={{ color: "var(--good)" }}>{status} Players with texts on get their new position.</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
