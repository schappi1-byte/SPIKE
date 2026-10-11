import assert from "node:assert/strict";
import test from "node:test";
import { finishEffort, readTrainingPlan, startSession, tickSession, type PlanExercise } from "./trainingPlan.ts";

const move = (patch: Partial<PlanExercise> = {}): PlanExercise => ({
  name: "Bodyweight squat",
  skill: "Blocking",
  animation: "squat",
  sets: 2,
  reps: 4,
  durationSec: 0,
  restSec: 20,
  instructions: "Sit to a comfortable depth and stand tall.",
  difficulty: "moderate",
  phase: "work",
  ...patch,
});

function week(exercises: PlanExercise[]) {
  return { goal: "Quicker first step", days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((name) => ({ name, exercises })) };
}

test("a training plan keeps supported animations and rejects a day without a warm-up", () => {
  const exercises = [move({ phase: "warmup", animation: "arm-raise" as const, name: "Arm circles" }), move(), move({ phase: "cooldown", animation: "none", reps: 0, durationSec: 30, name: "Easy walk" })];
  const parsed = readTrainingPlan(week([{ ...exercises[1], animation: "burpee" as PlanExercise["animation"] }, ...exercises.slice(0, 1), exercises[2]]));
  assert.equal(parsed?.days[0].exercises[1].animation, "none");
  assert.equal(parsed?.days[0].exercises[0].phase, "warmup");
  assert.equal(readTrainingPlan(week([move(), move(), move({ phase: "cooldown" })])), null);
});

test("countdown, rest, and the last set move the workout forward", () => {
  const session = startSession(0);
  const started = tickSession(session, move(), null, 3);
  assert.equal(started.session.phase, "exercising");
  const demonstrated = tickSession(started.session, move(), null, 1.6);
  assert.equal(Math.floor(demonstrated.session.shownReps), 1);
  const resting = finishEffort({ ...started.session, set: 1, shownReps: 4 }, move());
  assert.equal(resting.session.phase, "resting");
  assert.equal(resting.session.afterRest, "exercise");
  const done = tickSession(resting.session, move(), null, 20);
  assert.equal(done.session.phase, "completed");
  assert.equal(done.finished, true);
  const between = finishEffort(started.session, move());
  assert.equal(between.session.phase, "resting");
  const nextSet = tickSession(between.session, move(), move({ name: "Next" }), 20);
  assert.equal(nextSet.session.set, 1);
  assert.equal(nextSet.session.phase, "exercising");
});
