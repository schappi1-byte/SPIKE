export const SYSTEM = {
  persistence: "Evaluations, feedback, training completions, and saved lineups stay in this browser.",
  roster: "The starting roster is prototype data, not a live academy feed.",
  services: [
    { name: "Gemini", state: "Server endpoint", detail: "The player Analyze page calls /api/analyze. A recommendation is shown only when Gemini returns it. The server reads GEMINI_API_KEY and does not send that key to the browser." },
    { name: "Snowflake", state: "Not connected", detail: "History is the assessments stored on this device." },
    { name: "MediaPipe", state: "Not connected", detail: "No camera or pose tracking is running." },
    { name: "Lineup optimizer", state: "Not connected", detail: "Suggest placement ranks athletes by the skill each spot needs. It does not run an optimizer." },
  ],
} as const;
