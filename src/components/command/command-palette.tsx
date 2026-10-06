"use client";

import { Command as CommandPrimitive } from "cmdk";
import {
  Home,
  Languages,
  PanelLeft,
  Plus,
  SunMoon,
  Table2,
  Bot,
} from "lucide-react";
import { useCreateDatabase } from "@/components/database/use-create-database";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import {
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageIcon } from "@/components/page/page-icon";
import { setLocale } from "@/i18n/actions";
import { createPageUnder } from "@/lib/pages/actions";
import type { Page } from "@/lib/pages/model";
import { usePagesStore } from "@/lib/pages/store";
import { ancestors } from "@/lib/pages/tree";
import { useSearch } from "@/lib/search/provider";
import {
  isMac,
  matches,
  SHORTCUTS,
  shortcutLabel,
  type ShortcutName,
} from "@/lib/shortcuts";

const RECENT = 8;

/** Event the sidebar listens to: focus the tree, or open the mobile drawer. */
export const FOCUS_SIDEBAR_EVENT = "mynoteai:focus-sidebar";

type PaletteContext = { open: () => void };
const Ctx = createContext<PaletteContext>({ open: () => {} });
export const useCommandPalette = () => useContext(Ctx);

const subscribe = () => () => {};
export function useIsMac() {
  return useSyncExternalStore(subscribe, isMac, () => false);
}

export function useShortcutLabel(name: ShortcutName) {
  return shortcutLabel(SHORTCUTS[name], useIsMac());
}

/** Global shortcuts and the Ctrl+K window, for every page of the app. */
export function CommandPaletteProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const actions = useActions();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (matches(e, SHORTCUTS.palette)) setOpen((o) => !o);
      else if (matches(e, SHORTCUTS.newPage)) actions.newPage();
      else if (matches(e, SHORTCUTS.focusSidebar)) actions.focusSidebar();
      else if (matches(e, SHORTCUTS.toggleTheme)) actions.toggleTheme();
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    // Capture phase: runs before the editor sees the key.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [actions]);

  const ctx = useMemo(() => ({ open: () => setOpen(true) }), []);

  return (
    <Ctx.Provider value={ctx}>
      {children}
      <Palette open={open} onOpenChange={setOpen} actions={actions} />
    </Ctx.Provider>
  );
}

function useActions() {
  const router = useRouter();
  const locale = useLocale();
  const { all } = usePagesStore();
  const { resolvedTheme, setTheme } = useTheme();
  const [, startTransition] = useTransition();

  return useMemo(
    () => ({
      goTo: (id: string) => router.push(`/p/${id}`),
      goHome: () => router.push("/"),
      goAgents: () => router.push("/agents"),
      newPage: async (title?: string) => {
        const id = await createPageUnder(all, null, { title });
        router.push(`/p/${id}`);
      },
      toggleTheme: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
      switchLocale: () =>
        startTransition(async () => {
          await setLocale(locale === "he" ? "en" : "he");
          router.refresh();
        }),
      focusSidebar: () => window.dispatchEvent(new Event(FOCUS_SIDEBAR_EVENT)),
    }),
    [router, all, locale, resolvedTheme, setTheme],
  );
}

type Actions = ReturnType<typeof useActions>;

function Palette({
  open,
  onOpenChange,
  actions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: Actions;
}) {
  const t = useTranslations("Command");
  const tApp = useTranslations("App");
  const { live, byId } = usePagesStore();
  const { search, pending } = useSearch();
  const createDatabase = useCreateDatabase();
  const [query, setQuery] = useState("");
  const mac = useIsMac();
  const q = query.trim();

  const results = useMemo(() => (q ? search(q, 30) : []), [q, search]);
  const recent = useMemo(
    () =>
      q
        ? []
        : [...live]
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
            .slice(0, RECENT),
    [q, live],
  );

  const close = useCallback(() => {
    onOpenChange(false);
    setQuery("");
  }, [onOpenChange]);
  const run = (fn: () => void) => () => {
    close();
    fn();
  };

  const commands = [
    {
      id: "new",
      label: t("newPage"),
      icon: Plus,
      shortcut: "newPage" as const,
      run: () => void actions.newPage(),
    },
    {
      id: "database",
      label: t("newDatabase"),
      icon: Table2,
      run: () => void createDatabase(),
    },
    {
      id: "agents",
      label: t("agents"),
      icon: Bot,
      run: actions.goAgents,
    },
    {
      id: "home",
      label: t("goHome"),
      icon: Home,
      run: actions.goHome,
    },
    {
      id: "sidebar",
      label: t("focusSidebar"),
      icon: PanelLeft,
      shortcut: "focusSidebar" as const,
      run: actions.focusSidebar,
    },
    {
      id: "theme",
      label: t("toggleTheme"),
      icon: SunMoon,
      shortcut: "toggleTheme" as const,
      run: actions.toggleTheme,
    },
    {
      id: "locale",
      label: t("switchLanguage"),
      icon: Languages,
      run: actions.switchLocale,
    },
  ].filter((c) => !q || c.label.toLowerCase().includes(q.toLowerCase()));

  const pageItem = (page: Page, snippet?: (typeof results)[0]["snippet"]) => {
    const path = ancestors(byId, page.id)
      .map((p) => p.title || tApp("untitled"))
      .join(" / ");
    return (
      <CommandItem
        key={page.id}
        value={`page:${page.id}`}
        onSelect={run(() => actions.goTo(page.id))}
        className="items-start"
      >
        <span className="mt-0.5 w-4 shrink-0 text-center" aria-hidden>
          <PageIcon page={page} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-baseline gap-2">
            <bdi className="truncate">{page.title || tApp("untitled")}</bdi>
            {path && (
              <bdi className="truncate text-xs text-muted-foreground">
                {path}
              </bdi>
            )}
          </span>
          {snippet && (
            <bdi
              dir="auto"
              className="line-clamp-2 text-xs text-muted-foreground"
            >
              {snippet.before}
              <mark className="rounded-sm bg-yellow-200/70 text-foreground dark:bg-yellow-500/30">
                {snippet.match}
              </mark>
              {snippet.after}
            </bdi>
          )}
        </span>
      </CommandItem>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : close())}>
      <DialogContent
        showCloseButton={false}
        className="top-[15%] translate-y-0 gap-0 overflow-hidden p-0 max-sm:top-2 sm:max-w-xl"
      >
        <DialogTitle className="sr-only">{t("title")}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("description")}
        </DialogDescription>
        <CommandPrimitive
          shouldFilter={false}
          loop
          className="flex flex-col bg-popover p-1 text-popover-foreground"
        >
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={t("placeholder")}
            // "auto" on an empty field would lay the placeholder out LTR.
            dir={query ? "auto" : undefined}
          />
          <CommandList className="max-h-[min(60vh,28rem)]">
            {q && !results.length && (
              // Not CommandEmpty: the "create page" action is always listed.
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                {t("noResults")}
              </p>
            )}
            {results.length > 0 && (
              <CommandGroup heading={t("results")}>
                {results.map((r) => pageItem(r.page, r.snippet))}
              </CommandGroup>
            )}
            {recent.length > 0 && (
              <CommandGroup heading={t("recent")}>
                {recent.map((p) => pageItem(p))}
              </CommandGroup>
            )}
            <CommandGroup heading={t("actions")}>
              {q && (
                <CommandItem
                  value="create-named"
                  onSelect={run(() => void actions.newPage(q))}
                >
                  <Plus />
                  <bdi className="truncate">
                    {t("createNamed", { title: q })}
                  </bdi>
                </CommandItem>
              )}
              {commands.map((c) => (
                <CommandItem key={c.id} value={c.id} onSelect={run(c.run)}>
                  <c.icon />
                  {c.label}
                  {c.shortcut && (
                    <CommandShortcut dir="ltr">
                      {shortcutLabel(SHORTCUTS[c.shortcut], mac)}
                    </CommandShortcut>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {pending > 0 && (
            <p className="border-t px-3 py-1.5 text-xs text-muted-foreground">
              {t("indexing", { count: pending })}
            </p>
          )}
        </CommandPrimitive>
      </DialogContent>
    </Dialog>
  );
}
