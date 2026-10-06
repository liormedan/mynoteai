/*
 * A database is a page of type "database". Its definition — properties and
 * saved views — lives on that page document (`database`); every row is an
 * ordinary page under it (parentId = the database) with its values in
 * `props`, keyed by property id. The row's title is the "title" column.
 */

export const PROPERTY_TYPES = [
  "text",
  "number",
  "select",
  "multiSelect",
  "date",
  "checkbox",
  "url",
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const OPTION_COLORS = [
  "gray",
  "brown",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "red",
] as const;
export type OptionColor = (typeof OPTION_COLORS)[number];

export type SelectOption = { id: string; name: string; color: OptionColor };

export type Property = {
  id: string;
  name: string;
  type: PropertyType;
  /** Choices of select and multiSelect properties. */
  options: SelectOption[];
};

/** The row title is a column too, with this id. */
export const TITLE = "title";

export type Sort = { prop: string; desc: boolean };

export const FILTER_OPS = [
  "contains",
  "notContains",
  "is",
  "isNot",
  "gt",
  "lt",
  "before",
  "after",
  "checked",
  "unchecked",
  "isEmpty",
  "isNotEmpty",
] as const;
export type FilterOp = (typeof FILTER_OPS)[number];

export type Filter = { prop: string; op: FilterOp; value: string | null };

export type ViewType = "table" | "board";

export type View = {
  id: string;
  name: string;
  type: ViewType;
  sorts: Sort[];
  filters: Filter[];
  /** Property ids hidden in this view. */
  hidden: string[];
  /** Board columns come from this select property. */
  groupBy: string | null;
};

export type Database = { properties: Property[]; views: View[] };

/** A stored value: text, url and date (YYYY-MM-DD) are strings, select is an option id. */
export type PropValue = string | number | boolean | string[] | null;
export type Props = Record<string, PropValue>;

export const MAX_PROPERTIES = 50;
export const MAX_VIEWS = 20;
export const MAX_OPTIONS = 100;
