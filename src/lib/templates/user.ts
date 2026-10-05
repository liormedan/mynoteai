"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { getFirebase } from "@/lib/firebase/client";
import { contentRef, type Page } from "@/lib/pages/model";

/** templates/{id}: a saved copy of a page's icon, title and blocks. */
export const TEMPLATES = "templates";

export type UserTemplate = {
  id: string;
  title: string;
  icon: string | null;
  blocks: unknown[];
  createdAt: Date;
};

export function useUserTemplates() {
  const [templates, setTemplates] = useState<UserTemplate[]>([]);
  useEffect(
    () =>
      onSnapshot(
        query(
          collection(getFirebase().db, TEMPLATES),
          orderBy("createdAt", "desc"),
        ),
        (snap) =>
          setTemplates(
            snap.docs.map((d) => {
              const data = d.data();
              let blocks: unknown[] = [];
              try {
                blocks = JSON.parse(data.blocks ?? "[]");
              } catch {
                // keep an empty template rather than failing the menu
              }
              return {
                id: d.id,
                title: data.title ?? "",
                icon: data.icon ?? null,
                blocks,
                createdAt:
                  data.createdAt instanceof Timestamp
                    ? data.createdAt.toDate()
                    : new Date(),
              };
            }),
          ),
      ),
    [],
  );
  return templates;
}

/** Saves the page's current title, icon and content as a template. */
export async function saveAsTemplate(page: Page) {
  const { db } = getFirebase();
  const content = await getDoc(contentRef(db, page.id));
  const ref = doc(collection(db, TEMPLATES));
  await setDoc(ref, {
    title: page.title.slice(0, 500),
    icon: page.icon,
    blocks: JSON.stringify(content.exists() ? content.data().blocks : []),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteTemplate(id: string) {
  await deleteDoc(doc(getFirebase().db, TEMPLATES, id));
}
