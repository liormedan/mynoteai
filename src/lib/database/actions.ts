"use client";

import {
  deleteField,
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { getFirebase } from "@/lib/firebase/client";
import { createPageUnder } from "@/lib/pages/actions";
import { PAGES, type Page } from "@/lib/pages/model";
import { defaultDatabase, type DefaultLabels } from "./schema";
import type { Database, Props, PropValue } from "./types";

const pageRef = (id: string) => doc(getFirebase().db, PAGES, id);

export function createDatabase(
  pages: Page[],
  parentId: string | null,
  labels: DefaultLabels & { title: string },
) {
  return createPageUnder(pages, parentId, {
    title: labels.title,
    type: "database",
    database: defaultDatabase(labels),
  });
}

/** A new row: a page under the database, with optional starting values. */
export function addRow(
  pages: Page[],
  databaseId: string,
  init: { title?: string; props?: Props; position?: number } = {},
) {
  return createPageUnder(pages, databaseId, init);
}

export async function saveDatabase(databaseId: string, database: Database) {
  await updateDoc(pageRef(databaseId), {
    database,
    updatedAt: serverTimestamp(),
  });
}

export async function setRowValue(
  rowId: string,
  propId: string,
  value: PropValue,
) {
  await updateDoc(pageRef(rowId), {
    [`props.${propId}`]: value,
    updatedAt: serverTimestamp(),
  });
}

/** Board drag: new place in the column, and the column's value. */
export async function moveRow(
  rowId: string,
  position: number,
  values: Record<string, PropValue> = {},
) {
  const update: Record<string, unknown> = {
    position,
    updatedAt: serverTimestamp(),
  };
  for (const [k, v] of Object.entries(values)) update[`props.${k}`] = v;
  await updateDoc(pageRef(rowId), update);
}

/** Drops a deleted property's values from every row, in one batch per 500. */
export async function clearPropertyValues(rows: Page[], propId: string) {
  const { db } = getFirebase();
  const holders = rows.filter((r) => propId in r.props);
  for (let i = 0; i < holders.length; i += 500) {
    const batch = writeBatch(db);
    for (const r of holders.slice(i, i + 500)) {
      batch.update(doc(db, PAGES, r.id), {
        [`props.${propId}`]: deleteField(),
      });
    }
    await batch.commit();
  }
}
