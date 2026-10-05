"use client";

import { CloudOff, FileText, Menu, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDirection } from "@/components/ui/direction";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { usePagesStore } from "@/lib/pages/store";
import { ancestors } from "@/lib/pages/tree";
import { cn } from "@/lib/utils";
import { NewPageMenu } from "./new-page-menu";
import { PageTree } from "./page-tree";
import { TrashDialog } from "./trash-dialog";

const EXPANDED_KEY = "mynoteai:sidebar:expanded";

function useExpanded(activeId: string | null) {
  const { byId } = usePagesStore();
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(EXPANDED_KEY) ?? "[]"));
    } catch {
      return new Set();
    }
  });

  const save = (next: Set<string>) => {
    try {
      localStorage.setItem(EXPANDED_KEY, JSON.stringify([...next]));
    } catch {
      // per-browser convenience only
    }
    return next;
  };

  const toggle = useCallback((id: string, open?: boolean) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (open ?? !prev.has(id)) next.add(id);
      else next.delete(id);
      return save(next);
    });
  }, []);

  // The open page is always visible: its ancestors count as expanded.
  const effective = useMemo(() => {
    if (!activeId) return expanded;
    const forced = ancestors(byId, activeId).map((p) => p.id);
    return forced.every((id) => expanded.has(id))
      ? expanded
      : new Set([...expanded, ...forced]);
  }, [activeId, byId, expanded]);

  return { expanded: effective, toggle };
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("Sidebar");
  const tApp = useTranslations("App");
  const pathname = usePathname();
  const activeId = pathname.startsWith("/p/") ? pathname.slice(3) : null;
  const { favorites, loading, fromCache } = usePagesStore();
  const { expanded, toggle } = useExpanded(activeId);

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-2">
      <NewPageMenu onNavigate={onNavigate} />

      {favorites.length > 0 && (
        <section>
          <h2 className="px-2 pb-1 text-xs font-medium text-muted-foreground">
            {t("favorites")}
          </h2>
          <ul>
            {favorites.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/p/${p.id}`}
                  onClick={onNavigate}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-md px-2 text-sm hover:bg-muted/60",
                    p.id === activeId && "bg-muted font-medium",
                  )}
                >
                  <span className="w-4 text-center" aria-hidden>
                    {p.icon ?? (
                      <FileText className="inline size-3.5 opacity-60" />
                    )}
                  </span>
                  <bdi className="truncate">{p.title || tApp("untitled")}</bdi>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex-1">
        <h2 className="px-2 pb-1 text-xs font-medium text-muted-foreground">
          {t("pages")}
        </h2>
        {loading ? (
          <p className="px-2 text-sm text-muted-foreground">
            {tApp("loading")}
          </p>
        ) : (
          <PageTree
            activeId={activeId}
            expanded={expanded}
            onToggle={toggle}
            onNavigate={onNavigate}
          />
        )}
      </section>

      <div className="flex flex-col gap-1 border-t pt-2">
        {fromCache && (
          <p className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
            <CloudOff className="size-3.5" />
            {t("offline")}
          </p>
        )}
        <TrashDialog>
          <Button variant="ghost" size="sm" className="justify-start">
            <Trash2 />
            {t("trash")}
          </Button>
        </TrashDialog>
      </div>
    </div>
  );
}

/** Fixed column on wide screens. */
export function Sidebar() {
  return (
    <aside className="sticky top-12 hidden h-[calc(100dvh-3rem)] w-64 shrink-0 border-e bg-muted/20 md:block">
      <SidebarContent />
    </aside>
  );
}

/** Drawer on narrow screens, opened from the header. */
export function MobileSidebar() {
  const t = useTranslations("Sidebar");
  const [open, setOpen] = useState(false);
  // The drawer slides in from the start edge: left in English, right in Hebrew.
  const side = useDirection() === "rtl" ? "right" : "left"; // rtl-ok: Sheet takes a physical side
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          aria-label={t("openMenu")}
        >
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side={side} className="w-72 p-0">
        <SheetTitle className="sr-only">{t("pages")}</SheetTitle>
        <SidebarContent onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
