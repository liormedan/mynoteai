"use client";

import { getDoc } from "firebase/firestore";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { getFirebase } from "@/lib/firebase/client";
import { onContentSaved } from "@/lib/pages/content-events";
import { contentRef, type Page } from "@/lib/pages/model";
import { usePagesStore } from "@/lib/pages/store";
import { snippet } from "./hebrew";
import { SearchIndexer } from "./indexer";

export type SearchResult = {
  page: Page;
  snippet: ReturnType<typeof snippet>;
};

type SearchContextValue = {
  search: (query: string, limit?: number) => SearchResult[];
  /** Pages whose text is still being read; their titles already match. */
  pending: number;
};

const SearchContext = createContext<SearchContextValue>({
  search: () => [],
  pending: 0,
});

async function fetchText(pageId: string) {
  const snap = await getDoc(contentRef(getFirebase().db, pageId));
  return snap.exists() ? snap.data().plainText : "";
}

const noop = () => () => {};

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const { all, live, byId, loading } = usePagesStore();
  const [indexer] = useState(() =>
    typeof window === "undefined" ? null : new SearchIndexer(fetchText),
  );

  useEffect(() => {
    if (!indexer) return;
    performance.mark("mynoteai:search-start");
    void indexer.start().then(() => performance.mark("mynoteai:search-ready"));
    const off = onContentSaved((id, text) => indexer.contentSaved(id, text));
    return () => {
      off();
      indexer.stop();
    };
  }, [indexer]);

  useEffect(() => {
    if (indexer && !loading) indexer.setPages(all);
  }, [indexer, all, loading]);

  const version = useSyncExternalStore(
    indexer?.subscribe ?? noop,
    () => indexer?.getVersion() ?? 0,
    () => 0,
  );

  const liveIds = useMemo(() => new Set(live.map((p) => p.id)), [live]);
  const hidden = all.length - live.length;

  const search = useCallback(
    (query: string, limit = 20): SearchResult[] => {
      if (!indexer) return [];
      // Archived pages (and pages inside them) stay indexed but hidden.
      return indexer.engine
        .search(query, limit + hidden)
        .filter((hit) => liveIds.has(hit.id))
        .slice(0, limit)
        .map((hit) => ({
          page: byId.get(hit.id)!,
          snippet: snippet(indexer.text(hit.id), hit.terms),
        }));
    },
    // `version` changes when the index does, so results refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [indexer, liveIds, hidden, byId, version],
  );

  const value = useMemo(
    () => ({ search, pending: indexer?.pending ?? 0 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [search, indexer, version],
  );

  return (
    <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
  );
}

export const useSearch = () => useContext(SearchContext);
