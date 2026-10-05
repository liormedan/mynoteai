"use client";

import { onSnapshot } from "firebase/firestore";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getFirebase } from "@/lib/firebase/client";
import { pagesCollection, type Page } from "./model";
import { buildTree, flatten, type TreeNode } from "./tree";

export type PagesStore = {
  loading: boolean;
  /** Every page document, archived ones included. */
  all: Page[];
  byId: Map<string, Page>;
  /** Live pages as a tree, and the same pages flat in tree order. */
  tree: TreeNode[];
  live: Page[];
  /** Archived pages (each one hides its branch). */
  trash: Page[];
  favorites: Page[];
  /** True while the data comes only from the local cache (offline). */
  fromCache: boolean;
};

const empty: PagesStore = {
  loading: true,
  all: [],
  byId: new Map(),
  tree: [],
  live: [],
  trash: [],
  favorites: [],
  fromCache: false,
};

const PagesContext = createContext<PagesStore>(empty);

/**
 * One listener on the metadata of every page; the sidebar, home, breadcrumbs
 * and the "@" menu all read from it. Page content is loaded separately.
 */
export function PagesProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<{
    pages: Page[];
    fromCache: boolean;
  } | null>(null);

  useEffect(() => {
    // Marks for measuring tree load time in the browser's performance panel.
    performance.mark("mynoteai:pages-subscribe");
    let first = true;
    return onSnapshot(
      pagesCollection(getFirebase().db),
      { includeMetadataChanges: true },
      (snap) => {
        if (first) {
          first = false;
          performance.mark("mynoteai:pages-first-snapshot");
        }
        setSnapshot({
          pages: snap.docs.map((d) => d.data()),
          fromCache: snap.metadata.fromCache,
        });
      },
    );
  }, []);

  const store = useMemo<PagesStore>(() => {
    if (!snapshot) return empty;
    const all = snapshot.pages;
    const tree = buildTree(all);
    const live = flatten(tree);
    return {
      loading: false,
      all,
      byId: new Map(all.map((p) => [p.id, p])),
      tree,
      live,
      trash: all
        .filter((p) => p.isArchived)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
      favorites: live.filter((p) => p.isFavorite),
      fromCache: snapshot.fromCache,
    };
  }, [snapshot]);

  return (
    <PagesContext.Provider value={store}>{children}</PagesContext.Provider>
  );
}

export const usePagesStore = () => useContext(PagesContext);
