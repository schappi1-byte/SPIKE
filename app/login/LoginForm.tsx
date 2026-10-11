"use client";

import { useActionState } from "react";
import { logIn, type FormState } from "@/app/auth-actions";
import type { Role } from "@/lib/types";

interface Props {
  accounts: { username: string; display_name: string; role: Role }[];
  next: string;
}

export function LoginForm({ accounts, next }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(logIn, { error: null });
  const coaches = accounts.filter((a) => a.role === "coach");
  const players = accounts.filter((a) => a.role === "player");

  return (
    <form key={state.attempt} action={action} className="panel form">
      <input type="hidden" name="next" value={next} />
      <label>
        Name
        <select name="username" required defaultValue={state.values?.username ?? ""}>
          <option value="" disabled>
            Choose your name
          </option>
          {coaches.length > 0 ? (
            <optgroup label="Coaches">
              {coaches.map((a) => (
                <option key={a.username} value={a.username}>
                  {a.display_name}
                </option>
              ))}
            </optgroup>
          ) : null}
          {players.length > 0 ? (
            <optgroup label="Players">
              {players.map((a) => (
                <option key={a.username} value={a.username}>
                  {a.display_name}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
      </label>
      <label>
        Passcode
        <input type="password" name="passcode" required autoComplete="current-password" />
      </label>
      {state.error ? <p className="error">{state.error}</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
