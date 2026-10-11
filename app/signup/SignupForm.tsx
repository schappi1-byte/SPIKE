"use client";

import { useActionState, useState } from "react";
import { signUp, type FormState } from "@/app/auth-actions";

interface Props {
  players: { player_id: string; label: string }[];
}

export function SignupForm({ players }: Props) {
  const [role, setRole] = useState<"player" | "coach">("player");
  const [state, action, pending] = useActionState<FormState, FormData>(signUp, { error: null });

  return (
    <form key={state.attempt} action={action} className="panel form">
      <div className="rotation-tabs" role="tablist">
        <button type="button" className={role === "player" ? "active" : ""} onClick={() => setRole("player")}>
          I&apos;m a player
        </button>
        <button type="button" className={role === "coach" ? "active" : ""} onClick={() => setRole("coach")}>
          I&apos;m a coach
        </button>
      </div>
      <input type="hidden" name="role" value={role} />

      {role === "player" ? (
        <>
          <label>
            Team join code
            <input key="join-code" name="code" required autoComplete="off" placeholder="Your coach has it" defaultValue={state.values?.code} />
          </label>
          <label>
            Your name
            {players.length === 0 ? (
              <span className="muted">Every player on the roster already has an account.</span>
            ) : (
              <select name="player_id" required defaultValue={state.values?.player_id ?? ""}>
                <option value="" disabled>
                  Choose yourself from the roster
                </option>
                {players.map((p) => (
                  <option key={p.player_id} value={p.player_id}>
                    {p.label}
                  </option>
                ))}
              </select>
            )}
          </label>
        </>
      ) : (
        <>
          <label>
            Coach code
            <input key="coach-code" name="code" type="password" required autoComplete="off" />
          </label>
          <label>
            Your name
            <input name="name" required minLength={2} maxLength={60} placeholder="Coach Smith" autoComplete="name" defaultValue={state.values?.name} />
          </label>
        </>
      )}

      <label>
        Choose a passcode
        <input type="password" name="passcode" required minLength={6} maxLength={72} autoComplete="new-password" />
        <span className="muted">At least 6 characters. You&apos;ll use it every time you log in.</span>
      </label>
      <label>
        Type it again
        <input type="password" name="confirm" required minLength={6} maxLength={72} autoComplete="new-password" />
      </label>

      {state.error ? <p className="error">{state.error}</p> : null}
      <button type="submit" disabled={pending || (role === "player" && players.length === 0)}>
        {pending ? "Creating your account…" : "Sign up"}
      </button>
    </form>
  );
}
