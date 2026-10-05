"use client";

import type { PartialBlock } from "@blocknote/core";
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { getFirebase } from "@/lib/firebase/client";
import {
  blocksToPlainText,
  CONTENT,
  contentRef,
  MAIN_CONTENT,
  PAGES,
  pageRef,
  type Page,
} from "./model";

/** Firestore rejects documents over 1 MiB; leave room for the other fields. */
export const MAX_BLOCKS_BYTES = 900_000;

export class ContentTooLargeError extends Error {
  constructor(public bytes: number) {
    super(`Page content is ${bytes} bytes`);
  }
}

export type PageState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; page: Page; pendingWrites: boolean };

export function usePage(id: string): PageState {
  const [state, setState] = useState<PageState>({ status: "loading" });
  useEffect(
    () =>
      onSnapshot(
        pageRef(getFirebase().db, id),
        { includeMetadataChanges: true },
        (snap) =>
          setState(
            snap.exists()
              ? {
                  status: "ready",
                  page: snap.data(),
                  pendingWrites: snap.metadata.hasPendingWrites,
                }
              : { status: "missing" },
          ),
      ),
    [id],
  );
  return state;
}

export async function loadContent(pageId: string) {
  const snap = await getDoc(contentRef(getFirebase().db, pageId));
  return snap.exists()
    ? { blocks: snap.data().blocks, updatedAt: snap.data().updatedAt }
    : { blocks: [], updatedAt: new Date(0) };
}

export async function saveContent(pageId: string, blocks: PartialBlock[]) {
  const json = JSON.stringify(blocks);
  const bytes = new TextEncoder().encode(json).length;
  if (bytes > MAX_BLOCKS_BYTES) throw new ContentTooLargeError(bytes);
  const { db } = getFirebase();
  const batch = writeBatch(db);
  batch.set(doc(db, PAGES, pageId, CONTENT, MAIN_CONTENT), {
    blocks: json,
    plainText: blocksToPlainText(blocks),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, PAGES, pageId), { updatedAt: serverTimestamp() });
  await batch.commit();
}

export type PagePatch = Partial<Pick<Page, "title" | "icon" | "coverUrl">>;

export async function updatePage(pageId: string, patch: PagePatch) {
  await updateDoc(doc(getFirebase().db, PAGES, pageId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}
