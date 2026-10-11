"use client";

import { useEffect, useState } from "react";
import { Court } from "@/components/Court";
import type { CourtPosition, LiveRotationRow, Position } from "@/lib/types";
import { POSITION_NAMES } from "@/lib/volleyball";

const POLL_MS = 2000;

interface Props {
  teamId: string;
  initialRows: LiveRotationRow[];
  players: Record<string, { name: string; position: Position }>;
}

export function LiveCourt({ teamId, initialRows, players }: Props) {
  const [rows, setRows] = useState(initialRows);
  const [connected, setConnected] = useState(true);
  const [me, setMe] = useState("");

  useEffect(() => {
    setMe(window.localStorage.getItem("spike-player-id") ?? "");
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/live-rotation?team_id=${encodeURIComponent(teamId)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { rows: LiveRotationRow[] };
        if (!cancelled) {
          setRows(body.rows);
          setConnected(true);
        }
      } catch {
        if (!cancelled) setConnected(false);
      }
    };
    const timer = setInterval(refresh, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [teamId]);

  const rotation = rows[0]?.rotation_number;
  const updatedAt = rows.reduce<string | null>((latest, r) => (!latest || r.updated_at > latest ? r.updated_at : latest), null);
  const cells = rows.map((r) => {
    const player = players[r.player_id];
    return {
      courtPosition: r.court_position as CourtPosition,
      name: player?.name ?? r.player_id,
      detail: player ? POSITION_NAMES[player.position] : "",
      highlight: r.player_id === me,
    };
  });

  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <strong>{rotation ? `Rotation ${rotation}` : "No rotation sent yet"}</strong>
          {updatedAt ? <span className="muted"> · updated {new Date(updatedAt).toLocaleTimeString()}</span> : null}
        </div>
        <span className="pill" style={{ color: connected ? "var(--good)" : "var(--warn)" }}>
          {connected ? "Live" : "Reconnecting…"}
        </span>
      </div>

      <Court cells={cells} />

      <div className="row" style={{ marginTop: 16 }}>
        <label className="muted" htmlFor="me">
          Highlight me:
        </label>
        <select
          id="me"
          value={me}
          onChange={(e) => {
            setMe(e.target.value);
            window.localStorage.setItem("spike-player-id", e.target.value);
          }}
          style={{ background: "var(--panel-2)", color: "var(--text)", border: "1px solid var(--line)", borderRadius: 8, padding: 8 }}
        >
          <option value="">Nobody</option>
          {Object.entries(players).map(([id, p]) => (
            <option key={id} value={id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
