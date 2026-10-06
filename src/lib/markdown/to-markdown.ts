/*
 * BlockNote blocks (as stored in Firestore) to Markdown, for agents over
 * MCP and for export. Plain functions on the JSON, so they run on the
 * server without an editor. Links to other pages come out as [title](/p/id),
 * which fromMarkdown() turns back into page links.
 */

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown) => (typeof v === "string" ? v : "");

export type PageTitles = (pageId: string) => string | undefined;

/** Characters that would otherwise start Markdown formatting. */
const escape = (text: string) => text.replace(/([\\`*_[\]])/g, "\\$1");

function wrap(text: string, styles: Json) {
  if (!text) return "";
  // Markers must hug the text: move outer spaces outside them.
  const lead = text.match(/^\s*/)![0];
  const trail = text.match(/\s*$/)![0];
  let core = text.slice(lead.length, text.length - trail.length);
  if (!core) return text;
  if (styles.code) return `${lead}\`${core}\`${trail}`;
  core = escape(core);
  if (styles.bold) core = `**${core}**`;
  if (styles.italic) core = `_${core}_`;
  if (styles.strike) core = `~~${core}~~`;
  return lead + core + trail;
}

export function inlineToMarkdown(
  content: unknown,
  titles?: PageTitles,
): string {
  if (typeof content === "string") return escape(content);
  return arr(content)
    .map((item) => {
      if (typeof item === "string") return escape(item);
      if (!isObj(item)) return "";
      if (item.type === "text")
        return wrap(str(item.text), isObj(item.styles) ? item.styles : {});
      if (item.type === "link") {
        return `[${inlineToMarkdown(item.content, titles)}](${str(item.href)})`;
      }
      if (item.type === "pageLink" && isObj(item.props)) {
        const id = str(item.props.pageId);
        const title = titles?.(id) || str(item.props.title) || id;
        return `[${escape(title)}](/p/${id})`;
      }
      return "";
    })
    .join("");
}

const cellText = (cell: unknown, titles?: PageTitles) =>
  inlineToMarkdown(
    isObj(cell) && cell.type === "tableCell" ? cell.content : cell,
    titles,
  )
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ");

function tableToMarkdown(content: unknown, titles?: PageTitles): string[] {
  if (!isObj(content)) return [];
  const rows = arr(content.rows).map((r) =>
    isObj(r) ? arr(r.cells).map((c) => cellText(c, titles)) : [],
  );
  if (!rows.length) return [];
  const width = Math.max(...rows.map((r) => r.length), 1);
  const line = (cells: string[]) =>
    `| ${Array.from({ length: width }, (_, i) => cells[i] ?? "").join(" | ")} |`;
  // GFM needs a header row: the table's first row is it.
  return [
    line(rows[0]),
    `|${" --- |".repeat(width)}`,
    ...rows.slice(1).map(line),
  ];
}

const LIST = new Set([
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "toggleListItem",
]);

function blockLines(
  block: Json,
  number: number,
  titles?: PageTitles,
): string[] {
  const props = isObj(block.props) ? block.props : {};
  const text = () => inlineToMarkdown(block.content, titles);
  switch (block.type) {
    case "heading": {
      const level = Math.min(6, Math.max(1, Number(props.level) || 1));
      return [`${"#".repeat(level)} ${text()}`];
    }
    case "bulletListItem":
    case "toggleListItem":
      return [`- ${text()}`];
    case "numberedListItem":
      return [`${number}. ${text()}`];
    case "checkListItem":
      return [`- [${props.checked ? "x" : " "}] ${text()}`];
    case "quote":
      return text()
        .split("\n")
        .map((l) => `> ${l}`);
    case "codeBlock": {
      const code =
        typeof block.content === "string"
          ? block.content
          : arr(block.content)
              .map((c) => (isObj(c) ? str(c.text) : str(c)))
              .join("");
      const lang = str(props.language);
      return [
        "```" + (lang && lang !== "text" ? lang : ""),
        ...code.split("\n"),
        "```",
      ];
    }
    case "table":
      return tableToMarkdown(block.content, titles);
    case "image":
      return props.url
        ? [
            `![${escape(str(props.caption) || str(props.name))}](${str(props.url)})`,
          ]
        : [];
    case "file":
    case "video":
    case "audio":
      return props.url
        ? [`[${escape(str(props.name) || str(props.url))}](${str(props.url)})`]
        : [];
    case "divider":
    case "pageBreak":
      return ["---"];
    default:
      return [text()];
  }
}

/** The whole document as Markdown; nested blocks are indented two spaces. */
export function blocksToMarkdown(blocks: unknown, titles?: PageTitles): string {
  const out: string[] = [];
  const walk = (list: unknown[], depth: number, underList: boolean) => {
    let number = 0;
    // A list item's nested list follows it without a blank line.
    let prevList = underList;
    list.forEach((b) => {
      if (!isObj(b)) return;
      const isList = LIST.has(str(b.type));
      number = b.type === "numberedListItem" ? number + 1 : 0;
      // A blank line between blocks, except inside a run of list items.
      if (out.length && !(isList && prevList)) out.push("");
      const indent = "  ".repeat(depth);
      for (const line of blockLines(b, number, titles))
        out.push(line ? indent + line : "");
      prevList = isList;
      const children = arr(b.children);
      if (children.length) walk(children, depth + 1, isList);
    });
  };
  walk(arr(blocks), 0, false);
  // Empty paragraphs become blank lines; collapse runs of them.
  return (
    out
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim() + "\n"
  );
}
