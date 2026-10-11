import type { AnimationId } from "./trainingPlan";

const moves: Record<string, string> = {
  squat: "Squat demonstration",
  lunge: "Lunge demonstration",
  "calf-raise": "Calf raise demonstration",
  "squat-jump": "Squat jump demonstration",
  shuffle: "Lateral shuffle demonstration",
  "arm-raise": "Overhead arm raise demonstration",
  rest: "Standing rest",
  none: "Standing",
};

export default function Trainer({ move, paused }: { move: AnimationId | "rest"; paused: boolean }) {
  return (
    <svg viewBox="0 0 200 340" className={`trainer mx-auto h-32 w-full sm:h-48 md:h-[42vh] md:max-h-[420px] ${paused ? "is-paused" : ""}`} data-move={move} role="img" aria-label={moves[move] ?? "Standing"}>
      <line x1="36" y1="312" x2="164" y2="312" className="ground" />
      <g className="body">
        <circle cx="100" cy="46" r="18" />
        <path d="M84 68h32l8 96h-48z" />
        <g className="arm-l">
          <path d="M86 84 54 128" />
          <g className="fore-l"><path d="M54 128 46 170" /></g>
        </g>
        <g className="arm-r">
          <path d="M114 84 146 128" />
          <g className="fore-r"><path d="M146 128 154 170" /></g>
        </g>
        <g className="leg-l">
          <path d="M90 168 76 228" />
          <g className="shin-l"><path d="M76 228 70 292" /></g>
        </g>
        <g className="leg-r">
          <path d="M110 168 124 228" />
          <g className="shin-r"><path d="M124 228 130 292" /></g>
        </g>
      </g>
    </svg>
  );
}
