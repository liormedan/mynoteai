#!/usr/bin/env node
// Seeds the Firestore emulator with sample pages in Hebrew and English.
// Runs inside `firebase emulators:exec` (see scripts/dev.mjs); does nothing if
// pages already exist, so emulator data survives restarts.

import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error(
    "seed: FIRESTORE_EMULATOR_HOST is not set; run it through `pnpm dev`.",
  );
  process.exit(1);
}

const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
const env = await initializeTestEnvironment({
  projectId: "demo-mynoteai",
  firestore: { host, port: Number(port) },
});

const p = (text) => ({ type: "paragraph", content: text });
const h = (level, text) => ({
  type: "heading",
  props: { level },
  content: text,
});
const check = (text, checked = false) => ({
  type: "checkListItem",
  props: { checked },
  content: text,
});
const bullet = (text) => ({ type: "bulletListItem", content: text });

const pages = [
  {
    id: "welcome-he",
    title: "ברוכים הבאים ל-mynoteai",
    icon: "👋",
    parentId: null,
    position: 1,
    blocks: [
      h(1, "ברוכים הבאים"),
      p(
        "זו המחברת האישית שלך. כל עמוד יכול להכיל עמודים נוספים, רשימות, טבלאות וטקסט חופשי.",
      ),
      p(
        "אפשר לערבב עברית ו-English באותו עמוד: כל פסקה מקבלת כיוון לפי השפה שלה.",
      ),
      h(2, "קיצורים שימושיים"),
      bullet("הקלידו / כדי להוסיף בלוק חדש"),
      bullet("גררו בלוק בעזרת הידית שליד הטקסט"),
    ],
  },
  {
    id: "tasks-he",
    title: "רשימת משימות",
    icon: "✅",
    parentId: "welcome-he",
    position: 1,
    blocks: [
      h(2, "השבוע"),
      check("להתקין את mynoteai", true),
      check("לכתוב את הפתק הראשון"),
      check("להזמין את עצמי לקפה"),
    ],
  },
  {
    id: "getting-started-en",
    title: "Getting started",
    icon: "📘",
    parentId: null,
    position: 2,
    blocks: [
      h(1, "Getting started"),
      p(
        "This is your personal notebook. Pages can hold other pages, lists, tables and free text.",
      ),
      p("Type / to insert a block, or drag a block by its handle to move it."),
    ],
  },
];

const plainText = (blocks) =>
  blocks
    .map((b) => b.content)
    .filter(Boolean)
    .join(" ");

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  const existing = await getDocs(query(collection(db, "pages"), limit(1)));
  if (!existing.empty) {
    console.log("seed: emulator already has pages, skipping");
    return;
  }
  const batch = writeBatch(db);
  for (const { id, blocks, ...meta } of pages) {
    batch.set(doc(db, "pages", id), {
      ...meta,
      coverUrl: null,
      type: "page",
      isArchived: false,
      isFavorite: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, "pages", id, "content", "main"), {
      blocks: JSON.stringify(blocks),
      plainText: plainText(blocks),
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
  console.log(`seed: added ${pages.length} sample pages`);
});

await env.cleanup();
