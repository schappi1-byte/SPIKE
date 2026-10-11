import { trainingPlan, type Athlete, type Skills } from "./model";

type Seed = {
  id: number;
  name: string;
  initials: string;
  number: number;
  position: string;
  grade: string;
  attendance: number;
  color: string;
  serve: number;
  attack: number;
  block: number;
  trend: number;
  strengths: string;
  weaknesses: string;
  priorities: string;
  done: number;
};

const ROSTER: Seed[] = [
  { id: 1, name: "Maya Chen", initials: "MC", number: 7, position: "Outside Hitter", grade: "Senior", attendance: 96, color: "bg-blue-100 text-blue-700", serve: 88, attack: 92, block: 74, trend: 6, done: 1, strengths: "Attack contact stays high through the last step.", weaknesses: "The block step starts after the hitter is in the air.", priorities: "Close the block before the opposing outside leaves the ground." },
  { id: 2, name: "Sofia Reyes", initials: "SR", number: 12, position: "Setter", grade: "Junior", attendance: 100, color: "bg-violet-100 text-violet-700", serve: 91, attack: 72, block: 68, trend: 8, done: 3, strengths: "Tempo to the middle is consistent in system.", weaknesses: "Out-of-system sets drift off the pin.", priorities: "Hold the same release point on second-ball sets." },
  { id: 3, name: "Avery Brooks", initials: "AB", number: 3, position: "Libero", grade: "Senior", attendance: 94, color: "bg-amber-100 text-amber-700", serve: 84, attack: 65, block: 61, trend: 4, done: 0, strengths: "First contact is calm under a deep serve.", weaknesses: "The platform opens early on seam balls.", priorities: "Keep the platform together through the seam pass." },
  { id: 4, name: "Jordan Kim", initials: "JK", number: 18, position: "Middle Blocker", grade: "Sophomore", attendance: 97, color: "bg-emerald-100 text-emerald-700", serve: 79, attack: 86, block: 94, trend: 9, done: 2, strengths: "Block reach and timing against the quick are strong.", weaknesses: "Transition footwork is wide after the block.", priorities: "Land the block and open to the setter in one step." },
  { id: 5, name: "Taylor Morgan", initials: "TM", number: 5, position: "Opposite", grade: "Junior", attendance: 91, color: "bg-rose-100 text-rose-700", serve: 86, attack: 89, block: 82, trend: 3, done: 0, strengths: "The back-row attack clears the block when the approach is full.", weaknesses: "Serve receive posture drops on a short serve.", priorities: "Stay tall on the short serve and pass to zone 2." },
  { id: 6, name: "Nina Patel", initials: "NP", number: 9, position: "Outside Hitter", grade: "Freshman", attendance: 98, color: "bg-cyan-100 text-cyan-700", serve: 82, attack: 84, block: 70, trend: 11, done: 1, strengths: "The approach is on time in a perfect pass.", weaknesses: "Arm swing gets long when the set is off the net.", priorities: "Shorten the last step when the set pushes off." },
  { id: 7, name: "Riley Davis", initials: "RD", number: 14, position: "Middle Blocker", grade: "Senior", attendance: 93, color: "bg-orange-100 text-orange-700", serve: 77, attack: 83, block: 91, trend: 5, done: 0, strengths: "Reads the opposing setter on the first tempo.", weaknesses: "Serving toss wanders on the jump serve.", priorities: "Repeat the same toss height for a full serving round." },
  { id: 8, name: "Emma Wilson", initials: "EW", number: 2, position: "Defensive Specialist", grade: "Sophomore", attendance: 99, color: "bg-indigo-100 text-indigo-700", serve: 89, attack: 69, block: 64, trend: 7, done: 0, strengths: "Serve location holds up late in a set.", weaknesses: "Digs stay low but do not move toward the setter.", priorities: "Direct the dig to the target cone, not just up." },
];

function skillsFor(seed: Seed): Skills {
  const setter = seed.position === "Setter";
  const backRow = seed.position === "Libero" || seed.position === "Defensive Specialist";
  return {
    serve: seed.serve,
    attack: seed.attack,
    block: seed.block,
    pass: backRow ? 91 : setter ? 84 : 76,
    set: setter ? 93 : 64,
    defense: backRow ? 92 : 73,
  };
}

function earlier(skills: Skills, trend: number): Skills {
  return {
    serve: Math.max(40, skills.serve - trend),
    pass: Math.max(40, skills.pass - trend),
    set: Math.max(40, skills.set - trend),
    attack: Math.max(40, skills.attack - trend),
    block: Math.max(40, skills.block - trend),
    defense: Math.max(40, skills.defense - trend),
  };
}

export function prototypeAthletes(): Athlete[] {
  return ROSTER.map((seed) => {
    const skills = skillsFor(seed);
    const base: Athlete = {
      id: seed.id,
      name: seed.name,
      initials: seed.initials,
      number: seed.number,
      position: seed.position,
      grade: seed.grade,
      attendance: seed.attendance,
      color: seed.color,
      sessions: [],
      assessments: [
        {
          id: `seed-${seed.id}-may10`,
          recordedAt: "2026-05-10T16:00:00.000Z",
          skills: earlier(skills, seed.trend),
          strengths: "Earlier prototype note.",
          weaknesses: "Earlier prototype note.",
          priorities: "Earlier prototype note.",
        },
        {
          id: `seed-${seed.id}-may24`,
          recordedAt: "2026-05-24T16:00:00.000Z",
          skills,
          strengths: seed.strengths,
          weaknesses: seed.weaknesses,
          priorities: seed.priorities,
        },
      ],
    };
    const plan = trainingPlan(base);
    const completed = plan.slice(0, seed.done).map((exercise, index) => ({
      id: `seed-session-${seed.id}-${index}`,
      exerciseId: exercise.id,
      title: exercise.title,
      minutes: exercise.minutes,
      completedAt: "2026-05-26T18:00:00.000Z",
    }));
    return { ...base, sessions: completed };
  });
}
