import assert from "node:assert/strict";
import test from "node:test";
import { coachPlayer } from "./gemini.ts";

const ANALYSIS = { analysis: true, plan: false };
const PLAN = { analysis: false, plan: true };
const gemini = (value: unknown) => async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] }));

const skills = { serve: 80, pass: 62, set: 70, attack: 88, block: 74, defense: 66 };

const payload = {
  player: { name: "Maya Chen", position: "Outside Hitter", grade: "11th", number: 7 },
  evaluations: [
    { recordedAt: "2026-05-10T12:00:00.000Z", skills: { ...skills, pass: 58 }, strengths: "Approach", weaknesses: "Platform", priorities: "Passing" },
    { recordedAt: "2026-05-24T12:00:00.000Z", skills, strengths: "Attack", weaknesses: "Passing under pressure", priorities: "Passing" },
  ],
};

const item = {
  skill: "Passing",
  title: "Platform to target",
  explanation: "Passing is the lowest recent rating.",
  instructions: "Pass tossed balls to a setter target.",
  dosage: "3 sets of 15",
  purpose: "Raise the passing rating with a repeatable platform.",
};

const analysis = {
  summary: "Passing is the main gap. Attack is the strongest skill in the saved ratings.",
  priorities: [item, item, { ...item, skill: "Defense" }],
  drills: [item],
  gym: [{ ...item, title: "Split squat", dosage: "3 sets of 8" }],
  goals: [{ ...item, title: "Passing 70", dosage: "Two weeks" }],
};

test("missing Gemini key returns a configuration error", async () => {
  const result = await coachPlayer(payload, ANALYSIS, { apiKey: "  " });
  assert.equal(result.status, 503);
  assert.equal("error" in result.body && result.body.error.includes("GEMINI_API_KEY"), true);
});

test("invalid player data is rejected before calling Gemini", async () => {
  let called = false;
  const result = await coachPlayer({ player: { name: "A" } }, ANALYSIS, {
    apiKey: "secret-key",
    fetchImpl: async () => {
      called = true;
      return new Response("{}");
    },
  });
  assert.equal(result.status, 400);
  assert.equal(called, false);
});

test("Gemini failures stay on the server and hide the key", async () => {
  const result = await coachPlayer(payload, ANALYSIS, {
    apiKey: "secret-key",
    fetchImpl: async () => new Response(JSON.stringify({ error: { message: "quota exceeded for secret-key" } }), { status: 429 }),
  });
  assert.equal(result.status, 502);
  assert.equal(JSON.stringify(result.body).includes("secret-key"), false);
  assert.equal("error" in result.body && result.body.error.includes("quota"), true);
});

test("a structured Gemini response is returned unchanged in meaning", async () => {
  let url = "";
  let header = "";
  const result = await coachPlayer(payload, ANALYSIS, {
    apiKey: "secret-key",
    fetchImpl: async (input, init) => {
      url = String(input);
      header = String(new Headers(init?.headers).get("x-goog-api-key"));
      assert.equal(String(init?.body).includes("Passing 62"), true);
      assert.equal(String(init?.body).includes("secret-key"), false);
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(analysis) }] } }] }));
    },
  });
  assert.equal(result.status, 200);
  assert.equal(url.includes("secret-key"), false);
  assert.equal(header, "secret-key");
  assert.equal("analysis" in result.body && result.body.analysis.priorities.length, 3);
});

test("a training plan without a key does not call Gemini", async () => {
  const result = await coachPlayer(payload, PLAN, { apiKey: "" });
  assert.equal(result.status, 503);
});

test("an unsupported training animation is not returned as a real movement", async () => {
  const names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const exercise = { name: "Squat", skill: "Blocking", animation: "burpee", sets: 2, reps: 8, durationSec: 0, restSec: 30, instructions: "Sit and stand.", difficulty: "moderate", phase: "work" };
  const plan = {
    goal: "Quicker block step",
    days: names.map((name) => ({ name, exercises: [{ ...exercise, phase: "warmup", animation: "arm-raise", name: "Arm raise" }, exercise, { ...exercise, phase: "cooldown", animation: "none", reps: 0, durationSec: 30, name: "Walk" }] })),
  };
  const result = await coachPlayer(payload, PLAN, {
    apiKey: "secret-key",
    fetchImpl: async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(plan) }] } }] })),
  });
  assert.equal(result.status, 200);
  assert.equal("plan" in result.body && result.body.plan.days[0].exercises.some((item) => item.animation === "none"), true);
  assert.equal("plan" in result.body && JSON.stringify(result.body).includes("burpee"), false);
});

test("incomplete Gemini JSON is not turned into an analysis", async () => {
  const result = await coachPlayer(payload, ANALYSIS, {
    apiKey: "secret-key",
    fetchImpl: async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "{\"summary\":\"Only a summary\"}" }] } }] })),
  });
  assert.equal(result.status, 502);
  assert.equal("analysis" in result.body, false);
});

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const move = { name: "Squat", skill: "Blocking", animation: "squat", sets: 2, reps: 8, durationSec: 0, restSec: 30, instructions: "Sit and stand.", difficulty: "easy", phase: "work" };
const week = { goal: "Quicker block step", days: days.map((name) => ({ name, exercises: [{ ...move, phase: "warmup" }, move, { ...move, phase: "cooldown" }] })) };

test("one request returns both the analysis and the week plan", async () => {
  let calls = 0;
  let config: Record<string, unknown> = {};
  const result = await coachPlayer(payload, { analysis: true, plan: true }, {
    apiKey: "secret-key",
    fetchImpl: async (_input, init) => {
      calls += 1;
      config = JSON.parse(String(init?.body)).generationConfig;
      return gemini({ analysis, plan: week })();
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.status, 200);
  assert.equal("analysis" in result.body && result.body.analysis?.priorities.length, 3);
  assert.equal("plan" in result.body && result.body.plan?.days.length, 7);
  assert.deepEqual(config.thinkingConfig, { thinkingBudget: 0 });
  assert.equal(typeof config.maxOutputTokens, "number");
});

test("a plan-only request sends the saved analysis instead of asking for a new one", async () => {
  let prompt = "";
  const result = await coachPlayer({ ...payload, analysis }, PLAN, {
    apiKey: "secret-key",
    fetchImpl: async (_input, init) => {
      prompt = JSON.parse(String(init?.body)).contents[0].parts[0].text;
      return gemini(week)();
    },
  });
  assert.equal(result.status, 200);
  assert.equal(prompt.includes("Saved Gemini analysis: Passing is the main gap"), true);
  assert.equal(prompt.includes("Return exactly 3 priority skills"), false);
});
