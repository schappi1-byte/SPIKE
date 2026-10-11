import assert from "node:assert/strict";
import test from "node:test";
import { addAssessment, advanceSlots, lineupNotes, markSession, moveOnCourt, overall, scoreLineup, setterSpotIndices, suggestSlots, trainingPlan, trendDelta, withRotation, type Athlete, type Skills } from "./model.ts";

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

test("overall is the rounded mean of the six skills", () => {
  assert.equal(overall(skills), 65);
});

test("training plan uses the three lowest skills and ignores an older session", () => {
  const plan = trainingPlan(athlete());
  assert.deepEqual(plan.map((item) => item.skill), ["defense", "block", "set"]);
  const done = markSession(athlete(), plan[0], "2026-05-26T18:00:00.000Z");
  assert.equal(trainingPlan(done)[0].done, true);
  const next = addAssessment(done, { skills: { ...skills, defense: 95 }, strengths: "Attack", weaknesses: "Block", priorities: "Close the block" }, "2026-05-28T16:00:00.000Z");
  assert.equal(trainingPlan(next).some((item) => item.skill === "defense"), false);
  assert.equal(trendDelta(next), overall(next.assessments[1].skills) - overall(skills));
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
