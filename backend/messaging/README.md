# SPIKE messaging

Texts players over iMessage through [Photon Spectrum](https://photon.codes/docs/spectrum-ts).

- When the coach sends a rotation to the live court, every on-court player with texts on gets their new position.
- When a coach generates a training plan, that player gets it by text.
- Once a day at `REMINDER_HOUR`, players with unfinished drills get a reminder.
- Players can text the line:

| Text | Reply |
| --- | --- |
| `ROTATION` | Their current court position |
| `PLAN` | Their latest training plan, or a new one |
| `DRILLS` | Drills they haven't finished |
| `STOP` / `START` | Turn texts off or on |
| `HELP` | The command list |
| Anything else | A coaching answer from Gemini, based on their stats, ratings, feedback, and drills |

Only phone numbers saved in `player_contacts` with texts turned on get messages. Everyone else is told to ask their coach.

## Setup

1. Install the root project first, because this service uses its Supabase and Gemini packages. From the repo root:

   ```sh
   npm install && npm --prefix backend/messaging install
   ```

2. Fill in `SPECTRUM_PROJECT_SECRET` in `backend/.env.local`, from your project Settings on the [Photon dashboard](https://app.photon.codes). `SPECTRUM_PROJECT_ID` is already set. This service reads every key from `../.env.local`.

3. Link a phone to a player, from the repo root:

   ```sh
   npm run contact:add -- unc-w-01 +15551234567
   ```

4. Start it from the repo root and leave it running:

   ```sh
   npm run messaging
   ```

Text `HELP` to the line from the linked phone.

## Hosting

This is a long-running process, not a web request, so it doesn't run on Vercel. Keep it running on your laptop for a demo, or deploy it to an always-on host such as Railway, Render, or Fly.io with the same environment variables.
