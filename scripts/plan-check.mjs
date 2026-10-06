#!/usr/bin/env node
// Compares the git history against docs/plan.html and reports deviations.
//
//   node scripts/plan-check.mjs            report, exit 1 on errors
//   node scripts/plan-check.mjs --write    also write docs/progress.js for plan.html
//   node scripts/plan-check.mjs --verify   also run each started sprint's data-verify command
//
// Conventions (see CLAUDE.md):
//   branch per sprint: sprint-N, merged into main with --no-ff, merge commit tagged v0.N
//   commit subject starts with the task id(s): "S1-3: Firestore data model"
//   direct commits on main may only touch planning files (PLAN_PATHS)

import { execFileSync, execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLAN_FILE = join(ROOT, "docs", "plan.html");
const PROGRESS_FILE = join(ROOT, "docs", "progress.js");
const PLAN_PATHS = [/^docs\//, /^README(\.[a-z]{2})?\.md$/, /^CLAUDE\.md$/, /^LICENSE$/, /^\.gitignore$/, /^\.gitattributes$/, /^scripts\/plan-check\.mjs$/, /^\.github\//];
const TASK_ID = /\bS(\d+)-(\d+)\b/g;

const args = new Set(process.argv.slice(2));

function git(...argv) {
  return execFileSync("git", argv, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 }).trimEnd();
}
function tryGit(...argv) {
  try { return git(...argv); } catch { return null; }
}
function isAncestor(a, b) {
  try { execFileSync("git", ["merge-base", "--is-ancestor", a, b], { cwd: ROOT, stdio: "ignore" }); return true; } catch { return false; }
}
function stripTags(s) {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}
const tagForSprint = (n) => `v0.${n}`;

// ---------- plan ----------
const html = readFileSync(PLAN_FILE, "utf8");
const sprints = [];
for (const m of html.matchAll(/<details class="sprint[^"]*"([^>]*)>([\s\S]*?)<\/details>/g)) {
  const attr = (name) => (m[1].match(new RegExp(`data-${name}="([^"]*)"`)) || [])[1];
  const sprint = {
    n: Number(attr("sprint")),
    branch: attr("branch"),
    verify: attr("verify") || null,
    gate: attr("gate") === "true",
    title: stripTags((m[2].match(/<h3>([\s\S]*?)<\/h3>/) || [])[1] || ""),
    tasks: [],
  };
  for (const t of m[2].matchAll(/<li data-task="([^"]+)"([^>]*)>([\s\S]*?)<\/li>/g)) {
    const dropped = /data-status="dropped"/.test(t[2]);
    const text = stripTags((t[3].match(/<span class="txt">([\s\S]*?)<\/span>\s*$/) || [])[1] || t[3]);
    sprint.tasks.push({ id: t[1], text, dropped });
  }
  sprints.push(sprint);
}
const taskIndex = new Map(sprints.flatMap((s) => s.tasks.map((t) => [t.id, { ...t, sprint: s.n }])));

// ---------- git ----------
const deviations = [];
const err = (msg) => deviations.push({ level: "error", msg });
const warn = (msg) => deviations.push({ level: "warn", msg });

const refs = (tryGit("for-each-ref", "--format=%(refname)") || "").split("\n").filter(Boolean);
const hasRef = (r) => refs.includes(r);
const mainRef = hasRef("refs/heads/main") ? "main" : hasRef("refs/remotes/origin/main") ? "origin/main" : null;
if (!mainRef) {
  console.error("לא נמצא ענף main (מקומי או origin/main).");
  process.exit(2);
}
function resolveBranch(name) {
  if (hasRef(`refs/heads/${name}`)) return name;
  if (hasRef(`refs/remotes/origin/${name}`)) return `origin/${name}`;
  return null;
}

const SEP = "\x1f";
const commits = new Map();
for (const line of (git("log", "--all", `--format=%H${SEP}%P${SEP}%ad${SEP}%s`, "--date=short") || "").split("\n").filter(Boolean)) {
  const [sha, parents, date, subject] = line.split(SEP);
  // Task IDs count only as the subject's prefix ("S3-1, S3-2: …"), so a plan
  // commit that merely mentions a task ("Plan: drop S9-8, …") does not start its sprint.
  const prefix = subject.match(/^\s*(S\d+-\d+(?:\s*,\s*S\d+-\d+)*)\s*:/)?.[1] ?? "";
  const ids = [...prefix.matchAll(TASK_ID)].map((x) => x[0]);
  commits.set(sha, { sha, short: sha.slice(0, 7), parents: parents.split(" ").filter(Boolean), date, subject, ids });
}
const onMain = new Set(git("rev-list", mainRef).split("\n").filter(Boolean));
const mainFirstParent = git("rev-list", "--first-parent", mainRef).split("\n").filter(Boolean);

// commits unique to each sprint branch
const sprintState = {};
const branchOf = new Map();
for (const s of sprints) {
  const ref = resolveBranch(s.branch);
  const tag = tagForSprint(s.n);
  const tagExists = hasRef(`refs/tags/${tag}`);
  const unique = ref ? git("rev-list", `${mainRef}..${ref}`).split("\n").filter(Boolean) : [];
  for (const sha of unique) if (!branchOf.has(sha)) branchOf.set(sha, s.n);
  const merged = ref ? unique.length === 0 : false;
  const started = Boolean(ref) || tagExists || [...commits.values()].some((c) => c.ids.some((id) => taskIndex.get(id)?.sprint === s.n));
  const dropped = s.tasks.length > 0 && s.tasks.every((t) => t.dropped);
  sprintState[s.n] = { branch: s.branch, ref, tag, tagExists, merged, started, dropped, closed: tagExists || dropped, verify: s.verify ? { cmd: s.verify, ok: null } : null };
  if (dropped && ref) warn(`ספרינט ${s.n} בוטל בתוכנית, אבל הענף ${s.branch} קיים.`);

  if (tagExists && !isAncestor(tag, mainRef)) err(`התגית ${tag} לא נמצאת על main. ספרינט נסגר רק אחרי מיזוג.`);
  if (tagExists && ref && unique.length) err(`ספרינט ${s.n} סגור (${tag}), אבל בענף ${s.branch} יש ${unique.length} קומיטים שלא מוזגו.`);
}

// commits of sprint branches that were already merged: attribute them through the merge commit on main
for (const sha of mainFirstParent) {
  const c = commits.get(sha);
  if (!c || c.parents.length < 2) continue;
  const m = c.subject.match(/sprint-(\d+)/);
  if (!m) continue;
  for (const x of git("rev-list", `${c.parents[0]}..${c.parents[1]}`).split("\n").filter(Boolean)) {
    if (!branchOf.has(x)) branchOf.set(x, Number(m[1]));
  }
}

// task status
const taskState = {};
for (const [id, t] of taskIndex) {
  const refs = [...commits.values()].filter((c) => c.ids.includes(id));
  const merged = refs.filter((c) => onMain.has(c.sha));
  let status = t.dropped ? "dropped" : merged.length ? "done" : refs.length ? "progress" : "todo";
  taskState[id] = {
    status,
    commits: refs.map((c) => ({ sha: c.short, date: c.date, subject: c.subject, onMain: onMain.has(c.sha) })),
  };
  if (status === "todo" && sprintState[t.sprint].closed) err(`${id} לא בוצעה, אבל ספרינט ${t.sprint} כבר נסגר. לבצע, או לסמן data-status="dropped" בתוכנית עם סיבה.`);
  if (status === "progress" && sprintState[t.sprint].closed) err(`${id} יש לה קומיטים שלא הגיעו ל-main, אבל ספרינט ${t.sprint} כבר נסגר.`);
}

// commits that reference unknown tasks, or tasks of another sprint
for (const c of commits.values()) {
  for (const id of c.ids) {
    if (!taskIndex.has(id)) err(`${c.short} "${c.subject}" מפנה ל-${id}, שלא קיימת בתוכנית.`);
  }
  const sprintN = branchOf.get(c.sha);
  if (sprintN === undefined) continue;
  if (c.parents.length > 1) continue;
  if (!c.ids.length) warn(`${c.short} "${c.subject}" בענף sprint-${sprintN} בלי מזהה משימה.`);
  for (const id of c.ids) {
    const t = taskIndex.get(id);
    if (t && t.sprint !== sprintN) warn(`${c.short} בענף sprint-${sprintN} מפנה ל-${id} מספרינט ${t.sprint}.`);
  }
}

// direct commits on main may only touch planning files
for (const sha of mainFirstParent) {
  const c = commits.get(sha);
  if (!c || c.parents.length > 1) continue;
  const files = git("show", "--name-only", "--format=", sha).split("\n").filter(Boolean);
  const outside = files.filter((f) => !PLAN_PATHS.some((re) => re.test(f)));
  if (outside.length) err(`${c.short} "${c.subject}" נכנס ישירות ל-main ונוגע בקוד: ${outside.slice(0, 3).join(", ")}${outside.length > 3 ? "…" : ""}`);
}

// sprint order
for (const s of sprints) {
  if (s.n === 0 || !sprintState[s.n].started) continue;
  const prev = sprintState[s.n - 1];
  if (prev.closed) continue;
  const gate = sprints.find((x) => x.n === s.n - 1)?.gate;
  (gate ? err : warn)(`ספרינט ${s.n} התחיל לפני שספרינט ${s.n - 1} נסגר${gate ? " — וזה שער החלטה" : ""}.`);
}

// verify commands
if (args.has("--verify")) {
  for (const s of sprints) {
    const st = sprintState[s.n];
    if (!st.started || !st.verify) continue;
    process.stdout.write(`\nספרינט ${s.n}: ${st.verify.cmd}\n`);
    try {
      execSync(st.verify.cmd, { cwd: ROOT, stdio: "inherit" });
      st.verify.ok = true;
    } catch {
      st.verify.ok = false;
      err(`פקודת האימות של ספרינט ${s.n} נכשלה: ${st.verify.cmd}`);
    }
  }
}

// ---------- report ----------
const label = { done: "בוצע", progress: "בעבודה", todo: "לא התחיל", dropped: "בוטל" };
const lines = [];
lines.push(`בדיקת תוכנית מול git — ${mainRef} @ ${git("rev-parse", "--short", mainRef)}`);
for (const s of sprints) {
  const st = sprintState[s.n];
  const counts = { done: 0, progress: 0, todo: 0, dropped: 0 };
  for (const t of s.tasks) counts[taskState[t.id].status]++;
  const active = s.tasks.length - counts.dropped;
  const state = st.dropped ? "בוטל" : st.closed ? `סגור (${st.tag})` : st.ref ? `פתוח בענף ${st.ref}` : st.started ? "התחיל" : "לא התחיל";
  lines.push(`  ספרינט ${s.n} ${s.title}: ${counts.done}/${active} — ${state}`);
  if (st.started && !st.closed) {
    for (const t of s.tasks) {
      const ts = taskState[t.id];
      if (ts.status !== "done") lines.push(`      ${t.id} ${label[ts.status]}: ${t.text.slice(0, 70)}`);
    }
  }
}
const errors = deviations.filter((d) => d.level === "error");
const warns = deviations.filter((d) => d.level === "warn");
lines.push("");
lines.push(errors.length || warns.length ? `סטיות: ${errors.length} שגיאות, ${warns.length} אזהרות` : "אין סטיות מהתוכנית.");
for (const d of deviations) lines.push(`  ${d.level === "error" ? "שגיאה" : "אזהרה"}: ${d.msg}`);
console.log(lines.join("\n"));

if (args.has("--write")) {
  const progress = {
    generatedAt: new Date().toISOString(),
    mainRef,
    head: git("rev-parse", "--short", "HEAD"),
    branch: tryGit("rev-parse", "--abbrev-ref", "HEAD"),
    sprints: sprintState,
    tasks: taskState,
    deviations,
    graph: git("log", "--graph", "--all", "--date-order", "--format=%h%d %s", "-n", "300"),
  };
  writeFileSync(PROGRESS_FILE, `// generated by scripts/plan-check.mjs --write\nwindow.PLAN_PROGRESS = ${JSON.stringify(progress, null, 2)};\n`);
  console.log(`\nנכתב ${PROGRESS_FILE}`);
}

process.exit(errors.length ? 1 : 0);
