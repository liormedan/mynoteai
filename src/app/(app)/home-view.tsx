"use client";

import { FileText, Plus } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { getFirebase } from "@/lib/firebase/client";
import { usePages } from "@/lib/pages/client";
import { createPage } from "@/lib/pages/model";

export function HomeView() {
  const t = useTranslations();
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const router = useRouter();
  const pages = usePages();
  const [pending, startTransition] = useTransition();

  const newPage = () =>
    startTransition(async () => {
      const id = await createPage(getFirebase().db);
      router.push(`/p/${id}`);
    });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
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
                  {p.icon ?? (
                    <FileText className="inline size-4 text-muted-foreground" />
                  )}
                </span>
                <bdi className="min-w-0 flex-1 truncate">
                  {p.title || t("App.untitled")}
                </bdi>
                <span className="text-xs text-muted-foreground">
                  {format.relativeTime(p.updatedAt, now)}
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
