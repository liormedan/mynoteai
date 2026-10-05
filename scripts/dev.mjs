#!/usr/bin/env node
// `pnpm dev`: the whole app on your machine, no Google account needed.
// Renders the security rules, starts the Auth, Firestore and Storage emulators (data kept
// in .firebase/emulator-data between runs), seeds sample pages on first run,
// then starts `next dev`. Ctrl+C stops everything and saves the emulator data.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = ".firebase/emulator-data";
const win = process.platform === "win32";

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: ROOT, stdio: "inherit", shell: win });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(code)));
  });
}

await run("node", ["scripts/firebase-rules.mjs"]);

const args = [
  "emulators:exec",
  "--only",
  "auth,firestore,storage",
  "--project",
  "demo-mynoteai",
  "--ui",
  "--export-on-exit",
  DATA,
];
if (existsSync(join(ROOT, DATA))) args.push("--import", DATA);
args.push(
  win
    ? '"node scripts/seed.mjs && next dev"'
    : "node scripts/seed.mjs && next dev",
);

try {
  await run("firebase", args);
} catch (code) {
  process.exit(typeof code === "number" ? code : 1);
}
