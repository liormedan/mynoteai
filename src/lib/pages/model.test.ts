import { describe, expect, it } from "vitest";
import { blocksToPlainText } from "./model";

describe("blocksToPlainText", () => {
  it("collects text from strings, styled text, children and tables", () => {
    const text = blocksToPlainText([
      { type: "heading", content: "כותרת" },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "שלום ", styles: {} },
          { type: "text", text: "world", styles: { bold: true } },
        ],
        children: [{ type: "bulletListItem", content: "פריט" }],
      },
      {
        type: "table",
        content: {
          type: "tableContent",
          rows: [{ cells: ["תא", "cell"] }],
        },
      },
    ]);
    expect(text).toBe("כותרת שלום world פריט תא cell");
  });

  it("returns an empty string for an empty document", () => {
    expect(blocksToPlainText([])).toBe("");
    expect(blocksToPlainText([{ type: "paragraph" }])).toBe("");
  });
});
