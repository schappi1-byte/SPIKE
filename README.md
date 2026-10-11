# SPIKE
AI-powered volleyball coaching with lineup optimization, personalized training plans, and real-time team rotations.

| Page | What it does |
| --- | --- |
| `/` | Real UNC 2026 roster with per-set stats |
| `/players/[id]` | Season stats, skill ratings derived from them, stats-based feedback, drill progress, and a Gemini training plan |
| `/lineup` | 4–2 lineup built from skill ratings and hitting efficiency, all six rotations, and a button to send one to the live court |
| `/live` | Court that updates on every device when the coach sends a rotation |
| `/insights` | UNC's stats in wins vs losses, a published study on what wins matches, and the 13-match log |
| `/signup`, `/login` | Each player and coach gets their own login: pick your name, use your own passcode |
| `/chat` | Team chat plus a private chat between each player and the coaches. Coach messages also go out by iMessage. |

Anyone can view the roster, lineup, live court, and insights. Chat needs a login, and only coaches can generate plans or send rotations.

Players sign up with `TEAM_JOIN_CODE` and pick their name from the roster; each name can be claimed once. Coaches sign up with `COACH_PASSCODE`. Under the hood each login is a Supabase Auth user with a hidden `<username>@spike.local` email, so no email is ever sent.

## Layout

| Path | What's in it |
| --- | --- |
| `app/`, `components/` | Website pages and API routes. Vercel builds these. |
| `lib/` | Types and volleyball logic shared by the website and backend |
| `backend/.env.local` | Every key. Not committed. [.env.example](.env.example) lists them. |
| `backend/lib/` | Server-only code: Supabase clients, data queries, Gemini, logins |
| `backend/supabase/` | Database schema migrations |
| `backend/data/` | Real UNC Chapel Hill 2026 data and research benchmarks, with sources. See [backend/data/README.md](backend/data/README.md). |
| `backend/scripts/` | Build the CSVs from sources (`npm run data:build`), load them, link a phone number to a player |
| `backend/messaging/` | iMessage service that texts players. See [backend/messaging/README.md](backend/messaging/README.md). |

All keys stay on the server. The browser only talks to this app's own API routes, never to Supabase, Gemini, or Photon directly.

## Setup

1. Install and fill in keys:

   ```sh
   npm install
   ```

   Fill in `backend/.env.local`. [.env.example](.env.example) lists every key and where to find it.

2. Create the tables and load the UNC Chapel Hill data:

   ```sh
   npx supabase login
   npm run db:link
   npm run db:push
   npm run db:seed
   ```

   `db:link` asks for your Supabase database password.

3. Run the site:

   ```sh
   npm run dev
   ```

   Open http://localhost:3000 and sign up. Coaches need `COACH_PASSCODE`; players need `TEAM_JOIN_CODE`.

4. Optional, to text players: `npm run messaging`. See [backend/messaging/README.md](backend/messaging/README.md).

## Deploying

Vercel runs the site. In the Vercel project's environment variables, set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `COACH_PASSCODE`, and `TEAM_JOIN_CODE`, and set the framework preset to Next.js. The `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` names that the Supabase–Vercel integration creates also work. Never give `SUPABASE_SECRET_KEY` a `NEXT_PUBLIC_` prefix.

The Spectrum and `REMINDER_HOUR` keys belong to the `backend/messaging/` service, which runs outside Vercel.

In Supabase's GitHub integration, set the working directory to `backend`. After that, any new file in `backend/supabase/migrations/` runs against the production database when it's merged into `main`.
