"use client";

import { filterSuggestionItems } from "@blocknote/core/extensions";
import { en, he } from "@blocknote/core/locales";
import "@blocknote/core/fonts/inter.css";
import {
  SideMenuController,
  SuggestionMenuController,
  useCreateBlockNote,
  type DefaultReactSuggestionItem,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/shadcn/style.css";
import { useTheme } from "next-themes";
import { useMemo } from "react";
import { localeDirection, type Locale } from "@/i18n/config";
import { blockDirection } from "./block-direction";
import "./editor.css";
import { PagesContext, type PageSummary } from "./page-link";
import { schema, type NoteBlock, type NotePartialBlock } from "./schema";

const dictionaries = { en, he } satisfies Record<Locale, unknown>;

export type EditorProps = {
  locale: Locale;
  initialContent?: NotePartialBlock[];
  /** Called with the whole document on every change. */
  onChange?: (blocks: NoteBlock[]) => void;
  /** Uploads a file and returns its URL; omit to offer image links only. */
  uploadFile?: (file: File) => Promise<string>;
  /** Pages offered by the "@" menu, and used to show live link titles. */
  pages?: PageSummary[];
  /** Hidden from the "@" menu (the page being edited). */
  currentPageId?: string;
  untitled?: string;
};

export default function Editor({
  locale,
  initialContent,
  onChange,
  uploadFile,
  pages = [],
  currentPageId,
  untitled = "Untitled",
}: EditorProps) {
  const rtl = localeDirection[locale] === "rtl";
  const { resolvedTheme } = useTheme();
  // BlockNote always docks the drag handle on the left; in RTL it belongs on the right.
  const sideMenuPlacement = rtl ? "right-start" : "left-start"; // rtl-ok: floating-ui placement

  const editor = useCreateBlockNote(
    {
      schema,
      dictionary: dictionaries[locale],
      initialContent:
        initialContent && initialContent.length ? initialContent : undefined,
      uploadFile,
      // Every block takes its direction from its own text, so Hebrew and
      // English can sit on the same page regardless of the UI language.
      extensions: [blockDirection({ fallback: localeDirection[locale] })],
    },
    [locale],
  );

  const pagesById = useMemo(
    () => new Map(pages.map((p) => [p.id, p])),
    [pages],
  );

  const pageLinkItems = (): DefaultReactSuggestionItem[] =>
    pages
      .filter((p) => p.id !== currentPageId)
      .map((p) => ({
        title: p.title || untitled,
        icon: p.icon ? <span>{p.icon}</span> : undefined,
        onItemClick: () =>
          editor.insertInlineContent([
            {
              type: "pageLink",
              props: { pageId: p.id, title: p.title },
            },
            " ",
          ]),
      }));

  return (
    <PagesContext.Provider value={pagesById}>
      <BlockNoteView
        editor={editor}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        sideMenu={false}
        onChange={() => onChange?.(editor.document)}
      >
        <SideMenuController
          floatingUIOptions={{
            useFloatingOptions: { placement: sideMenuPlacement },
          }}
        />
        <SuggestionMenuController
          triggerCharacter="@"
          getItems={async (q) => filterSuggestionItems(pageLinkItems(), q)}
        />
      </BlockNoteView>
    </PagesContext.Provider>
  );
}
