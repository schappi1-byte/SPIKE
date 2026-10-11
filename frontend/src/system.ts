export const SYSTEM = {
  persistence: "Evaluations, feedback, Gemini analyses, training plans and progress, and saved lineups are saved in the team database through the SPIKE server.",
  roster: "The roster, season stats, and starting ratings come from the UNC Chapel Hill data loaded into the database. Starting ratings are generated from 2026 season stats until a coach saves an evaluation.",
  services: [
    { name: "Gemini", state: "Server endpoint", detail: "Analyze and Training call /api/analyze and /api/training. The server builds the request from saved evaluations, reads GEMINI_API_KEY, and never sends that key to the browser. Saved results are reused until a newer evaluation is saved, one request makes both the analysis and the week, and each player gets at most 4 requests a day." },
    { name: "Supabase", state: "Connected", detail: "Evaluation history, ratings, feedback, plans, lineups, logins, and team chat are stored in Supabase." },
    { name: "MediaPipe", state: "Not connected", detail: "No camera or pose tracking is running." },
    { name: "Lineup optimizer", state: "Not connected", detail: "Suggest placement ranks athletes by the skill each spot needs. It does not run an optimizer." },
  ],
} as const;
