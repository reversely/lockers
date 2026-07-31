#!/usr/bin/env node
/**
 * Coordination ledger for agents that share `main`.
 *
 * Claims live one JSON file per issue under `claims/` rather than in a single shared ledger.
 * Two agents claiming at the same moment would rewrite the same blob and conflict on every
 * claim; separate files never overlap textually.
 *
 * Usage:
 *   node .claude/coordination/coord.mjs claim <N> [path...]
 *   node .claude/coordination/coord.mjs close <N>
 *   node .claude/coordination/coord.mjs check
 *   node .claude/coordination/coord.mjs list
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CLAIMS_DIR = join(HERE, "claims");
const REMOTE_BRANCH = "origin/main";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function gitQuiet(args) {
  try {
    execFileSync("git", args, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function lines(text) {
  return text.split("\n").filter(Boolean);
}

function agentId() {
  return process.env.CLAUDE_AGENT_ID ?? basename(git(["rev-parse", "--show-toplevel"]));
}

function hasRemoteMain() {
  return gitQuiet(["rev-parse", "--verify", "--quiet", REMOTE_BRANCH]);
}

/** Every path this working copy has touched: committed since `base`, staged, unstaged, untracked. */
function touchedFiles(base) {
  const sources = [
    ["diff", "--name-only", `${base}..HEAD`],
    ["diff", "--name-only", "--cached"],
    ["diff", "--name-only"],
    ["ls-files", "--others", "--exclude-standard"],
  ];
  const touched = new Set();
  for (const args of sources) {
    for (const path of lines(git(args))) touched.add(path);
  }
  return [...touched].sort();
}

function analyse() {
  const fetched = gitQuiet(["fetch", "origin", "main", "--quiet"]);
  if (!hasRemoteMain()) {
    return { status: "no-remote", fetched, mine: touchedFiles("HEAD"), clashes: [] };
  }
  const base = git(["merge-base", "HEAD", REMOTE_BRANCH]);
  const mine = touchedFiles(base);
  // Set membership keeps this O(n+m) instead of scanning the landed list per file.
  const landed = new Set(lines(git(["diff", "--name-only", `${base}..${REMOTE_BRANCH}`])));
  return { status: mine.some((f) => landed.has(f)) ? "conflict" : "clean", fetched, base, mine, clashes: mine.filter((f) => landed.has(f)) };
}

function readClaims() {
  if (!existsSync(CLAIMS_DIR)) return [];
  return readdirSync(CLAIMS_DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => JSON.parse(readFileSync(join(CLAIMS_DIR, name), "utf8")))
    .sort((a, b) => a.issue - b.issue);
}

function writeClaim(claim) {
  mkdirSync(CLAIMS_DIR, { recursive: true });
  writeFileSync(join(CLAIMS_DIR, `${claim.issue}.json`), `${JSON.stringify(claim, null, 2)}\n`);
}

/** Open claims held by another issue that name a file this issue also touches. */
function overlappingClaims(issue, files) {
  const mine = new Set(files);
  return readClaims()
    .filter((claim) => claim.issue !== issue && !claim.closed)
    .map((claim) => ({ issue: claim.issue, agent: claim.agent, files: claim.files.filter((f) => mine.has(f)) }))
    .filter((overlap) => overlap.files.length > 0);
}

function reportRemote(result) {
  if (!result.fetched) console.log("warn: could not fetch origin/main, checked against the local copy");
  if (result.status === "no-remote") {
    console.log("origin/main does not exist yet, so nothing can conflict");
    return 0;
  }
  if (result.status === "conflict") {
    console.log(`CONFLICT: ${result.clashes.length} file(s) also changed on origin/main since ${result.base.slice(0, 8)}`);
    for (const path of result.clashes) console.log(`  ${path}`);
    console.log("Rebase on origin/main and re-run before pushing.");
    return 1;
  }
  console.log(`clean: ${result.mine.length} file(s) touched, none changed on origin/main`);
  return 0;
}

function requireIssue(raw) {
  const issue = Number.parseInt(raw ?? "", 10);
  if (!Number.isInteger(issue) || issue <= 0) {
    console.error("usage: coord.mjs <claim|close> <issue-number>");
    process.exit(2);
  }
  return issue;
}

function cmdClaim(argv) {
  const issue = requireIssue(argv[0]);
  const paths = argv.slice(1);
  const files = paths.length > 0 ? [...new Set(paths)].sort() : analyse().mine;
  const overlaps = overlappingClaims(issue, files);
  for (const overlap of overlaps) {
    console.log(`warn: #${overlap.issue} (${overlap.agent}) already claims ${overlap.files.join(", ")}`);
  }
  writeClaim({ issue, agent: agentId(), files, opened: new Date().toISOString(), closed: null });
  console.log(`claimed #${issue}: ${files.length} file(s)`);
  return overlaps.length > 0 ? 1 : 0;
}

function cmdClose(argv) {
  const issue = requireIssue(argv[0]);
  const result = analyse();
  writeClaim({ issue, agent: agentId(), files: result.mine, opened: readClaims().find((c) => c.issue === issue)?.opened ?? new Date().toISOString(), closed: new Date().toISOString() });
  console.log(`#${issue} touched ${result.mine.length} file(s):`);
  for (const path of result.mine) console.log(`  ${path}`);
  for (const overlap of overlappingClaims(issue, result.mine)) {
    console.log(`warn: #${overlap.issue} (${overlap.agent}) also claims ${overlap.files.join(", ")}`);
  }
  return reportRemote(result);
}

function cmdList() {
  const claims = readClaims();
  if (claims.length === 0) {
    console.log("no claims recorded");
    return 0;
  }
  for (const claim of claims) {
    const state = claim.closed ? `closed ${claim.closed}` : "open";
    console.log(`#${claim.issue}  ${state}  ${claim.agent}  ${claim.files.length} file(s)`);
  }
  return 0;
}

const [command, ...argv] = process.argv.slice(2);
const commands = {
  claim: () => cmdClaim(argv),
  close: () => cmdClose(argv),
  check: () => reportRemote(analyse()),
  list: () => cmdList(),
};

if (!command || !(command in commands)) {
  console.error("usage: coord.mjs <claim|close|check|list> [args]");
  process.exit(2);
}
process.exit(commands[command]());
