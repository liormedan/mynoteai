"use client";

import { FileText, Home } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { movePage, nextPosition } from "@/lib/pages/actions";
import type { Page } from "@/lib/pages/model";
import { usePagesStore } from "@/lib/pages/store";
import { canMoveUnder } from "@/lib/pages/tree";

/** Keyboard-friendly alternative to dragging: pick a new parent from a list. */
export function MoveDialog({
  page,
  onClose,
}: {
  page: Page | null;
  onClose: () => void;
}) {
  const t = useTranslations("Move");
  const tApp = useTranslations("App");
  const { live, all } = usePagesStore();
  const [filter, setFilter] = useState("");

  const targets = page
    ? live.filter(
        (p) =>
          p.id !== page.parentId &&
          canMoveUnder(all, page.id, p.id) &&
          (p.title || tApp("untitled"))
            .toLowerCase()
            .includes(filter.trim().toLowerCase()),
      )
    : [];

  const moveTo = (parentId: string | null) => {
    if (!page) return;
    void movePage(page.id, parentId, nextPosition(all, parentId));
    setFilter("");
    onClose();
  };

  return (
    <Dialog open={page !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("title", { page: page?.title || tApp("untitled") })}
          </DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          value={filter}
          placeholder={t("search")}
          aria-label={t("search")}
          onChange={(e) => setFilter(e.target.value)}
        />
        <ul className="max-h-72 overflow-y-auto">
          {page?.parentId !== null && (
            <li>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                onClick={() => moveTo(null)}
              >
                <Home className="size-4 opacity-60" />
                {t("topLevel")}
              </button>
            </li>
          )}
          {targets.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                onClick={() => moveTo(p.id)}
              >
                <span className="w-4 text-center" aria-hidden>
                  {p.icon ?? <FileText className="inline size-4 opacity-60" />}
                </span>
                <bdi className="truncate">{p.title || tApp("untitled")}</bdi>
              </button>
            </li>
          ))}
          {!targets.length && filter && (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">
              {t("none")}
            </li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
