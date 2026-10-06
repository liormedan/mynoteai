"use client";

import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { ArrowUpRight, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { setRowValue } from "@/lib/database/actions";
import {
  TITLE,
  type Database,
  type Filter,
  type Property,
  type View,
} from "@/lib/database/types";
import {
  cellValue,
  collator,
  compareValues,
  isEmpty,
  matchesFilter,
  TITLE_PROPERTY,
  type Row,
} from "@/lib/database/values";
import { patchPage } from "@/lib/pages/actions";
import { cn } from "@/lib/utils";
import { PropertyHeader } from "./property-header";
import { PropertyValue } from "./property-value";
import type { ViewEdits } from "./view-edits";

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  columnFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  columnVisibilityFeature,
});

type Column = ColumnDef<typeof features, Row>;

const TITLE_WIDTH = 280;
const WIDTH = 180;

/**
 * The table view. TanStack Table does the sorting, filtering and hidden
 * columns, driven by the saved view (its state is controlled from it);
 * comparisons and filters are the same functions the board uses.
 */
export function TableView({
  database,
  view,
  rows,
  edits,
  createOption,
  onAddRow,
  editingTitle,
  onEditingTitle,
}: {
  database: Database;
  view: View;
  rows: Row[];
  edits: ViewEdits;
  createOption: (propId: string, name: string) => string | null;
  onAddRow: () => void;
  /** A just-added row whose title opens for typing. */
  editingTitle: string | null;
  onEditingTitle: (id: string | null) => void;
}) {
  const t = useTranslations("Database");
  const tApp = useTranslations("App");
  const locale = useLocale();

  const columns = useMemo<Column[]>(() => {
    const coll = collator(locale);
    const column = (prop: Property): Column => ({
      id: prop.id,
      // Empty values are undefined, so sortUndefined keeps them last.
      accessorFn: (row) => {
        const v = cellValue(row, prop);
        return prop.type !== "checkbox" && isEmpty(v) ? undefined : v;
      },
      sortUndefined: "last",
      sortFn: (a, b, id) =>
        compareValues(prop, a.getValue(id), b.getValue(id), coll),
      filterFn: Object.assign(
        (row: { original: Row }, _id: string, filter: Filter) =>
          matchesFilter(prop, cellValue(row.original, prop), filter),
        // Keep unfinished filters in state; they match everything.
        { autoRemove: () => false },
      ),
    });
    return [column(TITLE_PROPERTY), ...database.properties.map(column)];
  }, [database.properties, locale]);

  const table = useTable({
    features,
    columns,
    data: rows,
    getRowId: (row) => row.id,
    state: {
      sorting: view.sorts.map((s) => ({ id: s.prop, desc: s.desc })),
      columnFilters: view.filters.map((f) => ({ id: f.prop, value: f })),
      columnVisibility: Object.fromEntries(view.hidden.map((h) => [h, false])),
    },
  });

  const props = new Map(database.properties.map((p) => [p.id, p]));
  const visible = table.getVisibleLeafColumns();

  return (
    <div className="overflow-x-auto">
      <table className="min-w-max border-collapse text-sm">
        <colgroup>
          {visible.map((c) => (
            <col
              key={c.id}
              style={{ width: c.id === TITLE ? TITLE_WIDTH : WIDTH }}
            />
          ))}
          <col style={{ width: 40 }} />
        </colgroup>
        <thead>
          <tr className="border-y">
            {visible.map((c) => (
              <th
                key={c.id}
                scope="col"
                className="border-e p-0 font-normal last:border-e-0"
              >
                <PropertyHeader
                  prop={c.id === TITLE ? TITLE_PROPERTY : props.get(c.id)!}
                  label={
                    c.id === TITLE ? t("titleColumn") : props.get(c.id)!.name
                  }
                  edits={edits}
                />
              </th>
            ))}
            <th className="p-0">
              <AddPropertyButton edits={edits} />
            </th>
          </tr>
        </thead>
        <tbody>
          {table.getRowModel().rows.map((r) => (
            <tr key={r.id} className="group/row border-b hover:bg-muted/30">
              {r.getVisibleCells().map((cell) => {
                const row = r.original;
                if (cell.column.id === TITLE) {
                  return (
                    <td key={cell.id} className="border-e p-0 align-top">
                      <TitleCell
                        row={row}
                        untitled={tApp("untitled")}
                        openLabel={t("openRow")}
                        editing={editingTitle === row.id}
                        onEditing={(on) => onEditingTitle(on ? row.id : null)}
                      />
                    </td>
                  );
                }
                const prop = props.get(cell.column.id)!;
                return (
                  <td
                    key={cell.id}
                    className="border-e p-0 align-top last:border-e-0"
                  >
                    <PropertyValue
                      variant="cell"
                      prop={prop}
                      raw={row.props[prop.id]}
                      onChange={(v) => void setRowValue(row.id, prop.id, v)}
                      onCreateOption={(name) => createOption(prop.id, name)}
                    />
                  </td>
                );
              })}
              <td className="p-0 text-center align-top">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("deleteRow")}
                  className="opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
                  onClick={() =>
                    void patchPage(r.original.id, { isArchived: true })
                  }
                >
                  <Trash2 />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button
        variant="ghost"
        size="sm"
        className="mt-1 text-muted-foreground"
        onClick={onAddRow}
      >
        <Plus />
        {t("newRow")}
      </Button>
    </div>
  );
}

function TitleCell({
  row,
  untitled,
  openLabel,
  editing,
  onEditing,
}: {
  row: Row;
  untitled: string;
  openLabel: string;
  editing: boolean;
  onEditing: (on: boolean) => void;
}) {
  // Escape unmounts the input, which may still fire blur: skip that save.
  const cancelled = useRef(false);
  if (editing) {
    return (
      <input
        autoFocus
        dir="auto"
        defaultValue={row.title}
        onFocus={() => (cancelled.current = false)}
        aria-label={untitled}
        className="min-h-8 w-full bg-background px-2 text-sm font-medium ring-2 ring-ring/50 outline-none"
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
    <div className="group/title flex min-h-8 items-center gap-1 pe-1">
      <button
        type="button"
        className={cn(
          "flex min-h-8 min-w-0 flex-1 items-center rounded-sm px-2 text-start font-medium outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50",
          !row.title && "text-muted-foreground",
        )}
        onClick={() => onEditing(true)}
      >
        <bdi className="truncate">{row.title || untitled}</bdi>
      </button>
      <Link
        href={`/p/${row.id}`}
        className="flex shrink-0 items-center gap-0.5 rounded border bg-background px-1.5 py-0.5 text-xs text-muted-foreground opacity-0 group-hover/title:opacity-100 hover:bg-muted focus-visible:opacity-100 pointer-coarse:opacity-100"
      >
        <ArrowUpRight className="size-3 rtl:-scale-x-100" />
        {openLabel}
      </Link>
    </div>
  );
}

function AddPropertyButton({ edits }: { edits: ViewEdits }) {
  const t = useTranslations("Database");
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={t("addProperty")}
      onClick={() => edits.addProperty(t("newPropertyName"), "text")}
    >
      <Plus />
    </Button>
  );
}
