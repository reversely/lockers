"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import {
  fetchAdminWall,
  insertInactiveLockers,
  searchPeople,
  type AdminLease,
  type AdminReservation,
  type AdminWallData,
  type Person,
} from "@/lib/admin-wall";
import { formatDate } from "@/lib/wall";

function remaining(until: string, now: number | null): string {
  if (!now) return "--:--";
  const totalSeconds = Math.floor(Math.max(0, new Date(until).getTime() - now) / 1000);
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

export function AdminWall({
  initial,
  defaultLeaseDays,
}: {
  initial: AdminWallData;
  defaultLeaseDays: number;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState(initial);
  const [openId, setOpenId] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  const refetch = useCallback(async () => {
    setData(await fetchAdminWall(supabase));
  }, [supabase]);

  useEffect(() => {
    const channel = supabase.channel("admin-wall");
    for (const table of ["lockers", "reservations", "leases"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        void refetch();
      });
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, refetch]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const act = useCallback(
    async (run: () => Promise<{ error: { message: string } | null }>) => {
      setBusy(true);
      setError(null);
      const { error: actionError } = await run();
      if (actionError) setError(friendlyError(actionError.message));
      await refetch();
      setBusy(false);
      return !actionError;
    },
    [refetch],
  );

  const leaseByLocker = new Map(data.leases.map((l) => [l.locker_id, l]));
  const liveReservations = data.reservations.filter(
    (r) => now === null || new Date(r.expires_at).getTime() > now,
  );
  const reservationByLocker = new Map(liveReservations.map((r) => [r.locker_id, r]));
  const open = data.lockers.find((l) => l.id === openId) ?? null;
  const openLease = open ? leaseByLocker.get(open.id) ?? null : null;
  const openReservation = open ? reservationByLocker.get(open.id) ?? null : null;
  const availableLockers = data.lockers.filter(
    (l) => l.is_active && !leaseByLocker.has(l.id) && !reservationByLocker.has(l.id),
  );
  const maxCol = Math.max(1, ...data.lockers.map((l) => l.col));
  const maxRow = Math.max(1, ...data.lockers.map((l) => l.row));

  // A new row inserts one inactive locker per existing column; a new column one per existing
  // row. An empty wall starts from a single cell.
  const growRow = () =>
    act(async () => {
      const row = data.lockers.length === 0 ? 1 : maxRow + 1;
      const cols = data.lockers.length === 0 ? [1] : Array.from({ length: maxCol }, (_, i) => i + 1);
      return await insertInactiveLockers(supabase, cols.map((col) => ({ row, col })));
    });
  const growCol = () =>
    act(async () => {
      const col = data.lockers.length === 0 ? 1 : maxCol + 1;
      const rows = data.lockers.length === 0 ? [1] : Array.from({ length: maxRow }, (_, i) => i + 1);
      return await insertInactiveLockers(supabase, rows.map((row) => ({ row, col })));
    });
  const rename = (lockerId: string, label: string) =>
    act(async () => await supabase.from("lockers").update({ label }).eq("id", lockerId));

  return (
    <section className="surface" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h2 className="surface-title">Locker wall</h2>
        <button className={editing ? "btn btn-ink" : "btn btn-line"} onClick={() => setEditing((e) => !e)}>
          {editing ? "Done" : "Edit layout"}
        </button>
      </div>
      {editing ? (
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 14 }}>
          <span>
            {maxRow} row{maxRow === 1 ? "" : "s"}
          </span>
          <button className="btn btn-line" disabled={busy} onClick={growRow}>
            Add row
          </button>
          <span>
            {maxCol} column{maxCol === 1 ? "" : "s"}
          </span>
          <button className="btn btn-line" disabled={busy} onClick={growCol}>
            Add column
          </button>
          <span className="notice-line">Click a cell to rename it. New cells start inactive.</span>
        </div>
      ) : null}
      {error ? <p className="error-line">{error}</p> : null}
      {data.lockers.length === 0 ? (
        <p style={{ fontSize: 14 }}>
          No lockers yet.{" "}
          {editing ? "Add a row to create the first cell." : "Edit layout to create them."}
        </p>
      ) : (
        <div className="wall-scroll">
          <div className="wall-grid" style={{ gridTemplateColumns: `repeat(${maxCol}, minmax(64px, 96px))` }}>
            {data.lockers.map((locker) => {
              const lease = leaseByLocker.get(locker.id);
              const reservation = reservationByLocker.get(locker.id);
              const state = !locker.is_active
                ? "inactive"
                : lease
                  ? "occupied"
                  : reservation
                    ? "reserved"
                    : "available";
              if (editing) {
                return (
                  <div key={locker.id} className={`cell cell-${state}`} style={{ gridColumn: locker.col, gridRow: locker.row }}>
                    <input
                      className="cell-rename"
                      defaultValue={locker.label}
                      aria-label={`Rename ${locker.label}`}
                      onBlur={(e) => {
                        const next = e.target.value.trim();
                        if (next && next !== locker.label) void rename(locker.id, next);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                    />
                  </div>
                );
              }
              return (
                <button
                  key={locker.id}
                  className={`cell cell-${state} cell-claimable`}
                  style={{ gridColumn: locker.col, gridRow: locker.row }}
                  onClick={() => setOpenId(locker.id)}
                >
                  {locker.label}
                  {lease ? <span className="cell-name">{data.people[lease.user_id]?.name}</span> : null}
                  {reservation ? <span className="cell-count">{remaining(reservation.expires_at, now)}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {open && !editing ? (
        <SidePanel
          key={open.id + (openLease?.id ?? "") + (openReservation?.id ?? "")}
          locker={open}
          lease={openLease}
          reservation={openReservation}
          people={data.people}
          availableLockers={availableLockers}
          defaultLeaseDays={defaultLeaseDays}
          now={now}
          busy={busy}
          onClose={() => setOpenId(null)}
          act={act}
          supabase={supabase}
        />
      ) : null}
    </section>
  );
}

function SidePanel({
  locker,
  lease,
  reservation,
  people,
  availableLockers,
  defaultLeaseDays,
  now,
  busy,
  onClose,
  act,
  supabase,
}: {
  locker: AdminWallData["lockers"][number];
  lease: AdminLease | null;
  reservation: AdminReservation | null;
  people: Record<string, Person>;
  availableLockers: AdminWallData["lockers"];
  defaultLeaseDays: number;
  now: number | null;
  busy: boolean;
  onClose: () => void;
  act: (run: () => Promise<{ error: { message: string } | null }>) => Promise<boolean>;
  supabase: ReturnType<typeof createClient>;
}) {
  const [label, setLabel] = useState(locker.label);
  const [comments, setComments] = useState(locker.comments ?? "");
  const [startDate, setStartDate] = useState(lease?.start_date ?? "");
  const [endDate, setEndDate] = useState(lease?.end_date ?? "");
  const [leaseComments, setLeaseComments] = useState(lease?.comments ?? "");
  const [term, setTerm] = useState("");
  const [matches, setMatches] = useState<Person[]>([]);
  const [reassignTo, setReassignTo] = useState("");

  const tenant = lease ? people[lease.user_id] : null;
  const holder = reservation ? people[reservation.user_id] : null;

  useEffect(() => {
    const handle = setTimeout(async () => {
      const trimmed = term.trim();
      setMatches(trimmed.length < 2 ? [] : await searchPeople(supabase, trimmed));
    }, 250);
    return () => clearTimeout(handle);
  }, [term, supabase]);

  const saveLocker = () =>
    act(async () => await supabase.from("lockers").update({ label: label.trim(), comments: comments.trim() || null }).eq("id", locker.id));
  const toggleActive = () =>
    act(async () => await supabase.from("lockers").update({ is_active: !locker.is_active }).eq("id", locker.id));
  const assign = (person: Person) =>
    act(async () => {
      const start = new Date().toISOString().slice(0, 10);
      const end = new Date(Date.now() + defaultLeaseDays * 86400000).toISOString().slice(0, 10);
      return await supabase.from("leases").insert({
        locker_id: locker.id, user_id: person.id, start_date: start, end_date: end,
      });
    });
  const saveLease = () =>
    act(async () => await supabase.from("leases").update({
      start_date: startDate, end_date: endDate, comments: leaseComments.trim() || null,
    }).eq("id", lease!.id));
  const endLease = () => act(async () => await supabase.rpc("admin_end_lease", { p_lease: lease!.id }));
  const reassign = () =>
    act(async () => await supabase.rpc("admin_reassign", { p_lease: lease!.id, p_locker: reassignTo }));
  const forceRelease = () =>
    act(async () => await supabase.from("reservations").delete().eq("id", reservation!.id));

  return (
    <div className="scrim" onClick={onClose}>
      <div className="popup" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
        <span className="eyebrow">Locker {locker.label}</span>

        {reservation ? (
          <>
            <p style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>
              Held by {holder?.name ?? holder?.email ?? "a user"}
            </p>
            <p className="countdown" style={{ fontSize: 24 }}>{remaining(reservation.expires_at, now)}</p>
            <div>
              <button className="btn btn-line" disabled={busy} onClick={forceRelease}>
                Force release
              </button>
            </div>
          </>
        ) : lease ? (
          <>
            <p style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>{tenant?.name}</p>
            <p style={{ fontSize: 13 }}>
              {tenant?.id_number} {tenant?.email} {tenant?.phone}
            </p>
            <div className="field">
              <label className="field-label" htmlFor="start_date">Start date</label>
              <input className="input" id="start_date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="end_date">End date</label>
              <input className="input" id="end_date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="lease_comments">Lease comments</label>
              <textarea className="input" id="lease_comments" value={leaseComments} onChange={(e) => setLeaseComments(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-ink" disabled={busy} onClick={saveLease}>Save</button>
              <button className="btn btn-line" disabled={busy} onClick={endLease}>End lease</button>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="reassign">Reassign to</label>
              <div style={{ display: "flex", gap: 8 }}>
                <select className="input" id="reassign" value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
                  <option value="">Choose an available locker</option>
                  {availableLockers.map((l) => (
                    <option key={l.id} value={l.id}>{l.label}</option>
                  ))}
                </select>
                <button className="btn btn-line" disabled={busy || !reassignTo} onClick={reassign}>Move</button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="field">
              <label className="field-label" htmlFor="label">Label</label>
              <input className="input" id="label" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="locker_comments">Comments</label>
              <textarea className="input" id="locker_comments" value={comments} onChange={(e) => setComments(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-ink" disabled={busy} onClick={saveLocker}>Save</button>
              <button className="btn btn-line" disabled={busy} onClick={toggleActive}>
                {locker.is_active ? "Deactivate" : "Activate"}
              </button>
            </div>
            {locker.is_active ? (
              <div className="field">
                <label className="field-label" htmlFor="assign_search">Assign to a user</label>
                <input
                  className="input"
                  id="assign_search"
                  placeholder="Search by name or ID number"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                />
                {matches.map((person) => (
                  <button
                    key={person.id}
                    className="btn btn-line"
                    style={{ justifyContent: "flex-start" }}
                    disabled={busy}
                    onClick={() => assign(person)}
                  >
                    {person.name} {person.id_number ? `(${person.id_number})` : ""}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        )}

        <p style={{ fontSize: 13 }}>
          {lease ? `${formatDate(lease.start_date)} to ${formatDate(lease.end_date)}` : null}
        </p>
        <div>
          <button className="btn btn-line" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
