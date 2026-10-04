#!/usr/bin/env node
// Fails when source files use physical Tailwind direction classes (ml-4, pr-2, left-0, text-right…).
// The UI runs in both LTR and RTL, so only logical classes are allowed (ms-4, pe-2, start-0, text-start).
// A line that really needs a physical class can opt out with a trailing `rtl-ok` comment.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCAN = ["src"];
const EXT = /\.(tsx?|jsx?|css)$/;

const PHYSICAL =
  /(?<=^|[\s"'`:!{(])-?(?:m[lr]|p[lr]|scroll-m[lr]|scroll-p[lr]|border-[lr]|rounded-(?:[lr]|[tb][lr])|left|right|text-(?:left|right)|float-(?:left|right)|clear-(?:left|right))(?=-|[\s"'`)}]|$)/g;

const LOGICAL = {
  ml: "ms",
  mr: "me",
  pl: "ps",
  pr: "pe",
  "scroll-ml": "scroll-ms",
  "scroll-mr": "scroll-me",
  "scroll-pl": "scroll-ps",
  "scroll-pr": "scroll-pe",
  "border-l": "border-s",
  "border-r": "border-e",
  "rounded-l": "rounded-s",
  "rounded-r": "rounded-e",
  "rounded-tl": "rounded-ss",
  "rounded-tr": "rounded-se",
  "rounded-bl": "rounded-es",
  "rounded-br": "rounded-ee",
  left: "start",
  right: "end",
  "text-left": "text-start",
  "text-right": "text-end",
  "float-left": "float-start",
  "float-right": "float-end",
  "clear-left": "clear-start",
  "clear-right": "clear-end",
};

export function findPhysicalClasses(source) {
  const hits = [];
  source.split("\n").forEach((line, i) => {
    if (/rtl-ok/.test(line)) return;
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) return; // comment lines
    for (const m of line.matchAll(PHYSICAL)) {
      const cls = m[0].replace(/^-/, "");
      hits.push({ line: i + 1, cls, use: LOGICAL[cls] });
    }
  });
  return hits;
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (EXT.test(name)) yield p;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let count = 0;
  for (const base of SCAN) {
    for (const file of walk(join(ROOT, base))) {
      if (file.endsWith(".test.ts")) continue;
      for (const h of findPhysicalClasses(readFileSync(file, "utf8"))) {
        console.error(
          `${relative(ROOT, file)}:${h.line}  ${h.cls}  →  use ${h.use}`,
        );
        count++;
      }
    }
  }
  if (count) {
    console.error(
      `\n${count} physical direction class(es). Use logical classes, or add "rtl-ok" to the line.`,
    );
    process.exit(1);
  }
  console.log("check-rtl: no physical direction classes.");
}
