"use client";

import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  EyeOff,
  Filter as FilterIcon,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  PROPERTY_TYPES,
  TITLE,
  type Property,
  type PropertyType,
} from "@/lib/database/types";
import { operatorsFor } from "@/lib/database/values";
import { useDatabaseLabels } from "./labels";
import { PropertyIcon } from "./property-icon";
import type { ViewEdits } from "./view-edits";

/** A column header: the property's name, and a menu of what to do with it. */
export function PropertyHeader({
  prop,
  label,
  edits,
}: {
  prop: Property;
  /** Shown name (the title column has none of its own). */
  label: string;
  edits: ViewEdits;
}) {
  const t = useTranslations("Database");
  const labels = useDatabaseLabels();
  const isTitle = prop.id === TITLE;
  const [name, setName] = useState(prop.name);
  const [open, setOpen] = useState(false);

  const rename = () => {
    const next = name.trim();
    if (next && next !== prop.name)
      edits.updateProperty(prop.id, { name: next });
  };

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(o) => {
        if (o) setName(prop.name);
        else rename();
        setOpen(o);
      }}
    >
      <DropdownMenuTrigger className="flex h-8 w-full min-w-0 items-center gap-1.5 rounded-sm px-2 text-start text-xs font-medium text-muted-foreground outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50">
        <PropertyIcon type={isTitle ? "text" : prop.type} />
        <bdi className="truncate">{label}</bdi>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {!isTitle && (
          <>
            <div className="p-1">
              <Input
                value={name}
                aria-label={t("propertyName")}
                dir="auto"
                className="h-8"
                onChange={(e) => setName(e.target.value)}
                // Keep typing out of the menu's type-ahead.
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") setOpen(false);
                }}
              />
            </div>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <PropertyIcon type={prop.type} className="size-4" />
                {labels.type(prop.type)}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={prop.type}
                  onValueChange={(type) =>
                    edits.updateProperty(prop.id, {
                      type: type as PropertyType,
                    })
                  }
                >
                  {PROPERTY_TYPES.map((type) => (
                    <DropdownMenuRadioItem key={type} value={type}>
                      <PropertyIcon type={type} className="size-4" />
                      {labels.type(type)}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onSelect={() => edits.sortBy(prop.id, false)}>
          <ArrowUpNarrowWide />
          {t("sortAsc")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => edits.sortBy(prop.id, true)}>
          <ArrowDownWideNarrow />
          {t("sortDesc")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => edits.addFilter(prop.id, operatorsFor(prop.type)[0])}
        >
          <FilterIcon />
          {t("filterBy")}
        </DropdownMenuItem>
        {!isTitle && (
          <>
            <DropdownMenuItem onSelect={() => edits.toggleHidden(prop.id)}>
              <EyeOff />
              {t("hide")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => edits.removeProperty(prop.id)}
            >
              <Trash2 />
              {t("deleteProperty")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
