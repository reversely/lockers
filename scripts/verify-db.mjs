// Phase 7 verification against the live project, data layer only.
// Creates two test users and three lockers, races them, then deletes everything it made.
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const PUB = env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY;
const SEC = env.SUPABASE_SERVICE_SECRET_KEY;

const svc = (extra = {}) => ({ apikey: SEC, Authorization: `Bearer ${SEC}`, "Content-Type": "application/json", ...extra });
const usr = (token) => ({ apikey: PUB, Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

async function j(res) { const t = await res.text(); try { return JSON.parse(t); } catch { return t; } }
function check(label, pass, detail = "") { console.log(`${pass ? "PASS" : "FAIL"}  ${label}${detail ? "  " + detail : ""}`); return pass; }

const results = [];
const made = { users: [], lockers: [] };

async function createUser(email) {
  const r = await fetch(`${URL_}/auth/v1/admin/users`, {
    method: "POST", headers: svc(),
    body: JSON.stringify({ email, password: "lockers-test-pw-8842", email_confirm: true }),
  });
  const b = await j(r);
  if (!b.id) throw new Error(`create user ${email}: ${r.status} ${JSON.stringify(b).slice(0, 200)}`);
  made.users.push(b.id);
  return b.id;
}

async function signIn(email) {
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: PUB, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "lockers-test-pw-8842" }),
  });
  const b = await j(r);
  if (!b.access_token) throw new Error(`sign in ${email}: ${r.status} ${JSON.stringify(b).slice(0, 200)}`);
  return b.access_token;
}

async function rpc(token, name, body = {}) {
  const r = await fetch(`${URL_}/rest/v1/rpc/${name}`, { method: "POST", headers: usr(token), body: JSON.stringify(body) });
  return { status: r.status, body: await j(r) };
}

const emailA = "lockers-test-a@example.com";
const emailB = "lockers-test-b@example.com";

try {
  // Fixtures.
  const lockerRes = await fetch(`${URL_}/rest/v1/lockers`, {
    method: "POST", headers: svc({ Prefer: "return=representation" }),
    body: JSON.stringify([
      { label: "TEST-1", row: 90, col: 1, is_active: true },
      { label: "TEST-2", row: 90, col: 2, is_active: true },
      { label: "TEST-3", row: 90, col: 3, is_active: false },
    ]),
  });
  const lockers = await j(lockerRes);
  if (!Array.isArray(lockers)) throw new Error(`lockers: ${lockerRes.status} ${JSON.stringify(lockers).slice(0, 200)}`);
  made.lockers = lockers.map((l) => l.id);
  const [L1, L2, L3] = lockers;

  const idA = await createUser(emailA);
  const idB = await createUser(emailB);

  // The signup trigger should have written both profiles.
  const profiles = await j(await fetch(`${URL_}/rest/v1/profiles?select=id,email&id=in.(${idA},${idB})`, { headers: svc() }));
  results.push(check("signup trigger writes a profile row", Array.isArray(profiles) && profiles.length === 2, `${profiles.length ?? 0} of 2`));

  // Approved requests for both.
  const reqRes = await fetch(`${URL_}/rest/v1/requests`, {
    method: "POST", headers: svc({ Prefer: "return=representation" }),
    body: JSON.stringify([{ user_id: idA, status: "approved" }, { user_id: idB, status: "approved" }]),
  });
  const requests = await j(reqRes);
  if (!Array.isArray(requests)) throw new Error(`requests: ${reqRes.status} ${JSON.stringify(requests).slice(0, 200)}`);

  // A second open request for the same user must hit the partial unique index.
  const dupe = await fetch(`${URL_}/rest/v1/requests`, { method: "POST", headers: svc(), body: JSON.stringify({ user_id: idA, status: "pending" }) });
  results.push(check("one open request per user (partial unique index)", dupe.status === 409, `status ${dupe.status}`));

  const tokenA = await signIn(emailA);
  const tokenB = await signIn(emailB);

  // Step 46 and 47: both race for the same locker.
  const [raceA, raceB] = await Promise.all([
    rpc(tokenA, "claim_reservation", { p_locker: L1.id }),
    rpc(tokenB, "claim_reservation", { p_locker: L1.id }),
  ]);
  const winners = [raceA, raceB].filter((r) => r.status === 200);
  const losers = [raceA, raceB].filter((r) => r.status !== 200);
  const rows = await j(await fetch(`${URL_}/rest/v1/reservations?select=id&locker_id=eq.${L1.id}`, { headers: svc() }));
  results.push(check("exactly one reservation survives the race", winners.length === 1 && rows.length === 1,
    `${winners.length} ok, ${losers.length} refused, ${rows.length} row(s)`));
  results.push(check("the loser reads 'already reserved'", losers.length === 1 && JSON.stringify(losers[0].body).includes("already reserved"),
    JSON.stringify(losers[0]?.body).slice(0, 90)));

  const winnerToken = raceA.status === 200 ? tokenA : tokenB;
  const loserToken = raceA.status === 200 ? tokenB : tokenA;

  // The wall must show the hold to the other user.
  const wallSeen = await j(await fetch(`${URL_}/rest/v1/locker_wall?select=label,state,reserved_until&locker_id=eq.${L1.id}`, { headers: usr(loserToken) }));
  results.push(check("the other user sees state=reserved on the wall", wallSeen[0]?.state === "reserved", JSON.stringify(wallSeen[0] ?? {}).slice(0, 90)));

  // The wall must not expose an ID number or any comment column (#6).
  const wallAll = await j(await fetch(`${URL_}/rest/v1/locker_wall?select=*&limit=1`, { headers: usr(loserToken) }));
  const leaked = Object.keys(wallAll[0] ?? {}).filter((c) => /id_number|comment/.test(c));
  results.push(check("the wall exposes no ID number and no comment column", leaked.length === 0, leaked.join(",") || "none"));

  // Step 48: an expired hold frees the locker.
  await fetch(`${URL_}/rest/v1/reservations?locker_id=eq.${L1.id}`, {
    method: "PATCH", headers: svc(), body: JSON.stringify({ expires_at: new Date(Date.now() - 60000).toISOString() }),
  });
  const wallExpired = await j(await fetch(`${URL_}/rest/v1/locker_wall?select=state&locker_id=eq.${L1.id}`, { headers: usr(loserToken) }));
  results.push(check("an expired hold reads as available", wallExpired[0]?.state === "available", JSON.stringify(wallExpired[0] ?? {})));

  const afterExpiry = await rpc(loserToken, "claim_reservation", { p_locker: L1.id });
  results.push(check("the other user can claim once the hold expires", afterExpiry.status === 200, `status ${afterExpiry.status}`));

  // An inactive locker refuses a claim.
  const inactive = await rpc(winnerToken, "claim_reservation", { p_locker: L3.id });
  results.push(check("an inactive locker refuses a claim", inactive.status !== 200 && JSON.stringify(inactive.body).includes("locker unavailable"),
    JSON.stringify(inactive.body).slice(0, 70)));

  // Step 16: finalize writes the lease, fulfils the request, drops the hold.
  const finalize = await rpc(loserToken, "finalize_selection");
  const leaseRows = await j(await fetch(`${URL_}/rest/v1/leases?select=id,locker_id,start_date,end_date&locker_id=eq.${L1.id}`, { headers: svc() }));
  const reqAfter = await j(await fetch(`${URL_}/rest/v1/requests?select=status&user_id=eq.${raceA.status === 200 ? idB : idA}`, { headers: svc() }));
  const resAfter = await j(await fetch(`${URL_}/rest/v1/reservations?select=id&locker_id=eq.${L1.id}`, { headers: svc() }));
  results.push(check("finalize_selection writes one lease", finalize.status === 200 && leaseRows.length === 1, `status ${finalize.status}, ${leaseRows.length} lease(s)`));
  results.push(check("finalize_selection marks the request fulfilled", reqAfter[0]?.status === "fulfilled", JSON.stringify(reqAfter[0] ?? {})));
  results.push(check("finalize_selection deletes the reservation", resAfter.length === 0, `${resAfter.length} row(s)`));

  const term = leaseRows[0] ? (new Date(leaseRows[0].end_date) - new Date(leaseRows[0].start_date)) / 86400000 : -1;
  results.push(check("the lease runs settings.default_lease_days", term === 120, `${term} days`));

  // Step 50: a signed-in user cannot write the tables directly.
  const directLease = await fetch(`${URL_}/rest/v1/leases`, {
    method: "POST", headers: usr(winnerToken),
    body: JSON.stringify({ locker_id: L2.id, user_id: idA, end_date: "2027-01-01" }),
  });
  await fetch(`${URL_}/rest/v1/lockers?id=eq.${L2.id}`, { method: "PATCH", headers: usr(winnerToken), body: JSON.stringify({ label: "HACKED" }) });
  const lockerNow = await j(await fetch(`${URL_}/rest/v1/lockers?select=label&id=eq.${L2.id}`, { headers: svc() }));
  results.push(check("a user's direct insert into leases is refused", directLease.status >= 400, `status ${directLease.status}`));
  results.push(check("a user's direct update on lockers changes nothing", lockerNow[0]?.label === "TEST-2", `label ${lockerNow[0]?.label}`));

  // A user cannot promote themselves.
  const promote = await fetch(`${URL_}/rest/v1/profiles?id=eq.${idA}`, { method: "PATCH", headers: usr(tokenA), body: JSON.stringify({ role: "admin" }) });
  const roleNow = await j(await fetch(`${URL_}/rest/v1/profiles?select=role&id=eq.${idA}`, { headers: svc() }));
  results.push(check("a user cannot set their own role to admin", roleNow[0]?.role === "user", `status ${promote.status}, role ${roleNow[0]?.role}`));

  // A non-admin gets nothing from the admin views and no lease comment column.
  const adminView = await j(await fetch(`${URL_}/rest/v1/admin_leases?select=*`, { headers: usr(tokenA) }));
  results.push(check("a non-admin reads zero rows from admin_leases", Array.isArray(adminView) && adminView.length === 0, JSON.stringify(adminView).slice(0, 70)));
  const leaseComment = await fetch(`${URL_}/rest/v1/leases?select=comments`, { headers: usr(tokenA) });
  results.push(check("a non-admin cannot select leases.comments", leaseComment.status >= 400, `status ${leaseComment.status}`));

  // A non-admin calling an admin RPC.
  const adminRpc = await rpc(tokenA, "admin_end_lease", { p_lease: leaseRows[0]?.id });
  results.push(check("a non-admin calling admin_end_lease is refused", adminRpc.status >= 400 && JSON.stringify(adminRpc.body).includes("admin only"),
    JSON.stringify(adminRpc.body).slice(0, 70)));
} catch (err) {
  console.log("ERROR", err.message);
  results.push(false);
} finally {
  // Clean up everything this script made.
  for (const id of made.lockers) {
    await fetch(`${URL_}/rest/v1/leases?locker_id=eq.${id}`, { method: "DELETE", headers: svc() });
    await fetch(`${URL_}/rest/v1/reservations?locker_id=eq.${id}`, { method: "DELETE", headers: svc() });
  }
  for (const id of made.users) {
    await fetch(`${URL_}/rest/v1/requests?user_id=eq.${id}`, { method: "DELETE", headers: svc() });
    await fetch(`${URL_}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: svc() });
  }
  for (const id of made.lockers) await fetch(`${URL_}/rest/v1/lockers?id=eq.${id}`, { method: "DELETE", headers: svc() });

  const left = await j(await fetch(`${URL_}/rest/v1/lockers?select=id&label=like.TEST-*`, { headers: svc() }));
  const usersLeft = await j(await fetch(`${URL_}/rest/v1/profiles?select=id&email=like.lockers-test-*`, { headers: svc() }));
  console.log(`\ncleanup: ${Array.isArray(left) ? left.length : "?"} test locker(s) and ${Array.isArray(usersLeft) ? usersLeft.length : "?"} test profile(s) remain`);
  const passed = results.filter(Boolean).length;
  console.log(`${passed} of ${results.length} checks passed`);
}
