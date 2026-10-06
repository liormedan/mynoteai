"use client";

import { ChevronDown, FilePlus, Plus, Table2, X } from "lucide-react";
import { useCreateDatabase } from "@/components/database/use-create-database";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Locale } from "@/i18n/config";
import { createPageUnder, type PageSeed } from "@/lib/pages/actions";
import { usePagesStore } from "@/lib/pages/store";
import { builtinTemplates } from "@/lib/templates/builtin";
import { deleteTemplate, useUserTemplates } from "@/lib/templates/user";

/** "New page" plus a menu of built-in and saved templates. */
export function NewPageMenu({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("Sidebar");
  const tApp = useTranslations("App");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { all } = usePagesStore();
  const mine = useUserTemplates();
  const createDatabase = useCreateDatabase(onNavigate);

  const create = async (seed?: PageSeed) => {
    const id = await createPageUnder(all, null, seed);
    router.push(`/p/${id}`);
    onNavigate?.();
  };

  return (
    <div className="flex">
      <Button
        variant="ghost"
        size="sm"
        className="flex-1 justify-start rounded-e-none"
        onClick={() => void create()}
      >
        <Plus />
        {t("newPage")}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-s-none"
            aria-label={t("templates")}
          >
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onSelect={() => void create()}>
            <FilePlus />
            {t("emptyPage")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void createDatabase()}>
            <Table2 />
            {t("database")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t("templates")}</DropdownMenuLabel>
          {builtinTemplates(locale).map((tpl) => (
            <DropdownMenuItem
              key={tpl.id}
              onSelect={() =>
                void create({
                  title: tpl.title,
                  icon: tpl.icon,
                  blocks: tpl.blocks,
                })
              }
            >
              <span aria-hidden>{tpl.icon}</span>
              {tpl.title}
            </DropdownMenuItem>
          ))}
          {mine.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{t("myTemplates")}</DropdownMenuLabel>
              {mine.map((tpl) => (
                <DropdownMenuItem
                  key={tpl.id}
                  className="group/tpl"
                  onSelect={() =>
                    void create({
                      title: tpl.title,
                      icon: tpl.icon,
                      blocks: tpl.blocks,
                    })
                  }
                >
                  <span aria-hidden>{tpl.icon ?? "📄"}</span>
                  <bdi className="flex-1 truncate">
                    {tpl.title || tApp("untitled")}
                  </bdi>
                  <button
                    type="button"
                    aria-label={t("deleteTemplate")}
                    className="rounded p-0.5 opacity-0 group-hover/tpl:opacity-100 hover:bg-background focus-visible:opacity-100 pointer-coarse:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      void deleteTemplate(tpl.id);
                    }}
                  >
                    <X className="size-3.5" />
                  </button>
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
