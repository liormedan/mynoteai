/*
 * Markdown to BlockNote blocks, for content an agent writes over MCP. It
 * covers what agents write in notes: headings, paragraphs, bullet,
 * numbered and check lists (nested by indentation), quotes, fenced code,
 * GFM tables, dividers, images, and inline bold / italic / strike / code /
 * links. A link to /p/<id> becomes a link to that page.
 */

export type Styles = { bold?: true; italic?: true; strike?: true; code?: true };
export type Inline =
  | { type: "text"; text: string; styles: Styles }
  | {
      type: "link";
      href: string;
      content: { type: "text"; text: string; styles: Styles }[];
    }
  | { type: "pageLink"; props: { pageId: string; title: string } };

export type Block = {
  type: string;
  props?: Record<string, unknown>;
  content?: Inline[] | string | Record<string, unknown>;
  children?: Block[];
};

const PAGE_LINK = /^\/p\/([A-Za-z0-9_-]+)$/;

/* ---------- inline ---------- */

type Marker = { open: string; close: string; style: keyof Styles };
const MARKERS: Marker[] = [
  { open: "**", close: "**", style: "bold" },
  { open: "__", close: "__", style: "bold" },
  { open: "~~", close: "~~", style: "strike" },
  { open: "*", close: "*", style: "italic" },
  { open: "_", close: "_", style: "italic" },
];

function pushText(out: Inline[], text: string, styles: Styles) {
  if (!text) return;
  const last = out.at(-1);
  if (
    last?.type === "text" &&
    JSON.stringify(last.styles) === JSON.stringify(styles)
  ) {
    last.text += text;
  } else {
    out.push({ type: "text", text, styles: { ...styles } });
  }
}

/** Index of the closing marker, skipping escaped characters. */
function findClose(s: string, from: number, close: string) {
  for (let i = from; i < s.length; i++) {
    if (s[i] === "\\") {
      i++;
      continue;
    }
    if (s.startsWith(close, i)) return i;
  }
  return -1;
}

export function parseInline(src: string, styles: Styles = {}): Inline[] {
  const out: Inline[] = [];
  let i = 0;
  let buf = "";
  const flush = () => {
    pushText(out, buf, styles);
    buf = "";
  };
  while (i < src.length) {
    const c = src[i];
    if (c === "\\" && i + 1 < src.length) {
      buf += src[i + 1];
      i += 2;
      continue;
    }
    if (c === "`") {
      const end = src.indexOf("`", i + 1);
      if (end > i) {
        flush();
        pushText(out, src.slice(i + 1, end), { ...styles, code: true });
        i = end + 1;
        continue;
      }
    }
    if (c === "[") {
      const close = findClose(src, i + 1, "]");
      if (close > i && src[close + 1] === "(") {
        const end = src.indexOf(")", close + 2);
        if (end > close) {
          flush();
          const text = src.slice(i + 1, close);
          const href = src.slice(close + 2, end).trim();
          const page = href.match(PAGE_LINK);
          const label = parseInline(text, styles).filter(
            (x): x is Extract<Inline, { type: "text" }> => x.type === "text",
          );
          if (page) {
            out.push({
              type: "pageLink",
              props: {
                pageId: page[1],
                title: label.map((x) => x.text).join(""),
              },
            });
          } else {
            out.push({ type: "link", href, content: label });
          }
          i = end + 1;
          continue;
        }
      }
    }
    const marker = MARKERS.find((m) => src.startsWith(m.open, i));
    // "_" inside a word (snake_case) is text, as in GFM.
    const intraword = marker?.open[0] === "_" && /\w/.test(src[i - 1] ?? "");
    if (marker && !intraword && !styles[marker.style]) {
      const end = findClose(src, i + marker.open.length, marker.close);
      if (end > i + marker.open.length) {
        flush();
        out.push(
          ...parseInline(src.slice(i + marker.open.length, end), {
            ...styles,
            [marker.style]: true,
          }),
        );
        i = end + marker.close.length;
        continue;
      }
    }
    buf += c;
    i++;
  }
  flush();
  return out;
}

/* ---------- blocks ---------- */

type Line = { indent: number; text: string };

const LIST_ITEM = /^([-*+]|\d+[.)])\s+(.*)$/;
const CHECK = /^\[([ xX])\]\s+(.*)$/;
const TABLE_SEP = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/;

const splitRow = (row: string) => {
  const trimmed = row.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let cur = "";
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === "\\" && trimmed[i + 1] === "|") {
      cur += "|";
      i++;
    } else if (trimmed[i] === "|") {
      cells.push(cur.trim());
      cur = "";
    } else cur += trimmed[i];
  }
  cells.push(cur.trim());
  return cells;
};

function listBlock(marker: string, text: string): Block {
  const check = marker.match(/^[-*+]$/) ? text.match(CHECK) : null;
  if (check) {
    return {
      type: "checkListItem",
      props: { checked: check[1] !== " " },
      content: parseInline(check[2]),
    };
  }
  return {
    type: /^\d/.test(marker) ? "numberedListItem" : "bulletListItem",
    content: parseInline(text),
  };
}

export function markdownToBlocks(markdown: string): Block[] {
  const lines: Line[] = markdown
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((raw) => {
      const expanded = raw.replace(/\t/g, "    ");
      const indent = expanded.match(/^ */)![0].length;
      return { indent, text: expanded.trim() };
    });

  const root: Block[] = [];
  // Open list items by indentation, so deeper items nest under them.
  let stack: { indent: number; block: Block }[] = [];
  const add = (block: Block, indent: number, isList: boolean) => {
    while (stack.length && stack.at(-1)!.indent >= indent) stack.pop();
    const parent = stack.at(-1);
    if (parent && (isList || indent > parent.indent)) {
      (parent.block.children ??= []).push(block);
    } else {
      stack = [];
      root.push(block);
    }
    if (isList) stack.push({ indent, block });
  };

  let i = 0;
  while (i < lines.length) {
    const { indent, text } = lines[i];

    if (!text) {
      i++;
      continue;
    }

    const fence = text.match(/^(`{3,}|~{3,})\s*([\w+-]*)/);
    if (fence) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].text.startsWith(fence[1])) {
        code.push(
          lines[i].indent > indent
            ? " ".repeat(lines[i].indent - indent) + lines[i].text
            : lines[i].text,
        );
        i++;
      }
      i++;
      add(
        {
          type: "codeBlock",
          props: { language: fence[2] || "text" },
          content: code.join("\n"),
        },
        indent,
        false,
      );
      continue;
    }

    const heading = text.match(/^(#{1,6})\s+(.*?)\s*#*$/);
    if (heading) {
      add(
        {
          type: "heading",
          props: { level: heading[1].length },
          content: parseInline(heading[2]),
        },
        indent,
        false,
      );
      i++;
      continue;
    }

    if (/^([-*_])(\s*\1){2,}$/.test(text)) {
      add({ type: "divider" }, indent, false);
      i++;
      continue;
    }

    if (
      text.startsWith("|") &&
      lines[i + 1] &&
      TABLE_SEP.test(lines[i + 1].text)
    ) {
      const rows = [splitRow(text)];
      i += 2;
      while (i < lines.length && lines[i].text.startsWith("|"))
        rows.push(splitRow(lines[i++].text));
      const width = Math.max(...rows.map((r) => r.length));
      add(
        {
          type: "table",
          content: {
            type: "tableContent",
            headerRows: 1,
            columnWidths: Array.from({ length: width }, () => undefined),
            rows: rows.map((r) => ({
              cells: Array.from({ length: width }, (_, k) =>
                parseInline(r[k] ?? ""),
              ),
            })),
          },
        },
        indent,
        false,
      );
      continue;
    }

    const image = text.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (image) {
      add(
        { type: "image", props: { url: image[2], caption: image[1] } },
        indent,
        false,
      );
      i++;
      continue;
    }

    if (text.startsWith(">")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].text.startsWith(">")) {
        quote.push(lines[i].text.replace(/^>\s?/, ""));
        i++;
      }
      add(
        { type: "quote", content: parseInline(quote.join("\n")) },
        indent,
        false,
      );
      continue;
    }

    const item = text.match(LIST_ITEM);
    if (item) {
      add(listBlock(item[1], item[2]), indent, true);
      i++;
      continue;
    }

    // A paragraph runs until a blank line or another kind of block.
    const para = [text];
    i++;
    while (
      i < lines.length &&
      lines[i].text &&
      !/^(#{1,6}\s|>|```|~~~|\||!\[)/.test(lines[i].text) &&
      !LIST_ITEM.test(lines[i].text)
    ) {
      para.push(lines[i].text);
      i++;
    }
    add(
      { type: "paragraph", content: parseInline(para.join(" ")) },
      indent,
      false,
    );
  }
  return root;
}
