"use client";

import { Plus } from "lucide-react";
import { PageIcon } from "@/components/page/page-icon";
import { useFormatter, useNow, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createPageUnder } from "@/lib/pages/actions";
import { usePagesStore } from "@/lib/pages/store";

const RECENT_LIMIT = 20;

export function HomeView() {
  const t = useTranslations();
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const router = useRouter();
  const { live, all, loading } = usePagesStore();
  const pages = loading
    ? null
    : [...live]
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        // The sidebar holds the full tree; home shows what changed lately.
        .slice(0, RECENT_LIMIT);
  const [pending, startTransition] = useTransition();

  const newPage = () =>
    startTransition(async () => {
      const id = await createPageUnder(all, null);
      router.push(`/p/${id}`);
    });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t("Home.recent")}</h1>
        <Button onClick={newPage} disabled={pending}>
          <Plus />
          {t("Home.newPage")}
        </Button>
      </div>

      {pages === null ? (
        <p className="text-sm text-muted-foreground">{t("App.loading")}</p>
      ) : pages.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("Home.empty")}</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {pages.map((p) => (
            <li key={p.id}>
              <Link
                href={`/p/${p.id}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted"
              >
                <span className="w-5 text-center" aria-hidden>
                  <PageIcon page={p} />
                </span>
                <bdi className="min-w-0 flex-1 truncate">
                  {p.title || t("App.untitled")}
                </bdi>
                <span className="text-xs text-muted-foreground">
                  {format.relativeTime(
                    p.updatedAt > now ? now : p.updatedAt,
                    now,
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/lab/editor"
        className="text-sm text-muted-foreground hover:underline"
      >
        {t("Home.editorLab")}
      </Link>
    </main>
  );
}
