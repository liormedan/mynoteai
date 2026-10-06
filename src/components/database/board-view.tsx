"use client";

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
} from "@dnd-kit/core";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { moveRow, saveDatabase } from "@/lib/database/actions";
import { dropPosition } from "@/lib/database/board";
import { addOption, removeOption, updateOption } from "@/lib/database/schema";
import {
  OPTION_COLORS,
  type Database,
  type OptionColor,
  type Property,
  type SelectOption,
  type View,
} from "@/lib/database/types";
import {
  displayText,
  filterRows,
  groupRows,
  isEmpty,
  sortRows,
  collator,
  valueOf,
  type Row,
} from "@/lib/database/values";
import { patchPage } from "@/lib/pages/actions";
import { cn } from "@/lib/utils";
import { OPTION_CLASSES, OptionBadge } from "./option-badge";
import type { ViewEdits } from "./view-edits";

type Target = {
  column: string | null;
  card: { id: string; after: boolean } | null;
};

/** Column key for dnd-kit ids: options by id, "no value" as a fixed key. */
const NONE = "__none__";
const columnKey = (id: string | null) => `col:${id ?? NONE}`;

/**
 * The board view: one column per option of a select field. Dragging a card
 * sets that field and its place in the column; with a sort on, cards keep
 * the sorted order and only change column.
 */
export function BoardView({
  databaseId,
  database,
  view,
  rows,
  edits,
  onAddRow,
  editingTitle,
  onEditingTitle,
}: {
  databaseId: string;
  database: Database;
  view: View;
  rows: Row[];
  edits: ViewEdits;
  onAddRow: (values: Record<string, string>) => void;
  editingTitle: string | null;
  onEditingTitle: (id: string | null) => void;
}) {
  const t = useTranslations("Database");
  const locale = useLocale();
  const group = database.properties.find(
    (p) => p.id === view.groupBy && p.type === "select",
  );

  const shown = useMemo(
    () =>
      sortRows(
        filterRows(rows, database, view.filters),
        database,
        view.sorts,
        collator(locale),
      ),
    [rows, database, view.filters, view.sorts, locale],
  );

  if (!group) {
    return <ChooseGroup database={database} edits={edits} />;
  }
  return (
    <Board
      databaseId={databaseId}
      database={database}
      view={view}
      group={group}
      rows={shown}
      sorted={view.sorts.length > 0}
      onAddRow={(column) => onAddRow(column ? { [group.id]: column } : {})}
      editingTitle={editingTitle}
      onEditingTitle={onEditingTitle}
      noValueLabel={t("noValue", { name: group.name })}
    />
  );
}

function ChooseGroup({
  database,
  edits,
}: {
  database: Database;
  edits: ViewEdits;
}) {
  const t = useTranslations("Database");
  const selects = database.properties.filter((p) => p.type === "select");
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed p-6 text-sm">
      <p className="text-muted-foreground">{t("boardNeedsSelect")}</p>
      {selects.length ? (
        <select
          aria-label={t("groupBy")}
          className="h-8 rounded-md border bg-background px-2"
          defaultValue=""
          onChange={(e) => edits.setView({ groupBy: e.target.value || null })}
        >
          <option value="">{t("choose")}</option>
          {selects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const id = edits.addProperty(t("defaultStatus"), "select");
            if (id) edits.setView({ groupBy: id });
          }}
        >
          <Plus />
          {t("addSelectField")}
        </Button>
      )}
    </div>
  );
}

function Board({
  databaseId,
  database,
  view,
  group,
  rows,
  sorted,
  onAddRow,
  editingTitle,
  onEditingTitle,
  noValueLabel,
}: {
  databaseId: string;
  database: Database;
  view: View;
  group: Property;
  rows: Row[];
  sorted: boolean;
  onAddRow: (column: string | null) => void;
  editingTitle: string | null;
  onEditingTitle: (id: string | null) => void;
  noValueLabel: string;
}) {
  const t = useTranslations("Database");
  const columns = groupRows(rows, group);
  const [dragging, setDragging] = useState<Row | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // A short hold starts a drag on touch screens, so swiping still scrolls.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
  );

  const targetOf = (e: DragMoveEvent | DragEndEvent): Target | null => {
    const over = e.over;
    if (!over) return null;
    const id = String(over.id);
    if (id.startsWith("col:")) {
      const key = id.slice(4);
      return { column: key === NONE ? null : key, card: null };
    }
    const card = rows.find((r) => r.id === id);
    if (!card) return null;
    const v = valueOf(card, group);
    const column = typeof v === "string" && columns.has(v) ? v : null;
    // The dragged card's middle against the target's: works for mouse and touch.
    const moving = e.active.rect.current.translated;
    const middle = moving ? moving.top + moving.height / 2 : 0;
    return {
      column,
      card: { id, after: middle > over.rect.top + over.rect.height / 2 },
    };
  };

  const onDragEnd = (e: DragEndEvent) => {
    const moving = dragging;
    const to = targetOf(e);
    setDragging(null);
    setTarget(null);
    if (!moving || !to) return;
    const fromColumn = valueOf(moving, group);
    const sameColumn = (fromColumn ?? null) === to.column;
    const values = sameColumn ? {} : { [group.id]: to.column };
    if (sorted) {
      // Sorted boards keep their order: only the column changes.
      if (!sameColumn) void moveRow(moving.id, moving.position, values);
      return;
    }
    const column = columns.get(to.column) ?? [];
    void moveRow(moving.id, dropPosition(column, moving.id, to.card), values);
  };

  const keys: (string | null)[] = [...columns.keys()].filter(
    (k) => k !== null || columns.get(null)!.length > 0,
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) =>
        setDragging(rows.find((r) => r.id === e.active.id) ?? null)
      }
      onDragMove={(e) => setTarget(targetOf(e))}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setDragging(null);
        setTarget(null);
      }}
    >
      <div className="flex items-start gap-3 overflow-x-auto pb-4">
        {keys.map((key) => {
          const option = key ? group.options.find((o) => o.id === key)! : null;
          return (
            <Column
              key={key ?? NONE}
              id={key}
              option={option}
              label={option?.name ?? noValueLabel}
              cards={columns.get(key)!}
              database={database}
              view={view}
              group={group}
              target={dragging ? target : null}
              onAdd={() => onAddRow(key)}
              editingTitle={editingTitle}
              onEditingTitle={onEditingTitle}
              databaseId={databaseId}
            />
          );
        })}
        <AddGroup databaseId={databaseId} database={database} group={group} />
      </div>
      <DragOverlay dropAnimation={null}>
        {dragging && (
          <CardBody
            row={dragging}
            database={database}
            view={view}
            group={group}
            lifted
          />
        )}
      </DragOverlay>
      <p className="sr-only" aria-live="polite">
        {dragging ? t("dragging", { title: dragging.title }) : ""}
      </p>
    </DndContext>
  );
}

function Column({
  id,
  option,
  label,
  cards,
  database,
  view,
  group,
  target,
  onAdd,
  editingTitle,
  onEditingTitle,
  databaseId,
}: {
  id: string | null;
  option: SelectOption | null;
  label: string;
  cards: Row[];
  database: Database;
  view: View;
  group: Property;
  target: Target | null;
  onAdd: () => void;
  editingTitle: string | null;
  onEditingTitle: (id: string | null) => void;
  databaseId: string;
}) {
  const t = useTranslations("Database");
  const { setNodeRef } = useDroppable({ id: columnKey(id) });
  const isTarget = target !== null && target.column === id;

  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      className={cn(
        "flex w-64 shrink-0 flex-col gap-1.5 rounded-lg bg-muted/40 p-1.5",
        isTarget && !target?.card && "ring-2 ring-primary/40",
      )}
    >
      <header className="flex h-8 items-center gap-1.5 px-1">
        {option ? (
          <OptionBadge option={option} />
        ) : (
          <bdi className="truncate text-xs text-muted-foreground">{label}</bdi>
        )}
        <span className="text-xs text-muted-foreground tabular-nums">
          {cards.length}
        </span>
        {option && (
          <GroupMenu
            databaseId={databaseId}
            database={database}
            group={group}
            option={option}
          />
        )}
      </header>
      {cards.map((row) => (
        <Card
          key={row.id}
          row={row}
          database={database}
          view={view}
          group={group}
          indicator={
            isTarget && target?.card?.id === row.id
              ? target.card.after
                ? "after"
                : "before"
              : null
          }
          editing={editingTitle === row.id}
          onEditing={(on) => onEditingTitle(on ? row.id : null)}
        />
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="justify-start text-muted-foreground"
        onClick={onAdd}
      >
        <Plus />
        {t("new")}
      </Button>
    </section>
  );
}

function Card({
  row,
  database,
  view,
  group,
  indicator,
  editing,
  onEditing,
}: {
  row: Row;
  database: Database;
  view: View;
  group: Property;
  indicator: "before" | "after" | null;
  editing: boolean;
  onEditing: (on: boolean) => void;
}) {
  const router = useRouter();
  const t = useTranslations("Database");
  const tApp = useTranslations("App");
  const drag = useDraggable({ id: row.id, disabled: editing });
  const drop = useDroppable({ id: row.id });
  const cancelled = useRef(false);

  if (editing) {
    return (
      <input
        autoFocus
        dir="auto"
        defaultValue={row.title}
        aria-label={tApp("untitled")}
        className="rounded-md border bg-background px-2.5 py-2 text-sm font-medium shadow-sm ring-2 ring-ring/50 outline-none"
        onFocus={() => (cancelled.current = false)}
        onBlur={(e) => {
          onEditing(false);
          if (!cancelled.current && e.target.value !== row.title) {
            void patchPage(row.id, { title: e.target.value.slice(0, 500) });
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            cancelled.current = true;
            onEditing(false);
          }
        }}
      />
    );
  }

  return (
    <div
      ref={(el) => {
        drag.setNodeRef(el);
        drop.setNodeRef(el);
      }}
      {...drag.attributes}
      {...drag.listeners}
      role="link"
      tabIndex={0}
      aria-label={row.title || tApp("untitled")}
      className={cn(
        "group/card relative cursor-pointer rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        drag.isDragging && "opacity-40",
        indicator === "before" &&
          "before:absolute before:inset-x-1 before:-top-1 before:h-0.5 before:bg-primary",
        indicator === "after" &&
          "after:absolute after:inset-x-1 after:-bottom-1 after:h-0.5 after:bg-primary",
      )}
      onClick={() => router.push(`/p/${row.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/p/${row.id}`);
      }}
    >
      <CardBody row={row} database={database} view={view} group={group} />
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={t("deleteRow")}
        className="absolute end-1 top-1 opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          void patchPage(row.id, { isArchived: true });
        }}
      >
        <Trash2 />
      </Button>
    </div>
  );
}

/** A card's face: title and the non-empty, visible fields (read only). */
function CardBody({
  row,
  database,
  view,
  group,
  lifted,
}: {
  row: Row;
  database: Database;
  view: View;
  group: Property;
  lifted?: boolean;
}) {
  const tApp = useTranslations("App");
  const locale = useLocale();
  const fields = database.properties.filter(
    (p) => p.id !== group.id && !view.hidden.includes(p.id),
  );
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-md border bg-background px-2.5 py-2 text-sm shadow-xs",
        lifted && "rotate-1 shadow-lg",
      )}
    >
      <bdi
        className={cn(
          "pe-6 font-medium break-words",
          !row.title && "text-muted-foreground",
        )}
      >
        {row.title || tApp("untitled")}
      </bdi>
      {fields.map((p) => {
        const v = valueOf(row, p);
        if (p.type === "checkbox" ? v !== true : isEmpty(v)) return null;
        if (p.type === "select" || p.type === "multiSelect") {
          const ids = Array.isArray(v) ? v : [String(v)];
          const opts = ids
            .map((id) => p.options.find((o) => o.id === id))
            .filter((o) => o !== undefined);
          return (
            <div key={p.id} className="flex flex-wrap gap-1">
              {opts.map((o) => (
                <OptionBadge key={o.id} option={o} />
              ))}
            </div>
          );
        }
        return (
          <bdi key={p.id} className="truncate text-xs text-muted-foreground">
            {p.type === "checkbox"
              ? `✓ ${p.name}`
              : p.type === "number"
                ? `${p.name}: ${new Intl.NumberFormat(locale).format(v as number)}`
                : p.type === "date"
                  ? new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                    }).format(new Date(`${v}T00:00:00`))
                  : displayText(p, v)}
          </bdi>
        );
      })}
    </div>
  );
}

function GroupMenu({
  databaseId,
  database,
  group,
  option,
}: {
  databaseId: string;
  database: Database;
  group: Property;
  option: SelectOption;
}) {
  const t = useTranslations("Database");
  const [name, setName] = useState(option.name);
  const save = (db: Database) => void saveDatabase(databaseId, db);

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) setName(option.name);
        else if (name.trim() && name.trim() !== option.name)
          save(
            updateOption(database, group.id, option.id, { name: name.trim() }),
          );
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          className="ms-auto"
          aria-label={t("groupMenu")}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="p-1">
          <Input
            value={name}
            dir="auto"
            aria-label={t("groupName")}
            className="h-8"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
        <DropdownMenuRadioGroup
          value={option.color}
          onValueChange={(color) =>
            save(
              updateOption(database, group.id, option.id, {
                color: color as OptionColor,
              }),
            )
          }
        >
          {OPTION_COLORS.map((c) => (
            <DropdownMenuRadioItem key={c} value={c}>
              <span
                className={cn("size-3.5 rounded-sm", OPTION_CLASSES[c])}
                aria-hidden
              />
              {t(`color.${c}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => save(removeOption(database, group.id, option.id))}
        >
          <Trash2 />
          {t("deleteGroup")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AddGroup({
  databaseId,
  database,
  group,
}: {
  databaseId: string;
  database: Database;
  group: Property;
}) {
  const t = useTranslations("Database");
  const [name, setName] = useState("");
  return (
    <form
      className="flex w-56 shrink-0 items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        const n = name.trim();
        if (!n) return;
        void saveDatabase(databaseId, addOption(database, group.id, n).db);
        setName("");
      }}
    >
      <Input
        value={name}
        dir="auto"
        placeholder={t("newGroup")}
        aria-label={t("newGroup")}
        className="h-8"
        onChange={(e) => setName(e.target.value)}
      />
      <Button
        type="submit"
        variant="ghost"
        size="icon-sm"
        aria-label={t("addGroup")}
      >
        <Plus />
      </Button>
    </form>
  );
}
