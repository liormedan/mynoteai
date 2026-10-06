"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useState } from "react";
import { PageIcon } from "@/components/page/page-icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  deletePageForever,
  emptyTrash,
  restorePage,
} from "@/lib/pages/actions";
import { usePagesStore } from "@/lib/pages/store";

/**
 * Pages in the trash, newest first. Deleting for good needs a second click on
 * the same button; nothing is removed without it.
 */
export function TrashDialog({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Trash");
  const tApp = useTranslations("App");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const { trash, all } = usePagesStore();
  const [armed, setArmed] = useState<string | null>(null);

  return (
    <Dialog onOpenChange={() => setArmed(null)}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("hint")}</DialogDescription>
        </DialogHeader>

        {trash.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto rounded-md border">
            {trash.map((p) => (
              <li key={p.id} className="flex items-center gap-2 px-3 py-2">
                <span className="w-5 text-center" aria-hidden>
                  <PageIcon page={p} />
                </span>
                <div className="min-w-0 flex-1">
                  <bdi className="block truncate text-sm">
                    {p.title || tApp("untitled")}
                  </bdi>
                  <span className="text-xs text-muted-foreground">
                    {t("deletedAt", {
                      when: format.relativeTime(
                        p.updatedAt > now ? now : p.updatedAt,
                        now,
                      ),
                    })}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void restorePage(p.id)}
                >
                  <RotateCcw />
                  {t("restore")}
                </Button>
                <Button
                  variant={armed === p.id ? "destructive" : "ghost"}
                  size="sm"
                  aria-label={
                    armed === p.id ? t("confirmDelete") : t("deleteForever")
                  }
                  title={
                    armed === p.id ? t("confirmDelete") : t("deleteForever")
                  }
                  onClick={() => {
                    if (armed !== p.id) return setArmed(p.id);
                    setArmed(null);
                    void deletePageForever(all, p.id);
                  }}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {trash.length > 0 && (
          <Button
            variant={armed === "*" ? "destructive" : "outline"}
            onClick={() => {
              if (armed !== "*") return setArmed("*");
              setArmed(null);
              void emptyTrash(all);
            }}
          >
            {armed === "*" ? t("confirmEmpty") : t("emptyTrash")}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
