import {
  FILTER_OPS,
  OPTION_COLORS,
  PROPERTY_TYPES,
  TITLE,
  type Database,
  type Filter,
  type Property,
  type PropertyType,
  type Props,
  type PropValue,
  type SelectOption,
  type Sort,
  type View,
} from "./types";

export type Row = { id: string; title: string; position: number; props: Props };

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = "") =>
  typeof v === "string" ? v : fallback;
const arr = (v: unknown) => (Array.isArray(v) ? v : []);

/* ---------- reading Firestore data defensively ---------- */

function parseOption(v: unknown): SelectOption | null {
  if (!isObj(v) || typeof v.id !== "string") return null;
  return {
    id: v.id,
    name: str(v.name),
    color: OPTION_COLORS.includes(v.color as never)
      ? (v.color as SelectOption["color"])
      : "gray",
  };
}

function parseProperty(v: unknown): Property | null {
  if (!isObj(v) || typeof v.id !== "string" || v.id === TITLE) return null;
  const type = PROPERTY_TYPES.includes(v.type as never)
    ? (v.type as PropertyType)
    : "text";
  return {
    id: v.id,
    name: str(v.name),
    type,
    options: arr(v.options)
      .map(parseOption)
      .filter((o): o is SelectOption => o !== null),
  };
}

function parseView(v: unknown): View | null {
  if (!isObj(v) || typeof v.id !== "string") return null;
  return {
    id: v.id,
    name: str(v.name),
    type: v.type === "board" ? "board" : "table",
    sorts: arr(v.sorts)
      .filter(isObj)
      .filter((s) => typeof s.prop === "string")
      .map((s) => ({ prop: s.prop as string, desc: s.desc === true })),
    filters: arr(v.filters)
      .filter(isObj)
      .filter(
        (f) => typeof f.prop === "string" && FILTER_OPS.includes(f.op as never),
      )
      .map((f) => ({
        prop: f.prop as string,
        op: f.op as Filter["op"],
        value: typeof f.value === "string" ? f.value : null,
      })),
    hidden: arr(v.hidden).filter((h): h is string => typeof h === "string"),
    groupBy: typeof v.groupBy === "string" ? v.groupBy : null,
  };
}

export function parseDatabase(v: unknown): Database | null {
  if (!isObj(v)) return null;
  return {
    properties: arr(v.properties)
      .map(parseProperty)
      .filter((p): p is Property => p !== null),
    views: arr(v.views)
      .map(parseView)
      .filter((x): x is View => x !== null),
  };
}

export function parseProps(v: unknown): Props {
  if (!isObj(v)) return {};
  const out: Props = {};
  for (const [k, x] of Object.entries(v)) {
    if (
      x === null ||
      typeof x === "string" ||
      typeof x === "number" ||
      typeof x === "boolean"
    ) {
      out[k] = x;
    } else if (Array.isArray(x)) {
      out[k] = x.filter((s): s is string => typeof s === "string");
    }
  }
  return out;
}

/* ---------- values by property type ---------- */

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The stored value read as the property's current type. Values are kept as
 * written when a property changes type, so changing it back loses nothing.
 */
export function coerce(
  type: PropertyType,
  v: PropValue | undefined,
): PropValue {
  if (v === undefined || v === null) return type === "checkbox" ? false : null;
  switch (type) {
    case "text":
    case "url":
      return Array.isArray(v) ? v.join(", ") : String(v);
    case "number": {
      const n = typeof v === "number" ? v : Number(String(v).trim());
      return typeof v !== "boolean" && String(v).trim() !== "" && isFinite(n)
        ? n
        : null;
    }
    case "select":
      return Array.isArray(v)
        ? (v[0] ?? null)
        : typeof v === "string"
          ? v
          : null;
    case "multiSelect":
      return Array.isArray(v) ? v : typeof v === "string" && v ? [v] : [];
    case "date":
      return typeof v === "string" && DATE.test(v) ? v : null;
    case "checkbox":
      return v === true || v === "true";
  }
}

export function valueOf(row: Row, prop: Property): PropValue {
  return coerce(prop.type, row.props[prop.id]);
}

export function isEmpty(v: PropValue) {
  return (
    v === null ||
    v === "" ||
    v === false ||
    (Array.isArray(v) && v.length === 0)
  );
}

const optionName = (prop: Property, id: string) =>
  prop.options.find((o) => o.id === id)?.name ?? "";

/** Plain text of a value, as shown and as searched. */
export function displayText(prop: Property, v: PropValue): string {
  if (v === null) return "";
  if (prop.type === "select") return optionName(prop, String(v));
  if (prop.type === "multiSelect" && Array.isArray(v))
    return v.map((id) => optionName(prop, id)).join(", ");
  if (prop.type === "checkbox") return v ? "✓" : "";
  return String(v);
}

/* ---------- sorting ---------- */

export const collator = (locale: string) =>
  new Intl.Collator(locale, { numeric: true, sensitivity: "base" });

/** Ascending comparison of two non-empty values of the same property. */
export function compareValues(
  prop: Property,
  a: PropValue,
  b: PropValue,
  coll: Intl.Collator,
): number {
  switch (prop.type) {
    case "number":
      return (a as number) - (b as number);
    case "checkbox":
      return Number(a) - Number(b);
    case "select": {
      // In the order the options are listed, as on the board.
      const ia = prop.options.findIndex((o) => o.id === a);
      const ib = prop.options.findIndex((o) => o.id === b);
      return ia - ib;
    }
    default:
      return coll.compare(displayText(prop, a), displayText(prop, b));
  }
}

export const TITLE_PROPERTY: Property = {
  id: TITLE,
  name: "",
  type: "text",
  options: [],
};

export function propertyOf(db: Database, id: string): Property | undefined {
  return id === TITLE ? TITLE_PROPERTY : db.properties.find((p) => p.id === id);
}

export function cellValue(row: Row, prop: Property): PropValue {
  return prop.id === TITLE ? row.title : valueOf(row, prop);
}

/** Rows sorted by the view's sorts; empty values last, then by position. */
export function sortRows(
  rows: Row[],
  db: Database,
  sorts: Sort[],
  coll: Intl.Collator,
): Row[] {
  const keys = sorts
    .map((s) => ({ prop: propertyOf(db, s.prop), desc: s.desc }))
    .filter((k): k is { prop: Property; desc: boolean } => !!k.prop);
  return [...rows].sort((a, b) => {
    for (const { prop, desc } of keys) {
      const va = cellValue(a, prop);
      const vb = cellValue(b, prop);
      const ea = prop.type === "checkbox" ? false : isEmpty(va);
      const eb = prop.type === "checkbox" ? false : isEmpty(vb);
      if (ea || eb) {
        if (ea && eb) continue;
        return ea ? 1 : -1;
      }
      const c = compareValues(prop, va, vb, coll);
      if (c) return desc ? -c : c;
    }
    return a.position - b.position;
  });
}

/* ---------- filtering ---------- */

export function operatorsFor(type: PropertyType): Filter["op"][] {
  switch (type) {
    case "text":
    case "url":
      return [
        "contains",
        "notContains",
        "is",
        "isNot",
        "isEmpty",
        "isNotEmpty",
      ];
    case "number":
      return ["is", "isNot", "gt", "lt", "isEmpty", "isNotEmpty"];
    case "select":
      return ["is", "isNot", "isEmpty", "isNotEmpty"];
    case "multiSelect":
      return ["contains", "notContains", "isEmpty", "isNotEmpty"];
    case "date":
      return ["is", "before", "after", "isEmpty", "isNotEmpty"];
    case "checkbox":
      return ["checked", "unchecked"];
  }
}

/** Whether an operator needs a value to compare with. */
export const needsValue = (op: Filter["op"]) =>
  !["isEmpty", "isNotEmpty", "checked", "unchecked"].includes(op);

export function matchesFilter(prop: Property, v: PropValue, f: Filter) {
  if (f.op === "isEmpty") return isEmpty(v);
  if (f.op === "isNotEmpty") return !isEmpty(v);
  if (f.op === "checked") return v === true;
  if (f.op === "unchecked") return v !== true;
  // An unfinished filter (no value yet) does not hide anything.
  if (f.value === null || f.value === "") return true;
  const q = f.value;

  if (prop.type === "number") {
    const n = Number(q);
    if (v === null || !isFinite(n)) return f.op === "isNot";
    const x = v as number;
    return f.op === "is"
      ? x === n
      : f.op === "isNot"
        ? x !== n
        : f.op === "gt"
          ? x > n
          : x < n;
  }
  if (prop.type === "select") {
    return f.op === "is" ? v === q : v !== q;
  }
  if (prop.type === "multiSelect") {
    const has = Array.isArray(v) && v.includes(q);
    return f.op === "contains" ? has : !has;
  }
  if (prop.type === "date") {
    if (v === null) return false;
    const d = v as string;
    return f.op === "is" ? d === q : f.op === "before" ? d < q : d > q;
  }
  const text = displayText(prop, v).toLocaleLowerCase();
  const needle = q.toLocaleLowerCase();
  switch (f.op) {
    case "contains":
      return text.includes(needle);
    case "notContains":
      return !text.includes(needle);
    case "is":
      return text === needle;
    case "isNot":
      return text !== needle;
    default:
      return true;
  }
}

/** Rows that pass every filter of the view. */
export function filterRows(rows: Row[], db: Database, filters: Filter[]) {
  const active = filters
    .map((f) => ({ f, prop: propertyOf(db, f.prop) }))
    .filter((x): x is { f: Filter; prop: Property } => !!x.prop);
  return rows.filter((row) =>
    active.every(({ f, prop }) => matchesFilter(prop, cellValue(row, prop), f)),
  );
}

/* ---------- board ---------- */

/** Board columns: one per option, in order, plus "no value" first. */
export function groupRows(rows: Row[], prop: Property) {
  const groups = new Map<string | null, Row[]>([[null, []]]);
  for (const o of prop.options) groups.set(o.id, []);
  for (const row of rows) {
    const v = valueOf(row, prop);
    const key = typeof v === "string" && groups.has(v) ? v : null;
    groups.get(key)!.push(row);
  }
  return groups;
}
