"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Property, PropValue } from "@/lib/database/types";
import { coerce, isEmpty } from "@/lib/database/values";
import { cn } from "@/lib/utils";
import { OptionBadge } from "./option-badge";
import { OptionPicker } from "./option-picker";

type Props = {
  prop: Property;
  /** The stored value (any type); shown as the property's current type. */
  raw: PropValue | undefined;
  onChange: (value: PropValue) => void;
  onCreateOption: (name: string) => string | null;
  /** Table cells are compact and fill the cell; the row panel is roomier. */
  variant: "cell" | "panel";
};

const box = (variant: Props["variant"]) =>
  cn(
    "flex min-h-8 w-full min-w-0 items-center gap-1 rounded-sm px-2 text-start text-sm outline-none",
    "hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50",
    variant === "panel" && "min-h-9",
  );

/** Shows a property value and edits it in place, by type. */
export function PropertyValue(props: Props) {
  const { prop } = props;
  switch (prop.type) {
    case "checkbox":
      return <CheckboxValue {...props} />;
    case "date":
      return <DateValue {...props} />;
    case "select":
    case "multiSelect":
      return <SelectValue {...props} />;
    default:
      return <TextValue {...props} />;
  }
}

function CheckboxValue({ prop, raw, onChange, variant }: Props) {
  const checked = coerce("checkbox", raw) === true;
  return (
    <label className={box(variant)}>
      <input
        type="checkbox"
        checked={checked}
        aria-label={prop.name}
        className="size-4 accent-foreground"
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function DateValue({ prop, raw, onChange, variant }: Props) {
  const value = coerce("date", raw);
  return (
    <input
      type="date"
      value={typeof value === "string" ? value : ""}
      aria-label={prop.name}
      className={cn(
        box(variant),
        "bg-transparent",
        !value && "text-muted-foreground",
      )}
      onChange={(e) => onChange(e.target.value || null)}
    />
  );
}

function TextValue({ prop, raw, onChange, variant }: Props) {
  const t = useTranslations("Database");
  const locale = useLocale();
  const value = coerce(prop.type, raw);
  const [editing, setEditing] = useState(false);
  // Escape unmounts the input, which may still fire blur: skip that save.
  const cancelled = useRef(false);
  const text = value === null ? "" : String(value);

  if (editing) {
    const commit = (input: string) => {
      setEditing(false);
      if (cancelled.current) return;
      const next =
        prop.type === "number"
          ? coerce("number", input)
          : input.trim() === ""
            ? null
            : input;
      if (next !== value) onChange(next);
    };
    return (
      <input
        autoFocus
        dir={prop.type === "text" ? "auto" : "ltr"}
        type={
          prop.type === "number"
            ? "number"
            : prop.type === "url"
              ? "url"
              : "text"
        }
        inputMode={prop.type === "number" ? "decimal" : undefined}
        defaultValue={text}
        aria-label={prop.name}
        className={cn(box(variant), "bg-background ring-2 ring-ring/50")}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            cancelled.current = true;
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <div className={cn(box(variant), "group/value")}>
      <button
        type="button"
        aria-label={`${prop.name}: ${text || t("empty")}`}
        className="flex min-h-[inherit] min-w-0 flex-1 items-center text-start outline-none"
        onClick={() => {
          cancelled.current = false;
          setEditing(true);
        }}
      >
        {isEmpty(value) ? (
          variant === "panel" && (
            <span className="text-muted-foreground">{t("empty")}</span>
          )
        ) : prop.type === "number" ? (
          <span dir="ltr" className="ms-auto tabular-nums">
            {new Intl.NumberFormat(locale).format(value as number)}
          </span>
        ) : prop.type === "url" ? (
          <bdi className="truncate text-blue-700 underline underline-offset-2 dark:text-blue-400">
            {text}
          </bdi>
        ) : (
          <bdi className="line-clamp-2 break-words">{text}</bdi>
        )}
      </button>
      {prop.type === "url" && /^https?:\/\//i.test(text) && (
        <a
          href={text}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded px-1 text-xs text-muted-foreground hover:bg-muted"
        >
          {t("openLink")}
        </a>
      )}
    </div>
  );
}

function SelectValue({ prop, raw, onChange, onCreateOption, variant }: Props) {
  const t = useTranslations("Database");
  const multiple = prop.type === "multiSelect";
  const value = coerce(prop.type, raw);
  const selected = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? [value]
      : [];
  const options = selected
    .map((id) => prop.options.find((o) => o.id === id))
    .filter((o) => o !== undefined);
  const [open, setOpen] = useState(false);

  const choose = (id: string) => {
    if (multiple) {
      onChange(
        selected.includes(id)
          ? selected.filter((s) => s !== id)
          : [...selected, id],
      );
    } else {
      onChange(selected[0] === id ? null : id);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={prop.name}
          className={cn(box(variant), "flex-wrap py-1")}
        >
          {options.length
            ? options.map((o) => <OptionBadge key={o.id} option={o} />)
            : variant === "panel" && (
                <span className="text-muted-foreground">{t("empty")}</span>
              )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        <OptionPicker
          prop={prop}
          selected={selected}
          multiple={multiple}
          onToggle={choose}
          onClear={() => {
            onChange(null);
            setOpen(false);
          }}
          onCreate={(name) => {
            const id = onCreateOption(name);
            if (id) choose(id);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
