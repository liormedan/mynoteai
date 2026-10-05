import type { Page } from "./model";

/*
 * Pure helpers over the flat list of page metadata. The whole tree is built in
 * memory from one Firestore listener, so these run on every snapshot and must
 * stay linear.
 *
 * Archiving marks only the page itself; its descendants stay as they are but
 * are hidden because an ancestor is archived. Restoring the page brings the
 * whole branch back unchanged.
 */

export type TreeNode = { page: Page; children: TreeNode[] };

type Meta = Pick<Page, "id" | "parentId" | "position" | "isArchived"> &
  Partial<Pick<Page, "createdAt">>;

const byPosition = (a: Meta, b: Meta) =>
  a.position - b.position ||
  (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0) ||
  a.id.localeCompare(b.id);

export function childrenIndex<T extends Meta>(pages: T[]) {
  const ids = new Set(pages.map((p) => p.id));
  const index = new Map<string | null, T[]>();
  for (const p of pages) {
    // A page whose parent is gone (deleted elsewhere) shows at the top level.
    const parent = p.parentId && ids.has(p.parentId) ? p.parentId : null;
    const list = index.get(parent);
    if (list) list.push(p);
    else index.set(parent, [p]);
  }
  for (const list of index.values()) list.sort(byPosition);
  return index;
}

/** Live (not archived, no archived ancestor) pages as a tree. */
export function buildTree(pages: Page[]): TreeNode[] {
  const index = childrenIndex(pages);
  const seen = new Set<string>();
  const build = (parent: string | null): TreeNode[] =>
    (index.get(parent) ?? [])
      .filter((p) => !p.isArchived && !seen.has(p.id))
      .map((page) => {
        seen.add(page.id); // guards against parent cycles in bad data
        return { page, children: build(page.id) };
      });
  return build(null);
}

/** Every page reachable in the live tree, in tree order. */
export function flatten(tree: TreeNode[]): Page[] {
  const out: Page[] = [];
  const walk = (nodes: TreeNode[]) =>
    nodes.forEach((n) => {
      out.push(n.page);
      walk(n.children);
    });
  walk(tree);
  return out;
}

export function descendantIds<T extends Meta>(pages: T[], id: string) {
  const index = childrenIndex(pages);
  const out: string[] = [];
  const stack = [id];
  const seen = new Set(stack);
  while (stack.length) {
    for (const child of index.get(stack.pop()!) ?? []) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      out.push(child.id);
      stack.push(child.id);
    }
  }
  return out;
}

/** Ancestors from the top level down to the parent of `id`. */
export function ancestors<T extends Meta>(byId: Map<string, T>, id: string) {
  const out: T[] = [];
  const seen = new Set([id]);
  let parent = byId.get(id)?.parentId ?? null;
  while (parent && byId.has(parent) && !seen.has(parent)) {
    seen.add(parent);
    out.unshift(byId.get(parent)!);
    parent = byId.get(parent)!.parentId;
  }
  return out;
}

/** A page cannot be moved under itself or under one of its descendants. */
export function canMoveUnder<T extends Meta>(
  pages: T[],
  id: string,
  newParentId: string | null,
) {
  if (newParentId === null) return true;
  if (newParentId === id) return false;
  return !descendantIds(pages, id).includes(newParentId);
}

/** A position between two neighbours (either may be missing). */
export function positionBetween(before?: number, after?: number) {
  if (before === undefined && after === undefined) return 1;
  if (before === undefined) return after! - 1;
  if (after === undefined) return before + 1;
  return (before + after) / 2;
}

export type DropZone = "before" | "inside" | "after";

/**
 * Where a page lands when dropped relative to `target`: as its previous or
 * next sibling, or as its last child.
 */
export function dropPlacement<T extends Meta>(
  pages: T[],
  target: T,
  zone: DropZone,
  movingId: string,
): { parentId: string | null; position: number } {
  const index = childrenIndex(pages.filter((p) => p.id !== movingId));
  if (zone === "inside") {
    const kids = index.get(target.id) ?? [];
    return {
      parentId: target.id,
      position: positionBetween(kids.at(-1)?.position, undefined),
    };
  }
  const parentId = target.parentId;
  const siblings = index.get(parentId) ?? [];
  const i = siblings.findIndex((s) => s.id === target.id);
  const [before, after] =
    zone === "before"
      ? [siblings[i - 1]?.position, target.position]
      : [target.position, siblings[i + 1]?.position];
  return { parentId, position: positionBetween(before, after) };
}
