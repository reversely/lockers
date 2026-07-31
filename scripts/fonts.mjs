#!/usr/bin/env node
/**
 * Fills `public/fonts/` with the Aeonik weights that `app/tokens.css` declares.
 *
 * Aeonik is licensed from CoType Foundry and this repository is public, so the binaries stay
 * gitignored and get written at build time from whichever source resolves first:
 *
 *   1. AEONIK_FONTS_URL   a URL to the bundle described below, fetched at build time.
 *   2. AEONIK_FONTS_B64   the bundle inline. Each weight is about 48KB gzipped, so three
 *                         weights reach roughly 190KB base64 and exceed Vercel's 64KB cap on
 *                         all environment variables combined. Usable on platforms without
 *                         that cap.
 *   3. ~/Library/Fonts    the local install on a developer machine, or AEONIK_FONTS_DIR.
 *
 * The bundle is base64 of gzip of `{"Aeonik-Regular.ttf": "<base64 of the file>", ...}`.
 * Run `node scripts/fonts.mjs pack` to produce one from the local install.
 *
 * In CI, a run that resolves no source exits 1: a build that silently ships the fallback
 * stack would reach users looking almost right, which is harder to catch than a failed build.
 */

import { gunzipSync, gzipSync } from "node:zlib";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const TARGET_DIR = join(ROOT, "public", "fonts");
const LOCAL_DIR = process.env.AEONIK_FONTS_DIR ?? join(homedir(), "Library", "Fonts");
const WEIGHTS = ["Light", "Regular", "Medium", "Bold"];
const FILES = WEIGHTS.map((weight) => `Aeonik-${weight}.ttf`);
const IS_CI = Boolean(process.env.CI || process.env.VERCEL);

function decodeBundle(base64) {
  return JSON.parse(gunzipSync(Buffer.from(base64, "base64")).toString("utf8"));
}

function writeBundle(bundle) {
  mkdirSync(TARGET_DIR, { recursive: true });
  const written = [];
  for (const [name, content] of Object.entries(bundle)) {
    writeFileSync(join(TARGET_DIR, name), Buffer.from(content, "base64"));
    written.push(name);
  }
  return written;
}

async function fromUrl() {
  const url = process.env.AEONIK_FONTS_URL;
  if (!url) return null;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`AEONIK_FONTS_URL returned ${response.status}`);
  return decodeBundle(await response.text());
}

function fromEnv() {
  const base64 = process.env.AEONIK_FONTS_B64;
  return base64 ? decodeBundle(base64) : null;
}

function fromLocalInstall() {
  const found = FILES.filter((name) => existsSync(join(LOCAL_DIR, name)));
  if (found.length === 0) return null;
  return Object.fromEntries(found.map((name) => [name, readFileSync(join(LOCAL_DIR, name)).toString("base64")]));
}

function pack() {
  const bundle = fromLocalInstall();
  if (!bundle) {
    console.error(`no Aeonik weights in ${LOCAL_DIR}`);
    return 1;
  }
  process.stdout.write(gzipSync(Buffer.from(JSON.stringify(bundle))).toString("base64"));
  process.stdout.write("\n");
  console.error(`packed ${Object.keys(bundle).length} weight(s) from ${LOCAL_DIR}`);
  return 0;
}

async function install() {
  const sources = [
    ["AEONIK_FONTS_URL", fromUrl],
    ["AEONIK_FONTS_B64", fromEnv],
    [LOCAL_DIR, fromLocalInstall],
  ];
  for (const [label, resolve] of sources) {
    const bundle = await resolve();
    if (!bundle) continue;
    const written = writeBundle(bundle);
    console.log(`fonts: wrote ${written.join(", ")} from ${label}`);
    const missing = FILES.filter((name) => !written.includes(name));
    if (missing.length > 0) console.log(`fonts: ${missing.join(", ")} not in that source`);
    return 0;
  }
  const message = "fonts: no source resolved. Set AEONIK_FONTS_URL or AEONIK_FONTS_B64, or install Aeonik locally.";
  if (IS_CI) {
    console.error(message);
    return 1;
  }
  console.warn(`${message} The page falls back to Helvetica Neue.`);
  return 0;
}

// Setting exitCode rather than calling process.exit lets a piped bundle finish flushing.
// process.exit truncates stdout mid-write, and `pack` emits several hundred kilobytes.
const command = process.argv[2] ?? "install";
if (command === "pack") {
  process.exitCode = pack();
} else if (command === "install") {
  process.exitCode = await install();
} else {
  console.error("usage: fonts.mjs [install|pack]");
  process.exitCode = 2;
}
