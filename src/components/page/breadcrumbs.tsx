"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Fragment } from "react";
import type { Page } from "@/lib/pages/model";
import { usePagesStore } from "@/lib/pages/store";
import { ancestors } from "@/lib/pages/tree";

/** Path from the top level to the current page, each step a link. */
export function Breadcrumbs({ page }: { page: Page }) {
  const t = useTranslations("Page");
  const tApp = useTranslations("App");
  const { byId } = usePagesStore();
  const trail = [...ancestors(byId, page.id), page];

  return (
    <nav aria-label={t("breadcrumbs")} className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
        {trail.map((p, i) => (
          <Fragment key={p.id}>
            {i > 0 && (
              <ChevronRight
                aria-hidden
                className="size-3.5 shrink-0 rtl:rotate-180"
              />
            )}
            <li className="flex min-w-0 items-center">
              {i === trail.length - 1 ? (
                <span aria-current="page" className="truncate text-foreground">
                  {p.icon && <span aria-hidden>{p.icon} </span>}
                  <bdi>{p.title || tApp("untitled")}</bdi>
                </span>
              ) : (
                <Link href={`/p/${p.id}`} className="truncate hover:underline">
                  {p.icon && <span aria-hidden>{p.icon} </span>}
                  <bdi>{p.title || tApp("untitled")}</bdi>
                </Link>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
