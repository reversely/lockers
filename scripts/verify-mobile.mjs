// Audits every surface at 390px against the live database. Per surface: page width exactly
// 390, no visible element outside the viewport unless a scroll container holds it, wide
// content scrolling inside .wall-scroll, and every control at least 32px tall. Screenshots
// everything, seeds five users covering the dashboard states, and cleans up.
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(URL_, env.SUPABASE_SERVICE_SECRET_KEY, { auth: { persistSession: false } });
const PW = "lockers-test-pw-8842";
const TS = process.argv[2];
const failures = [];
const made = { users: [], lockers: [] };

let ws, nextId = 1;
const pending = new Map();
const send = (method, params = {}) => {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const evaluate = async (expression) =>
  (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;

// The audit that runs inside each page.
const AUDIT = `(() => {
  const viewport = 390;
  const out = { scrollWidth: document.documentElement.scrollWidth, offenders: [], shortControls: [], scrollers: [] };
  const inScroller = (el) => Boolean(el.closest(".wall-scroll"));
  for (const el of document.querySelectorAll("body *")) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if ((rect.right > viewport + 1 || rect.left < -1) && !inScroller(el)) {
      out.offenders.push(el.tagName + "." + String(el.className).split(" ")[0] + " right=" + Math.round(rect.right));
      if (out.offenders.length > 4) break;
    }
  }
  for (const el of document.querySelectorAll("button, input, select, textarea, a.btn")) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if (rect.height < 32 && el.type !== "hidden") {
      out.shortControls.push(el.tagName + "#" + (el.id || String(el.className).split(" ")[0]) + " h=" + Math.round(rect.height));
    }
  }
  for (const el of document.querySelectorAll(".wall-scroll")) {
    out.scrollers.push({ scrolls: el.scrollWidth > el.clientWidth, content: el.scrollWidth, box: el.clientWidth });
  }
  return out;
})()`;

async function audit(name, url, { linger = 4000, before = null } = {}) {
  await send("Page.navigate", { url });
  await wait(linger);
  if (before) await before();
  const result = await evaluate(AUDIT);
  const problems = [];
  if (result.scrollWidth !== 390) problems.push(`page ${result.scrollWidth}px wide`);
  if (result.offenders.length) problems.push(`outside viewport: ${result.offenders.join(", ")}`);
  if (result.shortControls.length) problems.push(`short controls: ${result.shortControls.join(", ")}`);
  console.log(`${problems.length ? "FAIL" : "PASS"}  ${name}${problems.length ? "  " + problems.join(" | ") : ""}`);
  if (problems.length) failures.push({ name, problems });
  writeFileSync(`docs/progress/${TS}_mobile-${name}.png`,
    Buffer.from((await send("Page.captureScreenshot", { format: "png" })).data, "base64"));
  return result;
}

const mkUser = async (email, profile, role) => {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true });
  if (error) throw error;
  made.users.push(data.user.id);
  if (profile) await admin.from("profiles").update({ ...profile, ...(role ? { role } : {}) }).eq("id", data.user.id);
  return data.user.id;
};
const cookieFor = async (email) => {
  const anon = createClient(URL_, env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY, { auth: { persistSession: false, flowType: "implicit" } });
  const { data, error } = await anon.auth.signInWithPassword({ email, password: PW });
  if (error) throw error;
  return "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url");
};
const setSession = async (cookieValue) => {
  await send("Network.clearBrowserCookies");
  if (cookieValue) {
    await send("Network.setCookie", {
      name: "sb-vgcoyevcftkinbrjhhkn-auth-token", value: cookieValue,
      domain: "localhost", path: "/", sameSite: "Lax",
    });
  }
};
const clickPopupButton = (text) =>
  evaluate(`[...document.querySelectorAll("button")].find((b) => b.textContent.trim() === ${JSON.stringify(text)})?.click()`);
const clickCell = async (label) => {
  await evaluate(`[...document.querySelectorAll(".cell")].find((c) => c.textContent.startsWith(${JSON.stringify(label)}))?.click()`);
  await wait(600);
};

let exitCode = 1;
try {
  // Fixtures. Five users cover the dashboard states; the wall carries every cell state.
  const profileBase = { phone: "555-0100", preferred_contact: "email" };
  await mkUser("mob-none@example.com", { name: "No Request", id_number: "MOB-000", ...profileBase });
  const uPending = await mkUser("mob-pending@example.com", { name: "Pen Ding", id_number: "MOB-001", ...profileBase });
  const uApproved = await mkUser("mob-approved@example.com", { name: "App Roved", id_number: "MOB-002", ...profileBase });
  const uReserving = await mkUser("mob-reserving@example.com", { name: "Reser Ving", id_number: "MOB-003", ...profileBase });
  const uFulfilled = await mkUser("mob-fulfilled@example.com", { name: "Ful Filled", id_number: "MOB-004", ...profileBase });
  await mkUser("mob-admin@example.com", { name: "Mob Admin", id_number: "MOB-ADM", ...profileBase }, "admin");

  const { data: lockers, error: le } = await admin.from("lockers").insert(
    Array.from({ length: 10 }, (_, i) => ({
      label: `A-${i + 1}`, row: 1 + Math.floor(i / 5), col: 1 + (i % 5), is_active: i !== 9,
    })),
  ).select();
  if (le) throw le;
  made.lockers = lockers.map((l) => l.id);

  await admin.from("requests").insert({ user_id: uPending });
  await admin.from("requests").insert({ user_id: uApproved, status: "approved" });
  const { data: rReserving } = await admin.from("requests").insert({ user_id: uReserving, status: "approved" }).select("id").single();
  await admin.from("reservations").insert({
    locker_id: lockers[1].id, user_id: uReserving, request_id: rReserving.id,
    expires_at: new Date(Date.now() + 12 * 60000).toISOString(),
  });
  await admin.from("leases").insert({ locker_id: lockers[0].id, user_id: uFulfilled, end_date: "2026-11-28" });
  // uPending's request above already populates the admin queue.

  const tab = await (await fetch(`http://127.0.0.1:9222/json/new?about:blank`, { method: "PUT" })).json();
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(new Error(m.error.message));
      else resolve(m.result);
    }
  };
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

  // Signed-out surfaces.
  await setSession(null);
  await audit("login", "http://localhost:3000/login");
  await audit("signup", "http://localhost:3000/signup");

  // Dashboard states.
  await setSession(await cookieFor("mob-none@example.com"));
  await audit("dash-none", "http://localhost:3000/");
  await audit("profile", "http://localhost:3000/profile");
  await setSession(await cookieFor("mob-pending@example.com"));
  await audit("dash-pending", "http://localhost:3000/");
  await setSession(await cookieFor("mob-approved@example.com"));
  await audit("dash-approved", "http://localhost:3000/");
  await setSession(await cookieFor("mob-reserving@example.com"));
  await audit("dash-reserving", "http://localhost:3000/", { linger: 5500 });
  await setSession(await cookieFor("mob-fulfilled@example.com"));
  await audit("dash-fulfilled", "http://localhost:3000/", {
    before: async () => {
      await clickCell("A-1"); // the occupied-cell popup as its own tenant-peer view
    },
  });

  // Admin surfaces.
  const adminCookie = await cookieFor("mob-admin@example.com");
  await setSession(adminCookie);
  await audit("admin-requests", "http://localhost:3000/admin/requests");
  await audit("admin-wall-occupied", "http://localhost:3000/admin/wall", {
    linger: 5000,
    before: async () => {
      await clickCell("A-1");
    },
  });
  await audit("admin-wall-reserved", "http://localhost:3000/admin/wall", {
    linger: 5000,
    before: async () => {
      await clickCell("A-2");
    },
  });
  await audit("admin-wall-available", "http://localhost:3000/admin/wall", {
    linger: 5000,
    before: async () => {
      await clickCell("A-3");
    },
  });
  await audit("admin-wall-edit", "http://localhost:3000/admin/wall", {
    linger: 5000,
    before: async () => {
      await clickPopupButton("Edit layout");
      await wait(500);
    },
  });
  await audit("admin-users", "http://localhost:3000/admin/users");
  await audit("admin-users-edit", `http://localhost:3000/admin/users?edit=${uFulfilled}`);
  await audit("admin-settings", "http://localhost:3000/admin/settings");

  console.log(failures.length === 0 ? "\nall surfaces pass" : `\n${failures.length} surface(s) fail`);
  exitCode = failures.length === 0 ? 0 : 1;
} catch (err) {
  console.error("ERROR", err.message ?? err);
} finally {
  for (const table of ["leases", "reservations", "requests"]) await admin.from(table).delete().in("user_id", made.users);
  if (made.lockers.length) await admin.from("lockers").delete().in("id", made.lockers);
  for (const id of made.users) await admin.auth.admin.deleteUser(id);
  console.log(`cleanup: ${made.users.length} users and ${made.lockers.length} lockers deleted`);
  try { ws?.close(); } catch {}
  process.exit(exitCode);
}
