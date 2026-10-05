import { describe, expect, it } from "vitest";
import type { Page } from "@/lib/pages/model";
import { SearchIndexer } from "./indexer";

const page = (id: string, title: string, contentAt: number): Page => ({
  id,
  title,
  icon: null,
  coverUrl: null,
  parentId: null,
  position: 0,
  type: "page",
  isArchived: false,
  isFavorite: false,
  createdAt: new Date(0),
  updatedAt: new Date(contentAt),
  contentUpdatedAt: new Date(contentAt),
});

const settle = () => new Promise((r) => setTimeout(r, 0));

function setup(texts: Record<string, string>) {
  const reads: string[] = [];
  const indexer = new SearchIndexer(async (id) => {
    reads.push(id);
    return texts[id] ?? "";
  });
  const ids = (q: string) => indexer.engine.search(q).map((h) => h.id);
  return { indexer, reads, ids };
}

describe("SearchIndexer", () => {
  it("reads text once per content change, and titles need no read", async () => {
    const { indexer, reads, ids } = setup({ a: "גינה ירוקה", b: "ים" });
    await indexer.start();
    indexer.setPages([page("a", "בית", 1), page("b", "חופשה", 1)]);
    expect(ids("הבית")).toEqual(["a"]);
    await settle();
    expect(reads.sort()).toEqual(["a", "b"]);
    expect(ids("בגינה")).toEqual(["a"]);

    indexer.setPages([page("a", "בית חדש", 1), page("b", "חופשה", 1)]);
    await settle();
    expect(reads).toHaveLength(2);
    expect(ids("חדש")).toEqual(["a"]);

    indexer.setPages([page("a", "בית חדש", 2), page("b", "חופשה", 1)]);
    await settle();
    expect(reads).toHaveLength(3);
  });

  it("takes a save from this device without reading it back", async () => {
    const { indexer, reads, ids } = setup({ a: "old" });
    await indexer.start();
    indexer.setPages([page("a", "Notes", 1)]);
    await settle();
    indexer.contentSaved("a", "fresh words");
    expect(ids("fresh")).toEqual(["a"]);
    // The pending server timestamp, then the confirmed one.
    indexer.setPages([page("a", "Notes", 0)]);
    indexer.setPages([page("a", "Notes", 5)]);
    await settle();
    expect(reads).toEqual(["a"]);
    expect(ids("old")).toEqual([]);
  });

  it("drops pages that were deleted", async () => {
    const { indexer, ids } = setup({ a: "x", b: "y" });
    await indexer.start();
    indexer.setPages([page("a", "alpha", 1), page("b", "beta", 1)]);
    indexer.setPages([page("b", "beta", 1)]);
    await settle();
    expect(ids("alpha")).toEqual([]);
    expect(ids("beta")).toEqual(["b"]);
  });

  it("keeps working after stop() and start(), as in React StrictMode", async () => {
    const { indexer, ids } = setup({ a: "שלום" });
    void indexer.start();
    indexer.stop();
    await indexer.start();
    indexer.setPages([page("a", "x", 1)]);
    await settle();
    expect(ids("שלום")).toEqual(["a"]);
  });
});
