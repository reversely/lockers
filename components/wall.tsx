"use client";

import { useState } from "react";
import { formatDate, type WallRow } from "@/lib/wall";

// A cell's rendered state downgrades a lapsed hold client-side: the view reports reserved
// only while the hold is live, and the client's copy goes stale between events.
function cellState(row: WallRow, now: number | null): WallRow["state"] {
  if (row.state === "reserved" && now && row.reserved_until && new Date(row.reserved_until).getTime() <= now) {
    return "available";
  }
  return row.state;
}

function remaining(until: string | null, now: number | null): string {
  if (!until || !now) return "--:--";
  const ms = Math.max(0, new Date(until).getTime() - now);
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function Wall({
  wall,
  userId,
  now,
  canClaim,
  onClaim,
}: {
  wall: WallRow[];
  userId: string;
  now: number | null;
  canClaim: boolean;
  onClaim: (lockerId: string) => void;
}) {
  const [openCell, setOpenCell] = useState<WallRow | null>(null);

  if (wall.length === 0) {
    return <p style={{ fontSize: 14 }}>No lockers yet. The admin creates them.</p>;
  }

  const maxCol = Math.max(...wall.map((r) => r.col));

  return (
    <>
      <div className="wall-scroll">
        <div
          className="wall-grid"
          style={{ gridTemplateColumns: `repeat(${maxCol}, minmax(64px, 96px))` }}
        >
          {wall.map((row) => {
            const state = cellState(row, now);
            const own = state === "reserved" && row.reserved_by === userId;
            const claimable = canClaim && state === "available";
            const className = [
              "cell",
              own ? "cell-own" : `cell-${state}`,
              claimable ? "cell-claimable" : "",
            ].join(" ");
            const style = { gridColumn: row.col, gridRow: row.row };

            if (claimable) {
              return (
                <button key={row.locker_id} className={className} style={style} onClick={() => onClaim(row.locker_id)}>
                  {row.label}
                </button>
              );
            }
            if (state === "occupied") {
              return (
                <button key={row.locker_id} className={className} style={style} onClick={() => setOpenCell(row)}>
                  {row.label}
                  <span className="cell-name">{row.occupant_name}</span>
                </button>
              );
            }
            return (
              <div key={row.locker_id} className={className} style={style}>
                {row.label}
                {own ? <span className="cell-count">{remaining(row.reserved_until, now)}</span> : null}
              </div>
            );
          })}
        </div>
      </div>

      {openCell ? (
        <div className="scrim" onClick={() => setOpenCell(null)}>
          <div className="popup" onClick={(event) => event.stopPropagation()}>
            <span className="eyebrow">Locker {openCell.label}</span>
            <p style={{ fontSize: 15, color: "var(--ink)", fontWeight: 500 }}>{openCell.occupant_name}</p>
            <p style={{ fontSize: 14 }}>
              {formatDate(openCell.start_date)} to {formatDate(openCell.end_date)}
            </p>
            <div>
              <button className="btn btn-line" onClick={() => setOpenCell(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
