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
          <span className="eyebrow">Your locker</span>
          <p style={{ fontSize: 14 }}>
            Submit a request, then pay by e-transfer. An admin approves the request once the
            payment arrives.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button className="btn btn-ink" disabled={!state.profileComplete || busy} onClick={onRequest}>
              Request a locker
            </button>
            {!state.profileComplete ? (
              <span className="notice-line">
                Complete your <a href="/profile">profile</a> first.
              </span>
            ) : null}
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
            <p style={{ fontSize: 14 }}>The admin has not written payment instructions yet.</p>
          )}
          <p className="notice-line">Awaiting confirmation from the admin.</p>
        </>
      ) : null}

      {state.kind === "approved" ? (
        <>
          <span className="eyebrow">Approved</span>
          <p style={{ fontSize: 15, color: "var(--ink)" }}>
            Pick your locker. A click holds it while you confirm.
          </p>
        </>
      ) : null}

      {state.kind === "reserving" ? (
        <>
          <span className="eyebrow">Locker {state.row.label} held</span>
          <div className="countdown">{state.countdown}</div>
          <div style={{ display: "flex", gap: 12 }}>
            <button className="btn btn-ink" disabled={busy} onClick={onSelect}>
              Select
            </button>
            <button className="btn btn-line" disabled={busy} onClick={onCancel}>
              Cancel
            </button>
          </div>
        </>
      ) : null}

      {state.kind === "fulfilled" ? (
        <>
          <span className="eyebrow">Your locker</span>
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
