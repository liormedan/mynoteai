import { describe, expect, it } from "vitest";
import type { Page } from "./model";
import {
  ancestors,
  buildTree,
  canMoveUnder,
  descendantIds,
  dropPlacement,
  flatten,
  positionBetween,
} from "./tree";

const page = (
  id: string,
  parentId: string | null,
  position: number,
  extra: Partial<Page> = {},
): Page => ({
  id,
  title: id,
  icon: null,
  coverUrl: null,
  parentId,
  position,
  type: "page",
  isArchived: false,
  isFavorite: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  contentUpdatedAt: null,
  ...extra,
});

//  a         d
//  ├ b
//  │ └ c
//  └ e (archived)
//    └ f
const pages = [
  page("d", null, 2),
  page("a", null, 1),
  page("c", "b", 1),
  page("b", "a", 1),
  page("e", "a", 2, { isArchived: true }),
  page("f", "e", 1),
];
const ids = (list: { id: string }[]) => list.map((p) => p.id);

describe("buildTree", () => {
  it("nests by parentId and orders by position", () => {
    const tree = buildTree(pages);
    expect(ids(tree.map((n) => n.page))).toEqual(["a", "d"]);
    expect(ids(flatten(tree))).toEqual(["a", "b", "c", "d"]);
  });

  it("hides archived pages together with their descendants", () => {
    expect(ids(flatten(buildTree(pages)))).not.toContain("e");
    expect(ids(flatten(buildTree(pages)))).not.toContain("f");
  });

  it("shows orphans at the top level and survives parent cycles", () => {
    const tree = buildTree([
      page("x", "missing", 1),
      page("p", "q", 1),
      page("q", "p", 1),
    ]);
    expect(ids(tree.map((n) => n.page))).toEqual(["x"]);
  });

  it("builds a 500-page tree quickly", () => {
    const many: Page[] = [];
    for (let i = 0; i < 500; i++) {
      many.push(page(`p${i}`, i < 20 ? null : `p${i % 20}`, i));
    }
    const start = performance.now();
    const flat = flatten(buildTree(many));
    expect(flat).toHaveLength(500);
    expect(performance.now() - start).toBeLessThan(50);
  });
});

describe("tree queries", () => {
  it("finds descendants and ancestors", () => {
    expect(descendantIds(pages, "a").sort()).toEqual(["b", "c", "e", "f"]);
    const byId = new Map(pages.map((p) => [p.id, p]));
    expect(ids(ancestors(byId, "c"))).toEqual(["a", "b"]);
    expect(ancestors(byId, "a")).toEqual([]);
  });

  it("forbids moving a page under itself or its descendants", () => {
    expect(canMoveUnder(pages, "a", "a")).toBe(false);
    expect(canMoveUnder(pages, "a", "c")).toBe(false);
    expect(canMoveUnder(pages, "c", "a")).toBe(true);
    expect(canMoveUnder(pages, "c", null)).toBe(true);
  });
});

describe("placement", () => {
  it("computes positions between neighbours", () => {
    expect(positionBetween()).toBe(1);
    expect(positionBetween(undefined, 4)).toBe(3);
    expect(positionBetween(4)).toBe(5);
    expect(positionBetween(1, 2)).toBe(1.5);
  });

  it("places before, after and inside a target", () => {
    const d = pages.find((p) => p.id === "d")!;
    const a = pages.find((p) => p.id === "a")!;
    expect(dropPlacement(pages, d, "before", "c")).toEqual({
      parentId: null,
      position: 1.5,
    });
    expect(dropPlacement(pages, d, "after", "c")).toEqual({
      parentId: null,
      position: 3,
    });
    // inside "a": after its last child (e, position 2)
    expect(dropPlacement(pages, a, "inside", "c")).toEqual({
      parentId: "a",
      position: 3,
    });
  });

  it("moving a branch keeps its children", () => {
    const d = pages.find((p) => p.id === "d")!;
    const { parentId, position } = dropPlacement(pages, d, "inside", "b");
    const moved = pages.map((p) =>
      p.id === "b" ? { ...p, parentId, position } : p,
    );
    const tree = buildTree(moved);
    const dNode = tree.find((n) => n.page.id === "d")!;
    expect(ids(flatten(dNode.children))).toEqual(["b", "c"]);
  });
});
