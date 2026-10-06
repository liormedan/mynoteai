import { describe, expect, it } from "vitest";
import { markdownToBlocks, parseInline } from "./from-markdown";
import { blocksToMarkdown } from "./to-markdown";

const t = (text: string, styles = {}) => ({ type: "text", text, styles });

describe("blocks to Markdown", () => {
  it("writes the common blocks, nesting and inline styles", () => {
    const md = blocksToMarkdown(
      [
        { type: "heading", props: { level: 2 }, content: [t("רשימת קניות")] },
        {
          type: "paragraph",
          content: [
            t("חלב "),
            t("3%", { bold: true }),
            t(" ו-"),
            t("לחם", { italic: true }),
          ],
        },
        {
          type: "bulletListItem",
          content: [t("פירות")],
          children: [{ type: "bulletListItem", content: [t("תפוחים")] }],
        },
        {
          type: "checkListItem",
          props: { checked: true },
          content: [t("לשלם חשבון")],
        },
        { type: "numberedListItem", content: [t("one")] },
        { type: "numberedListItem", content: [t("two")] },
        {
          type: "codeBlock",
          props: { language: "ts" },
          content: "const a = 1;",
        },
        {
          type: "paragraph",
          content: [
            t("ראו "),
            { type: "pageLink", props: { pageId: "abc", title: "ישן" } },
            t(" ו"),
            { type: "link", href: "https://x.dev", content: [t("אתר")] },
          ],
        },
        {
          type: "table",
          content: {
            type: "tableContent",
            rows: [
              { cells: [[t("שם")], [t("כמות")]] },
              { cells: [[t("a|b")], [t("2")]] },
            ],
          },
        },
      ],
      (id) => (id === "abc" ? "עמוד חדש" : undefined),
    );
    expect(md).toBe(
      [
        "## רשימת קניות",
        "",
        "חלב **3%** ו-_לחם_",
        "",
        "- פירות",
        "  - תפוחים",
        "- [x] לשלם חשבון",
        "1. one",
        "2. two",
        "",
        "```ts",
        "const a = 1;",
        "```",
        "",
        "ראו [עמוד חדש](/p/abc) ו[אתר](https://x.dev)",
        "",
        "| שם | כמות |",
        "| --- | --- |",
        String.raw`| a\|b | 2 |`,
        "",
      ].join("\n"),
    );
  });

  it("escapes Markdown characters in plain text", () => {
    expect(
      blocksToMarkdown([{ type: "paragraph", content: [t("snake_case *x*")] }]),
    ).toBe(String.raw`snake\_case \*x\*` + "\n");
  });
});

describe("Markdown to blocks", () => {
  it("reads inline styles, links and page links", () => {
    expect(parseInline("**מודגש** ו-_נטוי_, `code` ו[דף](/p/x1)")).toEqual([
      t("מודגש", { bold: true }),
      t(" ו-"),
      t("נטוי", { italic: true }),
      t(", "),
      t("code", { code: true }),
      t(" ו"),
      { type: "pageLink", props: { pageId: "x1", title: "דף" } },
    ]);
    expect(parseInline("snake_case and 2*3")).toEqual([
      t("snake_case and 2*3"),
    ]);
  });

  it("reads headings, nested and check lists, quotes, code and tables", () => {
    const blocks = markdownToBlocks(
      [
        "# כותרת",
        "",
        "שורה ראשונה",
        "ממשיכה כאן",
        "",
        "- [ ] לקנות",
        "- פירות",
        "  - תפוחים",
        "1. ראשון",
        "> ציטוט",
        "```js",
        "  x()",
        "```",
        "| a | b |",
        "|---|---|",
        "| 1 | 2 |",
        "---",
      ].join("\n"),
    );
    expect(blocks.map((b) => b.type)).toEqual([
      "heading",
      "paragraph",
      "checkListItem",
      "bulletListItem",
      "numberedListItem",
      "quote",
      "codeBlock",
      "table",
      "divider",
    ]);
    expect(blocks[1].content).toEqual([t("שורה ראשונה ממשיכה כאן")]);
    expect(blocks[2].props).toEqual({ checked: false });
    expect(blocks[3].children?.map((c) => c.content)).toEqual([[t("תפוחים")]]);
    expect(blocks[6].content).toBe("  x()");
    expect((blocks[7].content as { rows: unknown[] }).rows).toHaveLength(2);
  });

  it("round-trips its own output", () => {
    const md =
      "## כותרת\n\nטקסט **חזק** עם [קישור](/p/p1)\n\n- א\n  - ב\n- [x] ג\n";
    expect(blocksToMarkdown(markdownToBlocks(md))).toBe(md);
  });
});
