"use client";

import { formatDate, type WallRow } from "@/lib/wall";

export type PanelState =
  | { kind: "none"; profileComplete: boolean }
  | { kind: "pending"; instructions: string }
  | { kind: "approved" }
  | { kind: "reserving"; row: WallRow; countdown: string }
  | { kind: "fulfilled"; row: WallRow };

export function StatusPanel({
  state,
  error,
  busy,
  onRequest,
  onSelect,
  onCancel,
}: {
  state: PanelState;
  error: string | null;
  busy: boolean;
  onRequest: () => void;
  onSelect: () => void;
  onCancel: () => void;
}) {
  return (
    <section className="surface" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {state.kind === "none" ? (
        <>
          {state.profileComplete ? (
            <p style={{ fontSize: 15, color: "var(--ink)" }}>Submit a request, then pay by e-transfer.</p>
          ) : (
            <p style={{ fontSize: 15, color: "var(--ink)" }}>
              Complete your <a href="/profile">profile</a> first.
            </p>
          )}
          <div>
            <button className="btn btn-ink" disabled={!state.profileComplete || busy} onClick={onRequest}>
              Request a locker
            </button>
          </div>
        </>
      ) : null}

      {state.kind === "pending" ? (
        <>
          <span className="eyebrow">Request pending</span>
          {state.instructions ? (
            <p style={{ fontSize: 15, color: "var(--ink)", maxWidth: "62ch", whiteSpace: "pre-line" }}>
              {state.instructions}
            </p>
          ) : (
            <p style={{ fontSize: 14 }}>Please contact your admin for assistance with signup.</p>
          )}
          <p className="notice-line">Awaiting confirmation from admin. Please allow 3-5 working days.</p>
        </>
      ) : null}

      {state.kind === "approved" ? (
        <p style={{ fontSize: 15, color: "var(--ink)" }}>Please select an available locker.</p>
      ) : null}

      {state.kind === "reserving" ? (
        <>
          <p style={{ fontSize: 15, color: "var(--ink)" }}>
            Holding locker for{" "}
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{state.countdown}</span>
          </p>
          <div style={{ display: "flex", gap: 12 }}>
            <button className="btn btn-ink" disabled={busy} onClick={onSelect}>
              Confirm locker
            </button>
            <button className="btn btn-line" disabled={busy} onClick={onCancel}>
              Cancel
            </button>
          </div>
        </>
      ) : null}

      {state.kind === "fulfilled" ? (
        <>
          <p style={{ fontSize: 24, fontWeight: 500, color: "var(--ink)", lineHeight: 1.2 }}>
            {state.row.label}
          </p>
          <p style={{ fontSize: 14 }}>
            {formatDate(state.row.start_date)} to {formatDate(state.row.end_date)}
          </p>
        </>
      ) : null}

      {error ? <p className="error-line">{error}</p> : null}
    </section>
  );
}
