"use client";

import type { PartialBlock } from "@blocknote/core";
import { en, he } from "@blocknote/core/locales";
import "@blocknote/core/fonts/inter.css";
import { SideMenuController, useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/shadcn/style.css";
import { localeDirection, type Locale } from "@/i18n/config";
import { blockDirection } from "./block-direction";
import "./editor-rtl.css";

const dictionaries = { en, he } satisfies Record<Locale, unknown>;

export type EditorProps = {
  locale: Locale;
  initialContent?: PartialBlock[];
};

export default function Editor({ locale, initialContent }: EditorProps) {
  const rtl = localeDirection[locale] === "rtl";
  // BlockNote always docks the drag handle on the left; in RTL it belongs on the right.
  const sideMenuPlacement = rtl ? "right-start" : "left-start"; // rtl-ok: floating-ui placement
  const editor = useCreateBlockNote(
    {
      dictionary: dictionaries[locale],
      initialContent,
      // Every block takes its direction from its own text, so Hebrew and
      // English can sit on the same page regardless of the UI language.
      extensions: [blockDirection({ fallback: localeDirection[locale] })],
    },
    [locale],
  );

  // Dark mode for the whole app (editor included) is S2-6; until then stay light.
  return (
    <BlockNoteView editor={editor} theme="light" sideMenu={false}>
      <SideMenuController
        floatingUIOptions={{
          useFloatingOptions: { placement: sideMenuPlacement },
        }}
      />
    </BlockNoteView>
  );
}
