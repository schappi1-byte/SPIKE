# messaging — agent instructions

This is a [Spectrum](https://photon.codes/docs/spectrum-ts) app, pinned to `spectrum-ts@^12.10.1`. The entry point is `src/index.ts`, which configures the iMessage provider and runs the SPIKE texting agent. It imports server code from `../lib`, shared types from the repo root's `lib/`, and resolves `@supabase/supabase-js` and `@google/genai` from the repo root's `node_modules`.

## Working in this project

- Run the app with `npm run start`.
- Add providers by importing them in `src/index.ts` and listing them in the `Spectrum({ providers: [...] })` config.
- Outgoing message content uses the builders documented in the skill (text, attachment, voice, contact, richlink, poll, group, custom).

## Environment

This project reads secrets from `../.env.local`, which is `backend/.env.local` (gitignored). **Do not read, write, or echo `.env.local`** — it contains credentials.

If startup fails with an authentication error, tell the user to verify their `SPECTRUM_PROJECT_ID` / `SPECTRUM_PROJECT_SECRET` at the [Photon dashboard](https://app.photon.codes).

## Spectrum SDK reference

This project includes the `spectrum` skill from [`photon-hq/skills`](https://github.com/photon-hq/skills). Your agent should auto-discover it. If it doesn't, or if you switch agents, install for your agent with:

```sh
npx skills add photon-hq/skills --skill spectrum --agent <your-agent>
```

(Use `--agent '*'` to install for all supported agents.)

## Managing the Spectrum Cloud project (CLI)

If this app uses a platform provider, the `SPECTRUM_PROJECT_ID` / `SPECTRUM_PROJECT_SECRET` in `../.env.local` belong to a **Spectrum Cloud** project. To manage that project from the terminal — authenticate, rotate the secret, list the line(s) you send from, manage platforms/users, or create more projects — use the `photon-cli` skill (the `photon` CLI) from [`photon-hq/skills`](https://github.com/photon-hq/skills):

```sh
npx skills add photon-hq/skills --skill photon-cli --agent <your-agent>
```

(Use `--agent '*'` to install for all supported agents.)

Common tasks once it's installed:

- `photon whoami` — confirm you're authenticated (run `photon login` if not).
- `photon projects regenerate-secret` — rotate the Spectrum API secret (then update `SPECTRUM_PROJECT_SECRET` in `../.env.local`).
- `photon spectrum lines list` — see the line(s) your app sends from.
- `photon projects show` — inspect the active project (set `PHOTON_PROJECT_ID`, or pass `--project <id>`).

## See also

- [Spectrum docs](https://photon.codes/docs/spectrum-ts)
- [`spectrum-ts` on GitHub](https://github.com/photon-hq/spectrum-ts)
