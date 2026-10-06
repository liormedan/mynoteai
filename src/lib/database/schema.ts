import {
  MAX_OPTIONS,
  MAX_PROPERTIES,
  MAX_VIEWS,
  OPTION_COLORS,
  type Database,
  type OptionColor,
  type Property,
  type PropertyType,
  type View,
  type ViewType,
} from "./types";

/*
 * Pure edits of a database definition. Each returns a new Database; the
 * caller writes it to the page in one update.
 */

/** Ids double as Firestore field names (props.<id>), so letters and digits only. */
export function newId(prefix = "p") {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return (
    prefix + [...bytes].map((b) => b.toString(36).padStart(2, "0")).join("")
  );
}

export type DefaultLabels = {
  status: string;
  todo: string;
  doing: string;
  done: string;
  table: string;
  board: string;
};

/** A new database: a Status select (to do, doing, done), a table and a board. */
export function defaultDatabase(l: DefaultLabels): Database {
  const status: Property = {
    id: newId(),
    name: l.status,
    type: "select",
    options: [
      { id: newId("o"), name: l.todo, color: "gray" },
      { id: newId("o"), name: l.doing, color: "blue" },
      { id: newId("o"), name: l.done, color: "green" },
    ],
  };
  return {
    properties: [status],
    views: [
      emptyView("table", l.table, null),
      emptyView("board", l.board, status.id),
    ],
  };
}

function emptyView(type: ViewType, name: string, groupBy: string | null): View {
  return {
    id: newId("v"),
    name,
    type,
    sorts: [],
    filters: [],
    hidden: [],
    groupBy,
  };
}

/* ---------- properties ---------- */

export function addProperty(db: Database, name: string, type: PropertyType) {
  if (db.properties.length >= MAX_PROPERTIES) return { db, id: null };
  const prop: Property = { id: newId(), name, type, options: [] };
  return { db: { ...db, properties: [...db.properties, prop] }, id: prop.id };
}

export function updateProperty(
  db: Database,
  id: string,
  patch: Partial<Pick<Property, "name" | "type">>,
): Database {
  return {
    ...db,
    properties: db.properties.map((p) =>
      p.id === id ? { ...p, ...patch } : p,
    ),
    // Board grouping needs a select property.
    views:
      patch.type && patch.type !== "select"
        ? db.views.map((v) => (v.groupBy === id ? { ...v, groupBy: null } : v))
        : db.views,
  };
}

/** Removes the property and everything in the views that refers to it. */
export function removeProperty(db: Database, id: string): Database {
  return {
    properties: db.properties.filter((p) => p.id !== id),
    views: db.views.map((v) => ({
      ...v,
      sorts: v.sorts.filter((s) => s.prop !== id),
      filters: v.filters.filter((f) => f.prop !== id),
      hidden: v.hidden.filter((h) => h !== id),
      groupBy: v.groupBy === id ? null : v.groupBy,
    })),
  };
}

export function moveProperty(
  db: Database,
  id: string,
  toIndex: number,
): Database {
  const props = db.properties.filter((p) => p.id !== id);
  const prop = db.properties.find((p) => p.id === id);
  if (!prop) return db;
  props.splice(Math.max(0, Math.min(toIndex, props.length)), 0, prop);
  return { ...db, properties: props };
}

/* ---------- options ---------- */

export function addOption(db: Database, propId: string, name: string) {
  const prop = db.properties.find((p) => p.id === propId);
  if (!prop || prop.options.length >= MAX_OPTIONS) return { db, id: null };
  const existing = prop.options.find((o) => o.name === name);
  if (existing) return { db, id: existing.id };
  const color = OPTION_COLORS[prop.options.length % OPTION_COLORS.length];
  const option = { id: newId("o"), name, color };
  return {
    db: {
      ...db,
      properties: db.properties.map((p) =>
        p.id === propId ? { ...p, options: [...p.options, option] } : p,
      ),
    },
    id: option.id,
  };
}

export function updateOption(
  db: Database,
  propId: string,
  optionId: string,
  patch: { name?: string; color?: OptionColor },
): Database {
  return {
    ...db,
    properties: db.properties.map((p) =>
      p.id === propId
        ? {
            ...p,
            options: p.options.map((o) =>
              o.id === optionId ? { ...o, ...patch } : o,
            ),
          }
        : p,
    ),
  };
}

/** Rows that still hold the option show it as empty (see groupRows). */
export function removeOption(
  db: Database,
  propId: string,
  optionId: string,
): Database {
  return {
    properties: db.properties.map((p) =>
      p.id === propId
        ? { ...p, options: p.options.filter((o) => o.id !== optionId) }
        : p,
    ),
    views: db.views.map((v) => ({
      ...v,
      filters: v.filters.filter(
        (f) => !(f.prop === propId && f.value === optionId),
      ),
    })),
  };
}

export function moveOption(
  db: Database,
  propId: string,
  optionId: string,
  toIndex: number,
) {
  return {
    ...db,
    properties: db.properties.map((p) => {
      if (p.id !== propId) return p;
      const option = p.options.find((o) => o.id === optionId);
      if (!option) return p;
      const rest = p.options.filter((o) => o.id !== optionId);
      rest.splice(Math.max(0, Math.min(toIndex, rest.length)), 0, option);
      return { ...p, options: rest };
    }),
  };
}

/* ---------- views ---------- */

export function addView(db: Database, type: ViewType, name: string) {
  if (db.views.length >= MAX_VIEWS) return { db, id: null };
  const groupBy =
    type === "board"
      ? (db.properties.find((p) => p.type === "select")?.id ?? null)
      : null;
  const view = emptyView(type, name, groupBy);
  return { db: { ...db, views: [...db.views, view] }, id: view.id };
}

export function duplicateView(db: Database, id: string, suffix: string) {
  const source = db.views.find((v) => v.id === id);
  if (!source || db.views.length >= MAX_VIEWS) return { db, id: null };
  const copy = { ...source, id: newId("v"), name: source.name + suffix };
  const i = db.views.indexOf(source);
  const views = [...db.views];
  views.splice(i + 1, 0, copy);
  return { db: { ...db, views }, id: copy.id };
}

export function updateView(
  db: Database,
  id: string,
  patch: Partial<Omit<View, "id">>,
): Database {
  return {
    ...db,
    views: db.views.map((v) => (v.id === id ? { ...v, ...patch } : v)),
  };
}

/** The last view stays: a database always has one. */
export function removeView(db: Database, id: string): Database {
  if (db.views.length <= 1) return db;
  return { ...db, views: db.views.filter((v) => v.id !== id) };
}
