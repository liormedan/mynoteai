import { createExtension, type ExtensionOptions } from "@blocknote/core";
import type { Node as PMNode } from "prosemirror-model";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { detectDirection } from "./direction";

const key = new PluginKey<DecorationSet>("blockDirection");

// Code is always written left-to-right, whatever the comments inside say.
const ALWAYS_LTR = new Set(["codeBlock"]);

function build(doc: PMNode, fallback: "ltr" | "rtl") {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    const dir = ALWAYS_LTR.has(node.type.name)
      ? "ltr"
      : (detectDirection(node.textContent) ?? fallback);
    decorations.push(Decoration.node(pos, pos + node.nodeSize, { dir }));
    return false;
  });
  return DecorationSet.create(doc, decorations);
}

/**
 * Gives every text block a `dir` from its first letter, so Hebrew and English
 * can share a page. Blocks without letters (empty, "/", numbers) take the UI
 * direction — `dir="auto"` would make them LTR, which puts the caret and the
 * slash menu on the wrong side in a Hebrew UI.
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
