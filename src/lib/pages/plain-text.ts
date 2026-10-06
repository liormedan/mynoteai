/** Plain text of a BlockNote document, for search. Pure: also used on the server. */
export function blocksToPlainText(blocks: unknown[]): string {
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
