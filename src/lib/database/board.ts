import { positionBetween } from "@/lib/pages/tree";
import type { Row } from "./values";

/**
 * The position a dragged card takes in a board column: before or after the
 * card it was dropped on, or at the end of the column. Positions are shared
 * with the table (rows of one database), so the neighbours come from the
 * column as shown.
 */
export function dropPosition(
  column: Row[],
  movingId: string,
  target: { id: string; after: boolean } | null,
): number {
  const others = column.filter((r) => r.id !== movingId);
  if (!target) {
    const last = others.at(-1);
    return positionBetween(last?.position, undefined);
  }
  const i = others.findIndex((r) => r.id === target.id);
  if (i < 0) return positionBetween(others.at(-1)?.position, undefined);
  const before = target.after ? others[i] : others[i - 1];
  const after = target.after ? others[i + 1] : others[i];
  return positionBetween(before?.position, after?.position);
}
