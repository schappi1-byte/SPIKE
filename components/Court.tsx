import type { CourtPosition } from "@/lib/types";
import { COURT_LABELS } from "@/lib/volleyball";

export interface CourtCell {
  courtPosition: CourtPosition;
  name: string;
  detail: string;
  highlight?: boolean;
}

// Front row is drawn next to the net: 4, 3, 2 left to right, then 5, 6, 1.
const ORDER: readonly CourtPosition[] = [4, 3, 2, 5, 6, 1];

export function Court({ cells }: { cells: CourtCell[] }) {
  const byPosition = new Map(cells.map((c) => [c.courtPosition, c]));
  return (
    <div className="court">
      <div className="net" />
      {ORDER.slice(0, 3).map((pos) => (
        <Slot key={pos} pos={pos} cell={byPosition.get(pos)} />
      ))}
      <div className="attack-line" />
      {ORDER.slice(3).map((pos) => (
        <Slot key={pos} pos={pos} cell={byPosition.get(pos)} />
      ))}
    </div>
  );
}

function Slot({ pos, cell }: { pos: CourtPosition; cell: CourtCell | undefined }) {
  return (
    <div className={`slot${cell?.highlight ? " highlight" : ""}`}>
      <div className="pos">
        {pos} · {COURT_LABELS[pos]}
      </div>
      <div className="name">{cell?.name ?? "Open"}</div>
      {cell ? <div className="muted">{cell.detail}</div> : null}
    </div>
  );
}
