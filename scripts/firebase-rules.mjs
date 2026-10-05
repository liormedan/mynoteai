#!/usr/bin/env node
// Renders firebase/*.rules from their templates with the install's OWNER_EMAIL.
//
//   node scripts/firebase-rules.mjs            render for local dev (.env.local, then .env.development)
//   node scripts/firebase-rules.mjs --deploy   render from .env.production.local (or .env.local) and deploy
//                                              Firestore rules + indexes to that project
//
// The generated files are git-ignored: every install has its own owner.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATES = ["firestore.rules", "storage.rules"];
const EMAIL = /^[^\s@"\\]+@[^\s@"\\]+\.[^\s@"\\]+$/;

/** Minimal KEY=VALUE reader for .env files (no expansion). */
export function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return env;
}

export function renderRules(template, ownerEmail) {
  const email = String(ownerEmail ?? "")
    .trim()
    .toLowerCase();
  if (!EMAIL.test(email)) {
    throw new Error(
      `OWNER_EMAIL is missing or not a valid email: "${ownerEmail ?? ""}"`,
    );
  }
  return template.replaceAll("{{OWNER_EMAIL}}", email);
}

function loadEnv(deploy) {
  const files = deploy
    ? [".env.local", ".env.production.local"]
    : [".env.development", ".env.local"];
  return Object.assign(
    {},
    ...files.map((f) => readEnvFile(join(ROOT, f))),
    process.env,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const deploy = process.argv.includes("--deploy");
  const env = loadEnv(deploy);

  for (const name of TEMPLATES) {
    const template = readFileSync(
      join(ROOT, "firebase", `${name}.template`),
      "utf8",
    );
    writeFileSync(
      join(ROOT, "firebase", name),
      renderRules(template, env.OWNER_EMAIL),
    );
  }
  console.log(
    `firebase rules rendered for ${env.OWNER_EMAIL.trim().toLowerCase()}`,
  );

  if (deploy) {
    const project = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!project || project.startsWith("demo-")) {
      throw new Error(
        "Set NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env.production.local to your real Firebase project.",
      );
    }
    execFileSync(
      "firebase",
      [
        "deploy",
        "--only",
        "firestore:rules,firestore:indexes",
        "--project",
        project,
      ],
      { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" },
    );
  }
}
