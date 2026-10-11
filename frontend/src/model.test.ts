import assert from "node:assert/strict";
import test from "node:test";
import { addAssessment, adherence, advanceSlots, attentionReason, lineupNotes, moveOnCourt, rating, scoreLineup, setterSpotIndices, spotFit, suggestSlots, trainingPlan, trendDelta, withRotation, type Athlete, type Skills } from "./model.ts";

const skills: Skills = { serve: 80, pass: 70, set: 60, attack: 90, block: 50, defense: 40 };

function athlete(extra?: Partial<Athlete>): Athlete {
  return {
    id: 1,
    name: "Maya Chen",
    initials: "MC",
    number: 7,
    position: "Outside Hitter",
    grade: "Senior",
    attendance: 96,
    color: "bg-blue-100 text-blue-700",
    sessions: [],
    assessments: [
      {
        id: "a1",
        recordedAt: "2026-05-24T16:00:00.000Z",
        skills,
        strengths: "Attack",
        weaknesses: "Block",
        priorities: "Close the block",
      },
    ],
    ...extra,
  };
}

test("rating is the rounded mean of the rated skills", () => {
  assert.equal(rating(athlete().assessments[0]), 65);
  assert.equal(rating({ ...athlete().assessments[0], unrated: ["serve", "attack"] }), 55);
  assert.equal(rating({ ...athlete().assessments[0], unrated: ["serve", "pass", "set", "attack", "block", "defense"] }), null);
});

test("an athlete with no ratings has no trend and is flagged, not scored", () => {
  const unrated = athlete({ assessments: [{ ...athlete().assessments[0], unrated: ["serve", "pass", "set", "attack", "block", "defense"] }] });
  assert.equal(attentionReason(unrated), "No ratings yet");
  assert.equal(spotFit(unrated, ["attack", "block"]), null);
  const next = addAssessment(unrated, { skills, strengths: "A", weaknesses: "B", priorities: "C" }, "2026-05-28T16:00:00.000Z");
  assert.equal(trendDelta(next), null);
});

test("training plan is the assigned exercises", () => {
  assert.deepEqual(trainingPlan(athlete()), []);
  assert.equal(adherence(athlete()), null);
  const assignments = [
    { id: "ex-001:2026-09-15", skill: "pass" as const, title: "Wall Passing", detail: "", minutes: 10, done: true },
    { id: "ex-004:2026-09-29", skill: "serve" as const, title: "Target Serving", detail: "", minutes: 15, done: false },
  ];
  assert.equal(adherence(athlete({ assignments })), 50);
  const next = addAssessment(athlete(), { skills: { ...skills, defense: 95 }, strengths: "Attack", weaknesses: "Block", priorities: "Close the block" }, "2026-05-28T16:00:00.000Z");
  assert.equal(trendDelta(next), rating(next.assessments[1]!)! - 65);
});

test("an unchanged evaluation does not add a record", () => {
  const current = athlete();
  assert.equal(addAssessment(current, { skills, strengths: "Attack", weaknesses: "Block", priorities: "Close the block" }), current);
});

test("suggest placement assigns six different athletes", () => {
  const roster = ["Setter", "Outside Hitter", "Middle Blocker", "Opposite", "Libero", "Defensive Specialist"].map((position, index) =>
    athlete({ id: index + 1, position, name: position }),
  );
  const slots = suggestSlots(roster, "5-1");
  assert.equal(slots.length, 6);
  assert.equal(new Set(slots).size, 6);
});

test("lineup scores average the skills each spot asks for", () => {
  const roster = [1, 2, 3, 4, 5, 6].map((id) => athlete({ id, name: `Player ${id}` }));
  const scored = scoreLineup([1, 2, 3, 4, 5, 6], 1, roster);
  assert.equal(scored.current, 64);
  assert.equal(scored.front, 69);
  assert.equal(scored.back, 59);
  assert.equal(scored.overall, 64);
  assert.equal(scored.best.score, 64);
  assert.equal(scored.weakest.score, 64);
  const partly = roster.map((item) => ({ ...item, assessments: [{ ...item.assessments[0], unrated: ["attack" as const] }] }));
  assert.equal(scoreLineup([1, 2, 3, 4, 5, 6], 1, partly).front, 55);
});

test("court moves swap occupants and 4-2 setters stay opposite", () => {
  assert.deepEqual(moveOnCourt([1, 2, null, null, null, null], 1, 1), [2, 1, null, null, null, null]);
  assert.deepEqual(setterSpotIndices("4-2", 1), [0, 5]);
  assert.deepEqual(setterSpotIndices("4-2", 2), [1, 4]);
  const notes = lineupNotes([1, null, null, null, null, null], "4-2", 1, [athlete()]);
  assert.equal(notes.includes("Missing player"), true);
  assert.equal(notes.includes("Invalid setter for 4-2"), true);
});

test("rotation moves the server from position 1 to position 6", () => {
  const slots = advanceSlots([null, null, null, null, null, 7], 1);
  assert.equal(slots[4], 7);
  const draft = withRotation({ sourceId: null, name: "A", formation: "4-2", rotation: 1, slots: [null, null, null, null, null, 7] }, 2);
  assert.equal(draft.rotation, 2);
  assert.equal(draft.slots[4], 7);
});
