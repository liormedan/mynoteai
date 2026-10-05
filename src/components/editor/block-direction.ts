import { createExtension, type ExtensionOptions } from "@blocknote/core";
import type { Node as PMNode } from "prosemirror-model";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { detectDirection } from "./direction";

const key = new PluginKey<DecorationSet>("blockDirection");

// Code is always written left-to-right, whatever the comments inside say.
const ALWAYS_LTR = new Set(["codeBlock"]);

function build(doc: PMNode, fallback: "ltr" | "rtl") {
  const blocks: { from: number; to: number; dir: "ltr" | "rtl" | null }[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    blocks.push({
      from: pos,
      to: pos + node.nodeSize,
      dir: ALWAYS_LTR.has(node.type.name)
        ? "ltr"
        : detectDirection(node.textContent),
    });
    return false;
  });
  // A block without letters continues the direction of the text around it
  // (the previous block, else the next one), like a new line in a word
  // processor; only a page with no letters at all uses the UI direction.
  const first = blocks.find((b) => b.dir)?.dir ?? fallback;
  let current = first;
  const decorations = blocks.map((b) => {
    if (b.dir) current = b.dir;
    return Decoration.node(b.from, b.to, { dir: b.dir ?? current });
  });
  return DecorationSet.create(doc, decorations);
}

/**
 * Gives every text block a `dir` from its first letter, so Hebrew and English
 * can share a page. Blocks without letters (empty, "/", numbers) follow the
 * surrounding text, or the UI direction on a page with no letters at all —
 * `dir="auto"` would make them LTR, putting the caret and the slash menu on
 * the wrong side of a Hebrew page.
 */
export const blockDirection = createExtension(
  ({ options }: ExtensionOptions<{ fallback: "ltr" | "rtl" }>) => ({
    key: "blockDirection",
    prosemirrorPlugins: [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: (_, state) => build(state.doc, options.fallback),
          apply: (tr, old) =>
            tr.docChanged ? build(tr.doc, options.fallback) : old,
        },
        props: {
          decorations: (state) => key.getState(state),
        },
      }),
    ],
  }),
);
