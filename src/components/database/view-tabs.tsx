"use client";

import { ChevronDown, Copy, Kanban, Plus, Table2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { saveDatabase } from "@/lib/database/actions";
import {
  addView,
  duplicateView,
  removeView,
  updateView,
} from "@/lib/database/schema";
import type { Database, View, ViewType } from "@/lib/database/types";
import { cn } from "@/lib/utils";

const ICONS: Record<ViewType, typeof Table2> = { table: Table2, board: Kanban };

/** The saved views of a database, as tabs, with a menu for the open one. */
export function ViewTabs({
  databaseId,
  database,
  active,
  onSelect,
}: {
  databaseId: string;
  database: Database;
  active: View;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("Database");
  const save = (db: Database) => void saveDatabase(databaseId, db);

  const create = (type: ViewType) => {
    const { db, id } = addView(
      database,
      type,
      type === "board" ? t("viewBoard") : t("viewTable"),
    );
    if (!id) return;
    save(db);
    onSelect(id);
  };

  return (
    <div
      role="tablist"
      aria-label={t("views")}
      className="flex min-w-0 flex-wrap items-center gap-0.5"
    >
      {database.views.map((v) => {
        const Icon = ICONS[v.type];
        const selected = v.id === active.id;
        return selected ? (
          <ViewMenu
            key={v.id}
            database={database}
            view={v}
            save={save}
            onSelect={onSelect}
          />
        ) : (
          <Button
            key={v.id}
            role="tab"
            aria-selected={false}
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => onSelect(v.id)}
          >
            <Icon />
            <bdi className="max-w-40 truncate">{v.name}</bdi>
          </Button>
        );
      })}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t("addView")}>
            <Plus />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => create("table")}>
            <Table2 />
            {t("viewTable")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => create("board")}>
            <Kanban />
            {t("viewBoard")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** The open view's tab: its menu renames, retypes, regroups, copies or deletes it. */
function ViewMenu({
  database,
  view,
  save,
  onSelect,
}: {
  database: Database;
  view: View;
  save: (db: Database) => void;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("Database");
  const [name, setName] = useState(view.name);
  const Icon = ICONS[view.type];
  const selects = database.properties.filter((p) => p.type === "select");

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) setName(view.name);
        else if (name.trim() && name.trim() !== view.name)
          save(updateView(database, view.id, { name: name.trim() }));
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          role="tab"
          aria-selected
          variant="secondary"
          size="sm"
          className={cn("font-medium")}
        >
          <Icon />
          <bdi className="max-w-40 truncate">{view.name}</bdi>
          <ChevronDown className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <div className="p-1">
          <Input
            value={name}
            dir="auto"
            aria-label={t("viewName")}
            className="h-8"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
        <DropdownMenuLabel>{t("viewType")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={view.type}
          onValueChange={(type) => {
            const groupBy =
              type === "board" && !view.groupBy
                ? (selects[0]?.id ?? null)
                : view.groupBy;
            save(
              updateView(database, view.id, {
                type: type as ViewType,
                groupBy,
              }),
            );
          }}
        >
          <DropdownMenuRadioItem value="table">
            <Table2 />
            {t("viewTable")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="board">
            <Kanban />
            {t("viewBoard")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        {view.type === "board" && selects.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t("groupBy")}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={view.groupBy ?? ""}
              onValueChange={(groupBy) =>
                save(updateView(database, view.id, { groupBy }))
              }
            >
              {selects.map((p) => (
                <DropdownMenuRadioItem key={p.id} value={p.id}>
                  <bdi className="truncate">{p.name}</bdi>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            const { db, id } = duplicateView(
              database,
              view.id,
              t("copySuffix"),
            );
            if (!id) return;
            save(db);
            onSelect(id);
          }}
        >
          <Copy />
          {t("duplicateView")}
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          disabled={database.views.length <= 1}
          onSelect={() => {
            const next = database.views.find((v) => v.id !== view.id);
            save(removeView(database, view.id));
            if (next) onSelect(next.id);
          }}
        >
          <Trash2 />
          {t("deleteView")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
