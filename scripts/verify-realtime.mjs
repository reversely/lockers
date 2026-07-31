#!/usr/bin/env node
/**
 * Answers whether a signed-in user receives postgres_changes events from lockers,
 * reservations, and leases. The leases case matters most: authenticated has a column grant
 * that excludes comments, and no doc states how Realtime treats a partial grant.
 *
 * Creates one user and one locker, mutates each table through the secret key, waits for the
 * events, then deletes everything it made.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(URL_, env.SUPABASE_SERVICE_SECRET_KEY, { auth: { persistSession: false } });

const EMAIL = "lockers-rt-test@example.com";
const PASSWORD = "lockers-test-pw-8842";
const received = new Map(); // table -> event type

let userId, lockerId, leaseId, userClient;
let exitCode = 1;

try {
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
  });
  if (cErr) throw cErr;
  userId = created.user.id;

  userClient = createClient(URL_, env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY);
  const { error: sErr } = await userClient.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (sErr) throw sErr;

  const subscribed = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("subscribe timeout after 15s")), 15000);
    userClient
      .channel("wall")
      .on("postgres_changes", { event: "*", schema: "public", table: "lockers" }, (p) => received.set("lockers", p.eventType))
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, (p) => received.set("reservations", p.eventType))
      .on("postgres_changes", { event: "*", schema: "public", table: "leases" }, (p) => received.set("leases", p.eventType))
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") { clearTimeout(timer); resolve(); }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") { clearTimeout(timer); reject(err ?? new Error(status)); }
      });
  });
  await subscribed;

  const { data: locker, error: lErr } = await admin.from("lockers")
    .insert({ label: "RT-TEST", row: 91, col: 1, is_active: true }).select().single();
  if (lErr) throw lErr;
  lockerId = locker.id;

  const { data: lease, error: leaseErr } = await admin.from("leases")
    .insert({ locker_id: lockerId, user_id: userId, end_date: "2026-11-28", comments: "rt probe" })
    .select("id").single();
  if (leaseErr) throw leaseErr;
  leaseId = lease.id;

  // A reservation needs a request; insert and delete inside the window so the row is transient.
  const { data: req, error: rErr } = await admin.from("requests")
    .insert({ user_id: userId, status: "approved" }).select("id").single();
  if (rErr) throw rErr;
  await admin.from("requests").update({ status: "fulfilled" }).eq("id", req.id);
  const { error: resErr } = await admin.from("reservations").insert({
    locker_id: lockerId, user_id: userId, request_id: req.id,
    expires_at: new Date(Date.now() + 60000).toISOString(),
  });
  if (resErr) throw resErr;

  // Events arrive asynchronously; poll up to 10s.
  for (let i = 0; i < 20 && received.size < 3; i++) await new Promise((r) => setTimeout(r, 500));

  for (const table of ["lockers", "reservations", "leases"]) {
    const got = received.get(table);
    console.log(`${got ? "PASS" : "FAIL"}  ${table.padEnd(13)} ${got ?? "no event within 10s"}`);
  }
  exitCode = received.size === 3 ? 0 : 1;
} catch (err) {
  console.error("ERROR", err.message ?? err);
} finally {
  if (userClient) await userClient.removeAllChannels();
  if (leaseId) await admin.from("leases").delete().eq("id", leaseId);
  if (lockerId) {
    await admin.from("reservations").delete().eq("locker_id", lockerId);
    await admin.from("lockers").delete().eq("id", lockerId);
  }
  if (userId) {
    await admin.from("requests").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
  }
  process.exitCode = exitCode;
}
