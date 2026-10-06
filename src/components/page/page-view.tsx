"use client";

import { ImagePlus, SmilePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Editor } from "@/components/editor/dynamic-editor";
import type { NotePartialBlock } from "@/components/editor/schema";
import { Button } from "@/components/ui/button";
import { localeDirection, type Locale } from "@/i18n/config";
import { createAutosave, type SaveStatus } from "@/lib/autosave";
import { storageEnabled } from "@/lib/firebase/client";
import {
  ContentTooLargeError,
  loadContent,
  saveContent,
  updatePage,
  usePage,
} from "@/lib/pages/client";
import { detectDirection } from "@/components/editor/direction";
import { parseCover } from "@/lib/pages/cover";
import type { Page } from "@/lib/pages/model";
import {
  clearDraft,
  pickNewer,
  readDraft,
  writeDraft,
} from "@/lib/pages/draft";
import { uploadPageFile } from "@/lib/pages/upload";
import { restorePage } from "@/lib/pages/actions";
import { usePagesStore } from "@/lib/pages/store";
import { ancestors } from "@/lib/pages/tree";
import { Breadcrumbs } from "./breadcrumbs";
import { CoverPicker } from "./cover-picker";
import { IconPicker } from "./icon-picker";

const RANK: Record<SaveStatus, number> = {
  idle: 0,
  saved: 1,
  pending: 2,
  saving: 3,
  error: 4,
};

export function PageView({
  pageId,
  locale,
}: {
  pageId: string;
  locale: Locale;
}) {
  const t = useTranslations("Page");
  const tApp = useTranslations("App");
  const state = usePage(pageId);

  if (state.status === "loading") {
    return (
      <p className="p-8 text-sm text-muted-foreground">{tApp("loading")}</p>
    );
  }
  if (state.status === "missing") {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-4 p-8">
        <p>{t("notFound")}</p>
        <Link href="/" className="text-sm underline">
          {t("backHome")}
        </Link>
      </main>
    );
  }
  return <LoadedPage key={pageId} page={state.page} locale={locale} />;
}

function LoadedPage({ page, locale }: { page: Page; locale: Locale }) {
  const t = useTranslations("Page");
  const tApp = useTranslations("App");
  const { live, byId } = usePagesStore();
  const [blocks, setBlocks] = useState<NotePartialBlock[] | null>(null);
  const [title, setTitle] = useState(page.title);
  const [titleFocused, setTitleFocused] = useState(false);
  // Follow renames made elsewhere (sidebar, another tab) unless the title is
  // being edited here; while typing, the local value is the newest.
  const [serverTitle, setServerTitle] = useState(page.title);
  if (page.title !== serverTitle) {
    setServerTitle(page.title);
    if (!titleFocused) setTitle(page.title);
  }
  const [contentStatus, setContentStatus] = useState<SaveStatus>("idle");
  const [titleStatus, setTitleStatus] = useState<SaveStatus>("idle");
  const [tooLarge, setTooLarge] = useState<number | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  const contentSaver = useMemo(
    () =>
      createAutosave<{ blocks: NotePartialBlock[]; at: number }>(
        async ({ blocks, at }) => {
          try {
            await saveContent(page.id, blocks);
            clearDraft(page.id, at);
            setTooLarge(null);
          } catch (e) {
            if (e instanceof ContentTooLargeError) setTooLarge(e.bytes);
            throw e;
          }
        },
        { delay: 800, onStatus: setContentStatus },
      ),
    [page.id],
  );
  const titleSaver = useMemo(
    () =>
      createAutosave<string>((value) => updatePage(page.id, { title: value }), {
        delay: 500,
        onStatus: setTitleStatus,
      }),
    [page.id],
  );

  // Load the document once; afterwards the editor owns it.
  useEffect(() => {
    let cancelled = false;
    void loadContent(page.id).then((server) => {
      if (cancelled) return;
      // A local draft newer than the server copy means the last edits never
      // reached Firestore (e.g. a refresh right after typing): restore them.
      const draft = readDraft<NotePartialBlock[]>(page.id);
      const picked = pickNewer(
        {
          value: server.blocks as NotePartialBlock[],
          updatedAt: server.updatedAt,
        },
        draft,
      );
      setBlocks(picked.value);
      if (picked.fromDraft && draft)
        contentSaver.schedule({ blocks: draft.value, at: draft.at });
    });
    return () => {
      cancelled = true;
    };
  }, [page.id, contentSaver]);

  // Write out anything pending when the tab is hidden or the page is left.
  useEffect(() => {
    const flush = () => {
      void contentSaver.flush();
      void titleSaver.flush();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      // Only flush: the savers are memoized per page, and StrictMode runs this
      // cleanup once during development while the same savers stay in use.
      flush();
    };
  }, [contentSaver, titleSaver]);

  useEffect(() => {
    document.title = `${title || tApp("untitled")} · ${tApp("title")}`;
  }, [title, tApp]);

  // Grow the title box with its text, and again whenever its width changes
  // (the first measurement can happen before the stylesheet has applied).
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const fit = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };
    fit();
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fit();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [title]);

  const status =
    RANK[contentStatus] >= RANK[titleStatus] ? contentStatus : titleStatus;
  const cover = parseCover(page.coverUrl);
  // Icon, buttons and title follow the title's language, like a text block.
  const headerDir = detectDirection(title) ?? localeDirection[locale];
  const summaries = useMemo(
    () => live.map((p) => ({ id: p.id, title: p.title, icon: p.icon })),
    [live],
  );
  // The page itself, or a page above it, may be in the trash.
  const archivedRoot = page.isArchived
    ? page
    : ancestors(byId, page.id).find((p) => p.isArchived);

  return (
    <main className="flex flex-1 flex-col">
      <div className="sticky top-12 z-20 flex h-10 items-center gap-3 bg-background/90 px-4 backdrop-blur">
        <Breadcrumbs page={page} />
        <span
          role="status"
          aria-live="polite"
          className={`ms-auto shrink-0 text-xs ${status === "error" ? "text-destructive" : ""}`}
        >
          {status !== "idle" && t(`status.${status}`)}
        </span>
      </div>

      {archivedRoot && (
        <div
          role="alert"
          className="flex items-center justify-center gap-3 bg-destructive/10 px-4 py-2 text-sm"
        >
          {archivedRoot.id === page.id ? t("inTrash") : t("inTrashAncestor")}
          <Button
            size="sm"
            variant="outline"
            onClick={() => void restorePage(archivedRoot.id)}
          >
            {t("restore")}
          </Button>
        </div>
      )}

      {cover && (
        <div className="group relative h-44 w-full overflow-hidden bg-muted sm:h-56">
          {cover.kind === "gradient" ? (
            <div className="size-full" style={{ background: cover.css }} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- any host the owner links to
            <img src={cover.url} alt="" className="size-full object-cover" />
          )}
          <CoverPicker
            value={page.coverUrl}
            onChange={(coverUrl) => void updatePage(page.id, { coverUrl })}
          >
            <Button
              size="sm"
              variant="secondary"
              className="absolute end-4 bottom-3 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
            >
              {t("changeCover")}
            </Button>
          </CoverPicker>
        </div>
      )}

      {/* The padding matches BlockNote's own (editor.css on phones), so the title lines up with the text. */}
      <div
        dir={headerDir}
        className="mx-auto w-full max-w-3xl px-4 sm:px-[54px]"
      >
        <div className={cover && page.icon ? "-mt-10" : "mt-10"}>
          {page.icon && (
            <IconPicker
              value={page.icon}
              onChange={(icon) => void updatePage(page.id, { icon })}
            >
              <button
                type="button"
                aria-label={t("chooseIcon")}
                className="relative rounded-md text-6xl leading-none hover:bg-muted"
              >
                {page.icon}
              </button>
            </IconPicker>
          )}
        </div>

        <div className="group flex min-h-9 items-center gap-1 text-muted-foreground">
          {!page.icon && (
            <IconPicker
              value={null}
              onChange={(icon) => void updatePage(page.id, { icon })}
            >
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
              >
                <SmilePlus />
                {t("addIcon")}
              </Button>
            </IconPicker>
          )}
          {!cover && (
            <CoverPicker
              value={null}
              onChange={(coverUrl) => void updatePage(page.id, { coverUrl })}
            >
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
              >
                <ImagePlus />
                {t("addCover")}
              </Button>
            </CoverPicker>
          )}
        </div>

        <textarea
          ref={titleRef}
          rows={1}
          dir={headerDir}
          value={title}
          placeholder={t("titlePlaceholder")}
          aria-label={t("titlePlaceholder")}
          className="w-full resize-none overflow-hidden bg-transparent text-3xl font-bold outline-none placeholder:text-muted-foreground/50 sm:text-4xl"
          onChange={(e) => {
            setTitle(e.target.value);
            titleSaver.schedule(e.target.value);
          }}
          onFocus={() => setTitleFocused(true)}
          onBlur={() => setTitleFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
        />

        {tooLarge !== null && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {t("tooLarge", { size: (tooLarge / 1_000_000).toFixed(1) })}
          </p>
        )}
      </div>

      <div className="mx-auto w-full max-w-3xl pb-32">
        {blocks === null ? (
          <p className="px-6 text-sm text-muted-foreground">
            {tApp("loading")}
          </p>
        ) : (
          <Editor
            locale={locale}
            initialContent={blocks}
            onChange={(doc) => {
              const at = Date.now();
              writeDraft(page.id, doc, at);
              contentSaver.schedule({ blocks: doc, at });
            }}
            uploadFile={
              storageEnabled
                ? (file) => uploadPageFile(page.id, file)
                : undefined
            }
            pages={summaries}
            currentPageId={page.id}
            untitled={tApp("untitled")}
          />
        )}
      </div>
    </main>
  );
}
