"use client";

import {
  ArrowUpDown,
  Eye,
  EyeOff,
  Filter as FilterIcon,
  Plus,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  PROPERTY_TYPES,
  type Database,
  type Filter,
  type FilterOp,
  type Property,
  type PropertyType,
  type View,
} from "@/lib/database/types";
import {
  needsValue,
  operatorsFor,
  TITLE_PROPERTY,
} from "@/lib/database/values";
import { cn } from "@/lib/utils";
import { useDatabaseLabels } from "./labels";
import { PropertyIcon } from "./property-icon";
import type { ViewEdits } from "./view-edits";

const selectClass =
  "h-8 min-w-0 rounded-md border bg-background px-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

/** Sort, filter and field controls of a view, plus "New". */
export function ViewToolbar({
  database,
  view,
  edits,
  onAddRow,
}: {
  database: Database;
  view: View;
  edits: ViewEdits;
  onAddRow: () => void;
}) {
  const t = useTranslations("Database");
  const all: Property[] = [
    { ...TITLE_PROPERTY, name: t("titleColumn") },
    ...database.properties,
  ];

  return (
    <div className="flex flex-wrap items-center gap-1">
      <FilterControl all={all} view={view} edits={edits} />
      <SortControl all={all} view={view} edits={edits} />
      {view.type === "table" && (
        <FieldsControl database={database} view={view} edits={edits} />
      )}
      <Button size="sm" onClick={onAddRow}>
        <Plus />
        {t("new")}
      </Button>
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  count,
}: {
  icon: typeof FilterIcon;
  label: string;
  count?: number;
}) {
  return (
    <PopoverTrigger asChild>
      <Button
        variant="ghost"
        size="sm"
        className={cn(count ? "text-primary" : "text-muted-foreground")}
      >
        <Icon />
        {label}
        {count ? ` (${count})` : null}
      </Button>
    </PopoverTrigger>
  );
}

function SortControl({
  all,
  view,
  edits,
}: {
  all: Property[];
  view: View;
  edits: ViewEdits;
}) {
  const t = useTranslations("Database");
  const unused = all.filter((p) => !view.sorts.some((s) => s.prop === p.id));
  return (
    <Popover>
      <ToolbarButton
        icon={ArrowUpDown}
        label={t("sort")}
        count={view.sorts.length}
      />
      <PopoverContent align="end" className="w-80">
        {view.sorts.length === 0 && (
          <p className="text-muted-foreground">{t("noSorts")}</p>
        )}
        {view.sorts.map((s, i) => (
          <div key={s.prop} className="flex items-center gap-1.5">
            <select
              aria-label={t("sortProperty")}
              className={cn(selectClass, "flex-1")}
              value={s.prop}
              onChange={(e) =>
                edits.setSorts(
                  view.sorts.map((x, j) =>
                    j === i ? { ...x, prop: e.target.value } : x,
                  ),
                )
              }
            >
              {all
                .filter((p) => p.id === s.prop || unused.includes(p))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
            <select
              aria-label={t("sortDirection")}
              className={selectClass}
              value={s.desc ? "desc" : "asc"}
              onChange={(e) =>
                edits.setSorts(
                  view.sorts.map((x, j) =>
                    j === i ? { ...x, desc: e.target.value === "desc" } : x,
                  ),
                )
              }
            >
              <option value="asc">{t("ascending")}</option>
              <option value="desc">{t("descending")}</option>
            </select>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("remove")}
              onClick={() =>
                edits.setSorts(view.sorts.filter((_, j) => j !== i))
              }
            >
              <X />
            </Button>
          </div>
        ))}
        {unused.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() =>
              edits.setSorts([
                ...view.sorts,
                { prop: unused[0].id, desc: false },
              ])
            }
          >
            <Plus />
            {t("addSort")}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

function FilterControl({
  all,
  view,
  edits,
}: {
  all: Property[];
  view: View;
  edits: ViewEdits;
}) {
  const t = useTranslations("Database");
  const labels = useDatabaseLabels();
  const unused = all.filter((p) => !view.filters.some((f) => f.prop === p.id));
  const byId = new Map(all.map((p) => [p.id, p]));

  const replace = (i: number, f: Filter) =>
    edits.setFilters(view.filters.map((x, j) => (j === i ? f : x)));

  return (
    <Popover>
      <ToolbarButton
        icon={FilterIcon}
        label={t("filter")}
        count={view.filters.length}
      />
      <PopoverContent
        align="end"
        className="w-[22rem] max-w-[calc(100vw-2rem)]"
      >
        {view.filters.length === 0 && (
          <p className="text-muted-foreground">{t("noFilters")}</p>
        )}
        {view.filters.map((f, i) => {
          const prop = byId.get(f.prop);
          if (!prop) return null;
          return (
            <div key={f.prop} className="flex flex-wrap items-center gap-1.5">
              <select
                aria-label={t("filterProperty")}
                className={cn(selectClass, "max-w-[8rem]")}
                value={f.prop}
                onChange={(e) => {
                  const next = byId.get(e.target.value)!;
                  replace(i, {
                    prop: next.id,
                    op: operatorsFor(next.type)[0],
                    value: null,
                  });
                }}
              >
                {all
                  .filter((p) => p.id === f.prop || unused.includes(p))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
              <select
                aria-label={t("filterOperator")}
                className={selectClass}
                value={f.op}
                onChange={(e) =>
                  replace(i, { ...f, op: e.target.value as FilterOp })
                }
              >
                {operatorsFor(prop.type).map((op) => (
                  <option key={op} value={op}>
                    {labels.op(op)}
                  </option>
                ))}
              </select>
              {needsValue(f.op) && (
                <FilterValue
                  prop={prop}
                  value={f.value}
                  onChange={(value) => replace(i, { ...f, value })}
                />
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("remove")}
                className="ms-auto"
                onClick={() =>
                  edits.setFilters(view.filters.filter((_, j) => j !== i))
                }
              >
                <X />
              </Button>
            </div>
          );
        })}
        {unused.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() =>
              edits.addFilter(unused[0].id, operatorsFor(unused[0].type)[0])
            }
          >
            <Plus />
            {t("addFilter")}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

function FilterValue({
  prop,
  value,
  onChange,
}: {
  prop: Property;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const t = useTranslations("Database");
  if (prop.type === "select" || prop.type === "multiSelect") {
    return (
      <select
        aria-label={t("filterValue")}
        className={cn(selectClass, "max-w-[8rem]")}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">{t("choose")}</option>
        {prop.options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    );
  }
  // Text is saved as typed; the debounce is the Firestore round trip itself.
  return (
    <Input
      aria-label={t("filterValue")}
      type={
        prop.type === "date"
          ? "date"
          : prop.type === "number"
            ? "number"
            : "text"
      }
      dir={prop.type === "text" ? "auto" : "ltr"}
      className="h-8 w-28 flex-1"
      defaultValue={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
    />
  );
}

function FieldsControl({
  database,
  view,
  edits,
}: {
  database: Database;
  view: View;
  edits: ViewEdits;
}) {
  const t = useTranslations("Database");
  const labels = useDatabaseLabels();
  const [name, setName] = useState("");
  const [type, setType] = useState<PropertyType>("text");

  return (
    <Popover>
      <ToolbarButton icon={Eye} label={t("fields")} />
      <PopoverContent align="end" className="w-72">
        <ul className="flex flex-col">
          {database.properties.map((p) => {
            const hidden = view.hidden.includes(p.id);
            return (
              <li key={p.id} className="flex h-8 items-center gap-2">
                <PropertyIcon type={p.type} />
                <bdi
                  className={cn(
                    "flex-1 truncate",
                    hidden && "text-muted-foreground",
                  )}
                >
                  {p.name}
                </bdi>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={hidden ? t("show") : t("hide")}
                  aria-pressed={!hidden}
                  onClick={() => edits.toggleHidden(p.id)}
                >
                  {hidden ? <EyeOff /> : <Eye />}
                </Button>
              </li>
            );
          })}
        </ul>
        <form
          className="flex items-center gap-1.5 border-t pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            edits.addProperty(name.trim(), type);
            setName("");
          }}
        >
          <Input
            value={name}
            dir="auto"
            placeholder={t("newPropertyName")}
            aria-label={t("propertyName")}
            className="h-8 flex-1"
            onChange={(e) => setName(e.target.value)}
          />
          <select
            aria-label={t("propertyType")}
            className={selectClass}
            value={type}
            onChange={(e) => setType(e.target.value as PropertyType)}
          >
            {PROPERTY_TYPES.map((x) => (
              <option key={x} value={x}>
                {labels.type(x)}
              </option>
            ))}
          </select>
          <Button type="submit" size="icon-sm" aria-label={t("addProperty")}>
            <Plus />
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
