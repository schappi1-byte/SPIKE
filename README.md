# SPIKE
AI-powered volleyball coaching with lineup optimization, personalized training plans, and real-time team rotations.

| Page | What it does |
| --- | --- |
| `/` | Team roster with per-set stats |
| `/players/[id]` | Stats, skill ratings, coach feedback, drill progress, and a Gemini training plan |
| `/lineup` | 4–2 lineup built from skill ratings, all six rotations, and a button to send one to the live court |
| `/live` | Court that updates on every device when the coach sends a rotation |

## Layout

| Path | What's in it |
| --- | --- |
| `app/`, `components/` | Website pages and API routes. Vercel builds these. |
| `lib/` | Types and volleyball logic shared by the website and backend |
| `backend/.env.local` | Every key. Not committed. [.env.example](.env.example) lists them. |
| `backend/lib/` | Server-only code: Supabase clients, data queries, Gemini, coach passcode check |
| `backend/supabase/` | Database schema migrations |
| `backend/data/` | UNC Chapel Hill seed data. See [backend/data/README.md](backend/data/README.md). |
| `backend/scripts/` | Load the seed data, link a phone number to a player |
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

   Open http://localhost:3000. Generating plans and sending rotations asks for `COACH_PASSCODE`.

4. Optional, to text players: `npm run messaging`. See [backend/messaging/README.md](backend/messaging/README.md).

## Deploying

Vercel runs the site. In the Vercel project's environment variables, set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, and `COACH_PASSCODE`, and set the framework preset to Next.js. Add them by hand: the Supabase–Vercel integration creates `NEXT_PUBLIC_` variables, which this app doesn't use.

The Spectrum and `REMINDER_HOUR` keys belong to the `backend/messaging/` service, which runs outside Vercel.

In Supabase's GitHub integration, set the working directory to `backend`. After that, any new file in `backend/supabase/migrations/` runs against the production database when it's merged into `main`.
