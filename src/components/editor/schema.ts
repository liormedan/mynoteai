import { BlockNoteSchema, defaultInlineContentSpecs } from "@blocknote/core";
import type { PartialBlock as BNPartialBlock } from "@blocknote/core";
import { PageLink } from "./page-link";

export const schema = BlockNoteSchema.create({
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    pageLink: PageLink,
  },
});

export type NoteEditor = typeof schema.BlockNoteEditor;
export type NoteBlock = typeof schema.Block;
export type NotePartialBlock = BNPartialBlock<
  typeof schema.blockSchema,
  typeof schema.inlineContentSchema,
  typeof schema.styleSchema
>;
