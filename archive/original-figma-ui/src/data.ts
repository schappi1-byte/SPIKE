export type Player = {
  id: number;
  name: string;
  initials: string;
  number: number;
  position: string;
  grade: string;
  attendance: number;
  serve: number;
  attack: number;
  blocks: number;
  trend: number;
  color: string;
};

export const players: Player[] = [
  { id: 1, name: "Maya Chen", initials: "MC", number: 7, position: "Outside Hitter", grade: "Senior", attendance: 96, serve: 88, attack: 92, blocks: 74, trend: 6, color: "bg-blue-100 text-blue-700" },
  { id: 2, name: "Sofia Reyes", initials: "SR", number: 12, position: "Setter", grade: "Junior", attendance: 100, serve: 91, attack: 72, blocks: 68, trend: 8, color: "bg-violet-100 text-violet-700" },
  { id: 3, name: "Avery Brooks", initials: "AB", number: 3, position: "Libero", grade: "Senior", attendance: 94, serve: 84, attack: 65, blocks: 61, trend: 4, color: "bg-amber-100 text-amber-700" },
  { id: 4, name: "Jordan Kim", initials: "JK", number: 18, position: "Middle Blocker", grade: "Sophomore", attendance: 97, serve: 79, attack: 86, blocks: 94, trend: 9, color: "bg-emerald-100 text-emerald-700" },
  { id: 5, name: "Taylor Morgan", initials: "TM", number: 5, position: "Opposite", grade: "Junior", attendance: 91, serve: 86, attack: 89, blocks: 82, trend: 3, color: "bg-rose-100 text-rose-700" },
  { id: 6, name: "Nina Patel", initials: "NP", number: 9, position: "Outside Hitter", grade: "Freshman", attendance: 98, serve: 82, attack: 84, blocks: 70, trend: 11, color: "bg-cyan-100 text-cyan-700" },
  { id: 7, name: "Riley Davis", initials: "RD", number: 14, position: "Middle Blocker", grade: "Senior", attendance: 93, serve: 77, attack: 83, blocks: 91, trend: 5, color: "bg-orange-100 text-orange-700" },
  { id: 8, name: "Emma Wilson", initials: "EW", number: 2, position: "Defensive Specialist", grade: "Sophomore", attendance: 99, serve: 89, attack: 69, blocks: 64, trend: 7, color: "bg-indigo-100 text-indigo-700" },
];
