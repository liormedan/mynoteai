import type { PartialBlock } from "@blocknote/core";
import {
  collection,
  doc,
  serverTimestamp,
  Timestamp,
  writeBatch,
  type DocumentData,
  type Firestore,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

/*
 * Firestore layout — one owner per install, so no per-user nesting:
 *
 *   pages/{pageId}               page metadata (small, loaded for the whole tree)
 *   pages/{pageId}/content/main  the BlockNote document, loaded only when the page opens
 *
 * Blocks are stored as a JSON string: BlockNote tables nest arrays inside
 * arrays, which Firestore cannot store directly.
 */

export type PageType = "page" | "database";

export type Page = {
  id: string;
  title: string;
  icon: string | null;
  coverUrl: string | null;
  parentId: string | null;
  position: number;
  type: PageType;
  isArchived: boolean;
  isFavorite: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type PageContent = {
  blocks: PartialBlock[];
  plainText: string;
  updatedAt: Date;
};

export const PAGES = "pages";
export const CONTENT = "content";
export const MAIN_CONTENT = "main";

const toDate = (value: unknown) =>
  value instanceof Timestamp ? value.toDate() : new Date(0);

export const pageConverter: FirestoreDataConverter<Page> = {
  toFirestore: (page) => {
    // `id` lives in the document path, not in the data.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...data } = page as Page;
    return data;
  },
  fromFirestore: (snap: QueryDocumentSnapshot<DocumentData>) => {
    const d = snap.data();
    return {
      id: snap.id,
      title: d.title ?? "",
      icon: d.icon ?? null,
      coverUrl: d.coverUrl ?? null,
      parentId: d.parentId ?? null,
      position: d.position ?? 0,
      type: d.type === "database" ? "database" : "page",
      isArchived: d.isArchived === true,
      isFavorite: d.isFavorite === true,
      createdAt: toDate(d.createdAt),
      updatedAt: toDate(d.updatedAt),
    };
  },
};

export const contentConverter: FirestoreDataConverter<PageContent> = {
  toFirestore: (content) => ({
    blocks: JSON.stringify((content as PageContent).blocks ?? []),
    plainText: (content as PageContent).plainText ?? "",
    updatedAt: serverTimestamp(),
  }),
  fromFirestore: (snap: QueryDocumentSnapshot<DocumentData>) => {
    const d = snap.data();
    let blocks: PartialBlock[] = [];
    try {
      blocks = JSON.parse(d.blocks ?? "[]");
    } catch {
      // A corrupt document opens empty rather than crashing the editor.
    }
    return {
      blocks,
      plainText: d.plainText ?? "",
      updatedAt: toDate(d.updatedAt),
    };
  },
};

export const pagesCollection = (db: Firestore) =>
  collection(db, PAGES).withConverter(pageConverter);

export const pageRef = (db: Firestore, id: string) =>
  doc(db, PAGES, id).withConverter(pageConverter);

export const contentRef = (db: Firestore, pageId: string) =>
  doc(db, PAGES, pageId, CONTENT, MAIN_CONTENT).withConverter(contentConverter);

/** Plain text of a BlockNote document, for search and for the AI index. */
export function blocksToPlainText(blocks: PartialBlock[]): string {
  const out: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === "string") out.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") {
      const v = value as Record<string, unknown>;
      if (typeof v.text === "string") out.push(v.text);
      walk(v.content);
      walk(v.cells);
      walk(v.rows);
      walk(v.children);
    }
  };
  blocks.forEach(walk);
  return out.join(" ").replace(/\s+/g, " ").trim();
}

export type NewPage = {
  title?: string;
  icon?: string | null;
  parentId?: string | null;
  position?: number;
  type?: PageType;
  blocks?: PartialBlock[];
};

/** Creates a page and its content document in one batch. Returns the new id. */
export async function createPage(db: Firestore, input: NewPage = {}) {
  const ref = doc(collection(db, PAGES));
  const blocks = input.blocks ?? [];
  const batch = writeBatch(db);
  batch.set(ref, {
    title: input.title ?? "",
    icon: input.icon ?? null,
    coverUrl: null,
    parentId: input.parentId ?? null,
    position: input.position ?? Date.now(),
    type: input.type ?? "page",
    isArchived: false,
    isFavorite: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, PAGES, ref.id, CONTENT, MAIN_CONTENT), {
    blocks: JSON.stringify(blocks),
    plainText: blocksToPlainText(blocks),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  return ref.id;
}
