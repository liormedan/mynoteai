"use client";

import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type DocumentReference,
  type Firestore,
} from "firebase/firestore";
import { getFirebase } from "@/lib/firebase/client";
import {
  blocksToPlainText,
  CONTENT,
  MAIN_CONTENT,
  PAGES,
  type Page,
} from "./model";
import { childrenIndex, descendantIds, positionBetween } from "./tree";

/** Firestore allows 500 writes per batch. */
const BATCH_LIMIT = 500;

type Op =
  | { kind: "set"; ref: DocumentReference; data: Record<string, unknown> }
  | { kind: "update"; ref: DocumentReference; data: Record<string, unknown> }
  | { kind: "delete"; ref: DocumentReference };

async function commitInChunks(db: Firestore, ops: Op[]) {
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const op of ops.slice(i, i + BATCH_LIMIT)) {
      if (op.kind === "set") batch.set(op.ref, op.data);
      else if (op.kind === "update") batch.update(op.ref, op.data);
      else batch.delete(op.ref);
    }
    await batch.commit();
  }
}

const pageDoc = (db: Firestore, id: string) => doc(db, PAGES, id);
const contentDoc = (db: Firestore, id: string) =>
  doc(db, PAGES, id, CONTENT, MAIN_CONTENT);

/** Position after the last child of `parentId`. */
export function nextPosition(pages: Page[], parentId: string | null) {
  const siblings = childrenIndex(pages).get(parentId) ?? [];
  return positionBetween(siblings.at(-1)?.position, undefined);
}

export async function patchPage(
  id: string,
  patch: Partial<
    Pick<Page, "title" | "icon" | "coverUrl" | "isFavorite" | "isArchived">
  >,
) {
  await updateDoc(pageDoc(getFirebase().db, id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function movePage(
  id: string,
  parentId: string | null,
  position: number,
) {
  await updateDoc(pageDoc(getFirebase().db, id), {
    parentId,
    position,
    updatedAt: serverTimestamp(),
  });
}

/** Moves a page and its branch to the trash. */
export const archivePage = (id: string) => patchPage(id, { isArchived: true });

export const restorePage = (id: string) => patchPage(id, { isArchived: false });

/** Permanently deletes a page, its whole branch and their content. */
export async function deletePageForever(pages: Page[], id: string) {
  const { db } = getFirebase();
  const ids = [id, ...descendantIds(pages, id)];
  await commitInChunks(
    db,
    ids.flatMap((pid) => [
      { kind: "delete" as const, ref: contentDoc(db, pid) },
      { kind: "delete" as const, ref: pageDoc(db, pid) },
    ]),
  );
}

export async function emptyTrash(pages: Page[]) {
  for (const p of pages.filter((x) => x.isArchived)) {
    await deletePageForever(pages, p.id);
  }
}

/**
 * Copies a page with its whole branch (metadata and content) and places the
 * copy right after the original. Returns the id of the copy.
 */
export async function duplicatePage(
  pages: Page[],
  id: string,
  copySuffix: string,
) {
  const { db } = getFirebase();
  const byId = new Map(pages.map((p) => [p.id, p]));
  const source = byId.get(id);
  if (!source) throw new Error(`Page ${id} not found`);

  // The live branch only: a descendant in the trash is skipped with its subtree.
  const index = childrenIndex(pages);
  const branch: string[] = [];
  const stack = [id];
  while (stack.length) {
    const pid = stack.pop()!;
    branch.push(pid);
    for (const child of index.get(pid) ?? []) {
      if (!child.isArchived && !branch.includes(child.id)) stack.push(child.id);
    }
  }
  const newIds = new Map(
    branch.map((pid) => [pid, doc(collection(db, PAGES)).id]),
  );

  const siblings = childrenIndex(pages).get(source.parentId) ?? [];
  const i = siblings.findIndex((s) => s.id === id);
  const rootPosition = positionBetween(
    source.position,
    siblings[i + 1]?.position,
  );

  const contents = await Promise.all(
    branch.map((pid) => getDoc(contentDoc(db, pid))),
  );

  const ops: Op[] = branch.flatMap((pid, k) => {
    const p = byId.get(pid)!;
    const newId = newIds.get(pid)!;
    const isRoot = pid === id;
    const content = contents[k].data();
    return [
      {
        kind: "set" as const,
        ref: pageDoc(db, newId),
        data: {
          title: isRoot ? `${p.title}${copySuffix}`.slice(0, 500) : p.title,
          icon: p.icon,
          coverUrl: p.coverUrl,
          parentId: isRoot ? p.parentId : newIds.get(p.parentId!)!,
          position: isRoot ? rootPosition : p.position,
          type: p.type,
          isArchived: false,
          isFavorite: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      },
      {
        kind: "set" as const,
        ref: contentDoc(db, newId),
        data: {
          blocks: content?.blocks ?? "[]",
          plainText: content?.plainText ?? "",
          updatedAt: serverTimestamp(),
        },
      },
    ];
  });
  await commitInChunks(db, ops);
  return newIds.get(id)!;
}

export type PageSeed = {
  title?: string;
  icon?: string | null;
  blocks?: unknown[];
};

/** Creates a page under `parentId` (or at the top) from optional content. */
export async function createPageUnder(
  pages: Page[],
  parentId: string | null,
  seed: PageSeed = {},
) {
  const { db } = getFirebase();
  const ref = doc(collection(db, PAGES));
  const blocks = seed.blocks ?? [];
  const batch = writeBatch(db);
  batch.set(ref, {
    title: seed.title ?? "",
    icon: seed.icon ?? null,
    coverUrl: null,
    parentId,
    position: nextPosition(pages, parentId),
    type: "page",
    isArchived: false,
    isFavorite: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(contentDoc(db, ref.id), {
    blocks: JSON.stringify(blocks),
    plainText: blocksToPlainText(blocks as never[]),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  return ref.id;
}
