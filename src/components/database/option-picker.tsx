"use client";

import { Command as CommandPrimitive } from "cmdk";
import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { Property } from "@/lib/database/types";
import { OptionBadge } from "./option-badge";

/**
 * The list inside a select / multi-select popover: pick, unpick, or type a
 * new name and press Enter to create the option.
 */
export function OptionPicker({
  prop,
  selected,
  multiple,
  onToggle,
  onClear,
  onCreate,
}: {
  prop: Property;
  selected: string[];
  multiple: boolean;
  onToggle: (optionId: string) => void;
  onClear: () => void;
  onCreate: (name: string) => void;
}) {
  const t = useTranslations("Database");
  const [query, setQuery] = useState("");
  const q = query.trim();
  const shown = prop.options.filter((o) =>
    o.name.toLocaleLowerCase().includes(q.toLocaleLowerCase()),
  );
  const exact = prop.options.some((o) => o.name === q);

  return (
    <CommandPrimitive shouldFilter={false} loop className="flex flex-col">
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={t("optionSearch")}
        dir={query ? "auto" : undefined}
      />
      <CommandList className="max-h-64">
        <CommandGroup>
          {shown.map((o) => (
            <CommandItem
              key={o.id}
              value={o.id}
              // The item's own check mark shows the chosen options.
              data-checked={selected.includes(o.id)}
              onSelect={() => {
                onToggle(o.id);
                setQuery("");
              }}
            >
              <OptionBadge option={o} />
            </CommandItem>
          ))}
          {q && !exact && (
            <CommandItem
              value="create"
              onSelect={() => {
                onCreate(q);
                setQuery("");
              }}
            >
              <Plus />
              <bdi className="truncate">{t("createOption", { name: q })}</bdi>
            </CommandItem>
          )}
          {!multiple && selected.length > 0 && !q && (
            <CommandItem value="clear" onSelect={onClear}>
              <X />
              {t("clear")}
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
    </CommandPrimitive>
  );
}
