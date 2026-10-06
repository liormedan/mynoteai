import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import {
  propsFromInput,
  rowToRecord,
  describeDatabase,
} from "@/lib/database/input";
import { addOption, addProperty, addView } from "@/lib/database/schema";
import type { Database, PropertyType } from "@/lib/database/types";
import { parseDatabase, parseProps, type Row } from "@/lib/database/values";
import { markdownToBlocks } from "@/lib/markdown/from-markdown";
import { blocksToMarkdown } from "@/lib/markdown/to-markdown";
import type { Page } from "@/lib/pages/model";
import { blocksToPlainText } from "@/lib/pages/plain-text";
import {
  ancestors,
  buildTree,
  flatten,
  positionBetween,
} from "@/lib/pages/tree";
import { SearchEngine } from "@/lib/search/engine";
import { snippet } from "@/lib/search/hebrew";
import { adminDb } from "./firebase-admin";

/*
 * The notebook as the owner sees it, read and written with admin rights for
 * the MCP server. Writes keep the same document shape the app writes (and
 * the security rules check): the app picks them up through its listeners.
 */

const PAGES = "pages";
/** Firestore documents stop at 1 MiB; the app uses the same limit. */
const MAX_BLOCKS_BYTES = 900_000;

type Timestampish = { toDate: () => Date } | null | undefined;
const toDate = (v: unknown) =>
  v && typeof (v as Timestampish)?.toDate === "function"
    ? (v as { toDate: () => Date }).toDate()
    : new Date(0);

function toPage(id: string, d: Record<string, unknown>): Page {
  return {
    id,
    title: typeof d.title === "string" ? d.title : "",
    icon: typeof d.icon === "string" ? d.icon : null,
    coverUrl: typeof d.coverUrl === "string" ? d.coverUrl : null,
    parentId: typeof d.parentId === "string" ? d.parentId : null,
    position: typeof d.position === "number" ? d.position : 0,
    type: d.type === "database" ? "database" : "page",
    isArchived: d.isArchived === true,
    isFavorite: d.isFavorite === true,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
    contentUpdatedAt: d.contentUpdatedAt ? toDate(d.contentUpdatedAt) : null,
    props: parseProps(d.props),
    database: d.type === "database" ? parseDatabase(d.database) : null,
  };
}

export class NotFoundError extends Error {}
export class InputError extends Error {}

const pagesRef = () => adminDb().collection(PAGES);
const contentRef = (id: string) =>
  pagesRef().doc(id).collection("content").doc("main");

export async function allPages(): Promise<Page[]> {
  const snap = await pagesRef().get();
  return snap.docs.map((d) => toPage(d.id, d.data()));
}

/** Live pages only: not in the trash and not under a page in the trash. */
export async function livePages() {
  const all = await allPages();
  return {
    all,
    live: flatten(buildTree(all)),
    byId: new Map(all.map((p) => [p.id, p])),
  };
}

async function requirePage(id: string) {
  const { all, live, byId } = await livePages();
  const page = live.find((p) => p.id === id);
  if (!page)
    throw new NotFoundError(`No page with id "${id}" (or it is in the trash).`);
  return { page, all, live, byId };
}

export const pathOf = (byId: Map<string, Page>, page: Page) =>
  [
    ...ancestors(byId, page.id).map((p) => p.title || "Untitled"),
    page.title || "Untitled",
  ].join(" / ");

async function readBlocks(
  id: string,
): Promise<{ blocks: unknown[]; plainText: string }> {
  const snap = await contentRef(id).get();
  const d = snap.data() ?? {};
  let blocks: unknown[] = [];
  try {
    blocks = JSON.parse(typeof d.blocks === "string" ? d.blocks : "[]");
  } catch {
    // An unreadable document reads as empty, as in the app.
  }
  return {
    blocks,
    plainText: typeof d.plainText === "string" ? d.plainText : "",
  };
}

async function writeBlocks(id: string, blocks: unknown[]) {
  const json = JSON.stringify(blocks);
  if (new TextEncoder().encode(json).length > MAX_BLOCKS_BYTES) {
    throw new InputError(
      "The page would be larger than Firestore allows (about 900 KB).",
    );
  }
  const batch = adminDb().batch();
  batch.set(contentRef(id), {
    blocks: json,
    plainText: blocksToPlainText(blocks),
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.update(pagesRef().doc(id), {
    updatedAt: FieldValue.serverTimestamp(),
    contentUpdatedAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
}

/* ---------- search ---------- */

/** Text of each page, kept while the server instance stays warm. */
const textCache = new Map<string, { at: number; text: string }>();

export async function searchPages(query: string, limit: number) {
  const { live, byId } = await livePages();
  const engine = new SearchEngine();
  const stale = live.filter((p) => {
    const at = (p.contentUpdatedAt ?? p.updatedAt).getTime();
    return textCache.get(p.id)?.at !== at;
  });
  // Read only what changed since the last search on this instance.
  for (let i = 0; i < stale.length; i += 20) {
    await Promise.all(
      stale.slice(i, i + 20).map(async (p) => {
        const { plainText } = await readBlocks(p.id);
        textCache.set(p.id, {
          at: (p.contentUpdatedAt ?? p.updatedAt).getTime(),
          text: plainText,
        });
      }),
    );
  }
  for (const p of live)
    engine.set({
      id: p.id,
      title: p.title,
      text: textCache.get(p.id)?.text ?? "",
    });
  return engine.search(query, limit).map((hit) => {
    const page = byId.get(hit.id)!;
    const s = snippet(textCache.get(hit.id)?.text ?? "", hit.terms, 60);
    return {
      id: page.id,
      title: page.title,
      type: page.type,
      path: pathOf(byId, page),
      snippet: s ? `${s.before}${s.match}${s.after}` : "",
    };
  });
}

/* ---------- reading ---------- */

export async function outline(parentId: string | null, depth: number) {
  const { live, byId } = await livePages();
  if (parentId && !byId.has(parentId))
    throw new NotFoundError(`No page with id "${parentId}".`);
  const children = (id: string | null) =>
    live
      .filter((p) => p.parentId === id)
      .sort((a, b) => a.position - b.position);
  const lines: string[] = [];
  const walk = (id: string | null, level: number) => {
    for (const p of children(id)) {
      const isDb = p.type === "database";
      const rows = isDb ? children(p.id).length : 0;
      lines.push(
        `${"  ".repeat(level)}- ${p.icon ? p.icon + " " : ""}${p.title || "Untitled"} (id: ${p.id}${isDb ? `, database, ${rows} rows` : ""})`,
      );
      // Database rows are listed by query_database, not here.
      if (!isDb && level + 1 < depth) walk(p.id, level + 1);
    }
  };
  walk(parentId, 0);
  return lines.join("\n") || "(no pages)";
}

export async function readPage(id: string) {
  const { page, live, byId } = await requirePage(id);
  const parent = page.parentId ? byId.get(page.parentId) : undefined;
  const titles = (pid: string) => byId.get(pid)?.title;
  const head = [
    `# ${page.icon ? page.icon + " " : ""}${page.title || "Untitled"}`,
    "",
    `- id: ${page.id}`,
    `- path: ${pathOf(byId, page)}`,
    `- type: ${page.type}`,
    `- updated: ${page.updatedAt.toISOString()}`,
  ];
  if (parent?.type === "database" && parent.database) {
    const record = rowToRecord(parent.database, asRow(page));
    head.push(`- database: ${parent.title} (id: ${parent.id})`);
    for (const [k, v] of Object.entries(record)) {
      if (k !== "title")
        head.push(`- ${k}: ${Array.isArray(v) ? v.join(", ") : (v ?? "")}`);
    }
  }
  const sub = live.filter(
    (p) => p.parentId === page.id && page.type !== "database",
  );
  if (sub.length)
    head.push(
      `- subpages: ${sub.map((p) => `${p.title || "Untitled"} (id: ${p.id})`).join("; ")}`,
    );
  if (page.type === "database" && page.database) {
    head.push("", "Fields:", JSON.stringify(describeDatabase(page.database)));
    head.push("", "Use query_database to read its rows.");
  }
  const { blocks } = await readBlocks(page.id);
  const body = blocksToMarkdown(blocks, titles).trim();
  return [...head, "", "---", "", body || "(empty)"].join("\n");
}

const asRow = (p: Page): Row => ({
  id: p.id,
  title: p.title,
  position: p.position,
  props: p.props,
});

async function requireDatabase(id: string) {
  const ctx = await requirePage(id);
  if (ctx.page.type !== "database" || !ctx.page.database) {
    throw new InputError(`Page "${ctx.page.title}" is not a database.`);
  }
  return { ...ctx, database: ctx.page.database };
}

export async function queryDatabase(
  id: string,
  where: Record<string, unknown>,
  limit: number,
) {
  const { page, live, database } = await requireDatabase(id);
  const rows = live
    .filter((p) => p.parentId === page.id)
    .sort((a, b) => a.position - b.position)
    .map((p) => ({ id: p.id, ...rowToRecord(database, asRow(p)) }));
  const matches = rows.filter((r) =>
    Object.entries(where).every(([key, want]) => {
      const k = Object.keys(r).find(
        (x) => x.toLocaleLowerCase() === key.toLocaleLowerCase(),
      );
      if (!k) return false;
      const have = (r as Record<string, unknown>)[k];
      const norm = (v: unknown) => String(v ?? "").toLocaleLowerCase();
      return Array.isArray(have)
        ? have.some((h) => norm(h) === norm(want))
        : norm(have) === norm(want);
    }),
  );
  return {
    database: page.title,
    fields: describeDatabase(database),
    total: matches.length,
    rows: matches.slice(0, limit),
  };
}

/* ---------- writing ---------- */

async function nextPosition(all: Page[], parentId: string | null) {
  const siblings = all
    .filter((p) => p.parentId === parentId)
    .sort((a, b) => a.position - b.position);
  return positionBetween(siblings.at(-1)?.position, undefined);
}

export async function createPage(input: {
  title: string;
  parentId: string | null;
  markdown?: string;
  icon?: string | null;
}) {
  const { all, byId } = await livePages();
  const parent = input.parentId ? byId.get(input.parentId) : null;
  if (input.parentId && !parent)
    throw new NotFoundError(`No page with id "${input.parentId}".`);
  if (parent?.type === "database") {
    throw new InputError(
      "That is a database: use add_database_row to add a row to it.",
    );
  }
  return insertPage(all, input.parentId, {
    title: input.title,
    icon: input.icon ?? null,
    blocks: markdownToBlocks(input.markdown ?? ""),
  });
}

async function insertPage(
  all: Page[],
  parentId: string | null,
  seed: {
    title: string;
    icon?: string | null;
    blocks?: unknown[];
    props?: Record<string, unknown>;
  },
) {
  const ref = pagesRef().doc();
  const blocks = seed.blocks ?? [];
  const batch = adminDb().batch();
  batch.set(ref, {
    title: seed.title.slice(0, 500),
    icon: seed.icon ?? null,
    coverUrl: null,
    parentId,
    position: await nextPosition(all, parentId),
    type: "page",
    ...(seed.props ? { props: seed.props } : {}),
    isArchived: false,
    isFavorite: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    contentUpdatedAt: FieldValue.serverTimestamp(),
  });
  batch.set(ref.collection("content").doc("main"), {
    blocks: JSON.stringify(blocks),
    plainText: blocksToPlainText(blocks),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
  return ref.id;
}

export async function appendToPage(id: string, markdown: string) {
  const { page } = await requirePage(id);
  if (page.type === "database")
    throw new InputError("Databases have no text to append to.");
  const { blocks } = await readBlocks(id);
  // BlockNote keeps an empty paragraph at the end; write after real content.
  const isEmptyParagraph = (b: unknown) =>
    typeof b === "object" &&
    b !== null &&
    (b as { type?: string }).type === "paragraph" &&
    !blocksToPlainText([b]);
  while (blocks.length && isEmptyParagraph(blocks.at(-1))) blocks.pop();
  const added = markdownToBlocks(markdown);
  if (!added.length) throw new InputError("Nothing to append.");
  await writeBlocks(id, [...blocks, ...added]);
  return added.length;
}

export async function updatePage(
  id: string,
  patch: { title?: string; icon?: string | null },
) {
  await requirePage(id);
  const update: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (patch.title !== undefined) update.title = patch.title.slice(0, 500);
  if (patch.icon !== undefined) update.icon = patch.icon || null;
  await pagesRef().doc(id).update(update);
}

export async function trashPage(id: string) {
  const { page } = await requirePage(id);
  await pagesRef()
    .doc(id)
    .update({ isArchived: true, updatedAt: FieldValue.serverTimestamp() });
  return page.title;
}

async function saveDefinition(id: string, before: Database, after: Database) {
  if (after === before) return;
  await pagesRef()
    .doc(id)
    .update({ database: after, updatedAt: FieldValue.serverTimestamp() });
}

export async function addDatabaseRow(
  databaseId: string,
  title: string,
  values: Record<string, unknown>,
  markdown?: string,
) {
  const { all, database } = await requireDatabase(databaseId);
  const { props, db, errors } = propsFromInput(database, values);
  if (errors.length) throw new InputError(errors.join("\n"));
  await saveDefinition(databaseId, database, db);
  return insertPage(all, databaseId, {
    title,
    props,
    blocks: markdownToBlocks(markdown ?? ""),
  });
}

export async function updateDatabaseRow(
  rowId: string,
  patch: { title?: string; values?: Record<string, unknown> },
) {
  const { page, byId } = await requirePage(rowId);
  const parent = page.parentId ? byId.get(page.parentId) : undefined;
  if (!parent || parent.type !== "database" || !parent.database) {
    throw new InputError(`Page "${page.title}" is not a database row.`);
  }
  const { props, db, errors } = propsFromInput(
    parent.database,
    patch.values ?? {},
  );
  if (errors.length) throw new InputError(errors.join("\n"));
  await saveDefinition(parent.id, parent.database, db);
  const update: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (patch.title !== undefined) update.title = patch.title.slice(0, 500);
  for (const [k, v] of Object.entries(props)) update[`props.${k}`] = v;
  await pagesRef().doc(rowId).update(update);
}

/** A database with the given fields, a table view, and a board when a select field exists. */
export async function createDatabase(input: {
  title: string;
  parentId: string | null;
  fields: { name: string; type: PropertyType; options?: string[] }[];
}) {
  const { all, byId } = await livePages();
  const parent = input.parentId ? byId.get(input.parentId) : null;
  if (input.parentId && !parent)
    throw new NotFoundError(`No page with id "${input.parentId}".`);
  let db: Database = { properties: [], views: [] };
  for (const field of input.fields) {
    const added = addProperty(db, field.name, field.type);
    db = added.db;
    for (const option of field.options ?? [])
      db = addOption(db, added.id!, option).db;
  }
  db = addView(db, "table", "Table").db;
  if (db.properties.some((p) => p.type === "select"))
    db = addView(db, "board", "Board").db;
  const ref = pagesRef().doc();
  const batch = adminDb().batch();
  batch.set(ref, {
    title: input.title.slice(0, 500),
    icon: null,
    coverUrl: null,
    parentId: input.parentId,
    position: await nextPosition(all, input.parentId),
    type: "database",
    database: db,
    isArchived: false,
    isFavorite: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.set(ref.collection("content").doc("main"), {
    blocks: "[]",
    plainText: "",
    updatedAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
  return ref.id;
}
