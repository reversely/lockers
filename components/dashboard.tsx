"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchOpenRequest, fetchWall, type OpenRequest, type WallRow } from "@/lib/wall";
import { Wall } from "@/components/wall";
import { StatusPanel, type PanelState } from "@/components/status-panel";

function countdown(until: string, now: number): string {
  const ms = Math.max(0, new Date(until).getTime() - now);
  const totalSeconds = Math.floor(ms / 1000);
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

export function Dashboard({
  userId,
  profileComplete,
  instructions,
  initialWall,
  initialRequest,
}: {
  userId: string;
  profileComplete: boolean;
  instructions: string;
  initialWall: WallRow[];
  initialRequest: OpenRequest;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [wall, setWall] = useState<WallRow[]>(initialWall);
  const [request, setRequest] = useState<OpenRequest>(initialRequest);
  // now starts null so the server render and the first client render agree; the first tick
  // fills it in and starts the countdown.
  const [now, setNow] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refetching = useRef(false);

  const refetch = useCallback(async () => {
    if (refetching.current) return;
    refetching.current = true;
    try {
      const [nextWall, nextRequest] = await Promise.all([
        fetchWall(supabase),
        fetchOpenRequest(supabase, userId),
      ]);
      setWall(nextWall);
      setRequest(nextRequest);
    } finally {
      refetching.current = false;
    }
  }, [supabase, userId]);

  // Step 24: any change on the three tables refetches the wall.
  useEffect(() => {
    const channel = supabase.channel("wall");
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

  const lease = wall.find((row) => row.occupant_id === userId) ?? null;
  const reservation =
    wall.find(
      (row) =>
        row.reserved_by === userId &&
        row.reserved_until &&
        (now === null || new Date(row.reserved_until).getTime() > now),
    ) ?? null;

  // On expiry the reservation branch stops matching and the panel falls back to approved.
  const panel: PanelState = lease
    ? { kind: "fulfilled", row: lease }
    : reservation
      ? { kind: "reserving", row: reservation, countdown: now ? countdown(reservation.reserved_until!, now) : "--:--" }
      : request?.status === "approved"
        ? { kind: "approved" }
        : request?.status === "pending"
          ? { kind: "pending", instructions }
          : { kind: "none", profileComplete };

  const act = useCallback(
    async (run: () => Promise<{ error: { message: string } | null }>) => {
      setBusy(true);
      setError(null);
      const { error: actionError } = await run();
      if (actionError) setError(actionError.message);
      await refetch();
      setBusy(false);
    },
    [refetch],
  );

  const onRequest = useCallback(
    () => act(async () => await supabase.from("requests").insert({ user_id: userId })),
    [act, supabase, userId],
  );
  const onClaim = useCallback(
    (lockerId: string) => act(async () => await supabase.rpc("claim_reservation", { p_locker: lockerId })),
    [act, supabase],
  );
  const onSelect = useCallback(
    () => act(async () => await supabase.rpc("finalize_selection")),
    [act, supabase],
  );
  const onCancel = useCallback(
    () => act(async () => await supabase.rpc("release_reservation")),
    [act, supabase],
  );

  return (
    <>
      <StatusPanel
        state={panel}
        error={error}
        busy={busy}
        onRequest={onRequest}
        onSelect={onSelect}
        onCancel={onCancel}
      />
      <section className="surface" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <h2 className="surface-title">Locker wall</h2>
        <Wall
          wall={wall}
          userId={userId}
          now={now}
          canClaim={panel.kind === "approved" && !busy}
          onClaim={onClaim}
        />
      </section>
    </>
  );
}
