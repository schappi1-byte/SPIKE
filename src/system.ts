export const SYSTEM = {
  persistence: "Evaluations, feedback, training completions, and saved lineups stay in this browser.",
  roster: "The starting roster is prototype data, not a live academy feed.",
  services: [
    { name: "Gemini", state: "Not connected", detail: "Priorities and training come from the saved ratings. Nothing on screen is an AI response." },
    { name: "Snowflake", state: "Not connected", detail: "History is the assessments stored on this device." },
    { name: "MediaPipe", state: "Not connected", detail: "No camera or pose tracking is running." },
    { name: "Lineup optimizer", state: "Not connected", detail: "Suggest placement ranks athletes by the skill each spot needs. It does not run an optimizer." },
  ],
} as const;
