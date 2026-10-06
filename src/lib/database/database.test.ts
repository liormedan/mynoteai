import { describe, expect, it } from "vitest";
import { dropPosition } from "./board";
import type { Database, Property } from "./types";
import {
  coerce,
  collator,
  filterRows,
  groupRows,
  matchesFilter,
  parseDatabase,
  parseProps,
  sortRows,
  valuesFromFilters,
  type Row,
} from "./values";

const status: Property = {
  id: "status",
  name: "סטטוס",
  type: "select",
  options: [
    { id: "todo", name: "לביצוע", color: "gray" },
    { id: "doing", name: "בתהליך", color: "blue" },
    { id: "done", name: "בוצע", color: "green" },
  ],
};
const estimate: Property = {
  id: "est",
  name: "הערכה",
  type: "number",
  options: [],
};
const due: Property = { id: "due", name: "תאריך", type: "date", options: [] };
const tags: Property = {
  id: "tags",
  name: "תגיות",
  type: "multiSelect",
  options: [
    { id: "home", name: "בית", color: "orange" },
    { id: "work", name: "עבודה", color: "purple" },
  ],
};
const urgent: Property = {
  id: "urgent",
  name: "דחוף",
  type: "checkbox",
  options: [],
};

const db: Database = {
  properties: [status, estimate, due, tags, urgent],
  views: [],
};

const row = (
  id: string,
  title: string,
  position: number,
  props: Row["props"] = {},
): Row => ({
  id,
  title,
  position,
  props,
});

const rows = [
  row("a", "לקנות חלב", 1, {
    status: "todo",
    est: 1,
    due: "2026-10-08",
    tags: ["home"],
  }),
  row("b", "דוח רבעוני", 2, {
    status: "doing",
    est: 5,
    due: "2026-10-07",
    tags: ["work"],
    urgent: true,
  }),
  row("c", "Book flights", 3, {
    status: "done",
    est: 2,
    tags: ["home", "work"],
  }),
  row("d", "ללא סטטוס", 4, {}),
];
const ids = (rs: Row[]) => rs.map((r) => r.id);
const he = collator("he");

describe("parsing Firestore data", () => {
  it("keeps valid parts and drops the rest", () => {
    const parsed = parseDatabase({
      properties: [
        {
          id: "x",
          name: "X",
          type: "nope",
          options: [{ id: "o", name: "O", color: "teal" }],
        },
        { id: "title", name: "reserved" },
        "junk",
      ],
      views: [
        {
          id: "v",
          name: "V",
          type: "board",
          sorts: [{ prop: "x" }],
          filters: [{ prop: "x", op: "bad" }],
          hidden: [1, "x"],
        },
      ],
    });
    expect(parsed).toEqual({
      properties: [
        {
          id: "x",
          name: "X",
          type: "text",
          options: [{ id: "o", name: "O", color: "gray" }],
        },
      ],
      views: [
        {
          id: "v",
          name: "V",
          type: "board",
          sorts: [{ prop: "x", desc: false }],
          filters: [],
          hidden: ["x"],
          groupBy: null,
        },
      ],
    });
    expect(parseDatabase("nope")).toBeNull();
    expect(parseProps({ a: 1, b: ["x", 2], c: { d: 1 } })).toEqual({
      a: 1,
      b: ["x"],
    });
  });
});

describe("values across type changes", () => {
  it("reads a stored value as the property's current type", () => {
    expect(coerce("number", "42")).toBe(42);
    expect(coerce("number", "abc")).toBeNull();
    expect(coerce("text", 42)).toBe("42");
    expect(coerce("multiSelect", "todo")).toEqual(["todo"]);
    expect(coerce("select", ["a", "b"])).toBe("a");
    expect(coerce("date", "8.10.2026")).toBeNull();
    expect(coerce("checkbox", undefined)).toBe(false);
  });
});

describe("sorting", () => {
  it("sorts by option order, numbers and dates, empty values last", () => {
    expect(
      ids(sortRows(rows, db, [{ prop: "status", desc: false }], he)),
    ).toEqual(["a", "b", "c", "d"]);
    expect(
      ids(sortRows(rows, db, [{ prop: "status", desc: true }], he)),
    ).toEqual(["c", "b", "a", "d"]);
    expect(ids(sortRows(rows, db, [{ prop: "est", desc: true }], he))).toEqual([
      "b",
      "c",
      "a",
      "d",
    ]);
    expect(ids(sortRows(rows, db, [{ prop: "due", desc: false }], he))).toEqual(
      ["b", "a", "c", "d"],
    );
  });

  it("sorts titles with Hebrew collation (Hebrew first) and falls back to position", () => {
    expect(
      ids(sortRows(rows, db, [{ prop: "title", desc: false }], he)),
    ).toEqual(["b", "d", "a", "c"]);
    expect(ids(sortRows(rows, db, [], he))).toEqual(["a", "b", "c", "d"]);
  });
});

describe("filtering", () => {
  it("filters each type", () => {
    expect(
      ids(filterRows(rows, db, [{ prop: "status", op: "is", value: "todo" }])),
    ).toEqual(["a"]);
    expect(
      ids(
        filterRows(rows, db, [{ prop: "status", op: "isEmpty", value: null }]),
      ),
    ).toEqual(["d"]);
    expect(
      ids(filterRows(rows, db, [{ prop: "est", op: "gt", value: "1" }])),
    ).toEqual(["b", "c"]);
    expect(
      ids(
        filterRows(rows, db, [{ prop: "tags", op: "contains", value: "work" }]),
      ),
    ).toEqual(["b", "c"]);
    expect(
      ids(
        filterRows(rows, db, [
          { prop: "due", op: "before", value: "2026-10-08" },
        ]),
      ),
    ).toEqual(["b"]);
    expect(
      ids(
        filterRows(rows, db, [{ prop: "urgent", op: "checked", value: null }]),
      ),
    ).toEqual(["b"]);
    expect(
      ids(
        filterRows(rows, db, [
          { prop: "title", op: "contains", value: "BOOK" },
        ]),
      ),
    ).toEqual(["c"]);
  });

  it("combines filters and ignores ones without a value yet", () => {
    expect(
      ids(
        filterRows(rows, db, [
          { prop: "tags", op: "contains", value: "home" },
          { prop: "status", op: "isNot", value: "done" },
          { prop: "title", op: "contains", value: "" },
        ]),
      ),
    ).toEqual(["a"]);
    expect(
      matchesFilter(estimate, null, { prop: "est", op: "is", value: "3" }),
    ).toBe(false);
  });
});

describe("board", () => {
  it("groups rows by option, with a column for no value", () => {
    const groups = groupRows(rows, status);
    expect([...groups.keys()]).toEqual([null, "todo", "doing", "done"]);
    expect(ids(groups.get(null)!)).toEqual(["d"]);
    expect(ids(groups.get("doing")!)).toEqual(["b"]);
  });

  it("puts a value whose option was deleted under no value", () => {
    const groups = groupRows([row("x", "x", 1, { status: "gone" })], status);
    expect(ids(groups.get(null)!)).toEqual(["x"]);
  });
});

describe("new rows under filters", () => {
  it("start with the values the filters ask for", () => {
    expect(
      valuesFromFilters(db, [
        { prop: "status", op: "is", value: "done" },
        { prop: "tags", op: "contains", value: "work" },
        { prop: "urgent", op: "checked", value: null },
        { prop: "est", op: "gt", value: "3" },
      ]),
    ).toEqual({ status: "done", tags: ["work"], urgent: true });
  });
});

describe("board drops", () => {
  const col = [row("a", "a", 1), row("b", "b", 2), row("c", "c", 3)];
  it("lands between neighbours, at either end, or at the column's end", () => {
    expect(dropPosition(col, "x", { id: "b", after: false })).toBe(1.5);
    expect(dropPosition(col, "x", { id: "b", after: true })).toBe(2.5);
    expect(dropPosition(col, "x", { id: "a", after: false })).toBe(0);
    expect(dropPosition(col, "x", null)).toBe(4);
    expect(dropPosition([], "x", null)).toBe(1);
  });
  it("ignores the moving card's own place", () => {
    expect(dropPosition(col, "b", { id: "c", after: false })).toBe(2);
  });
});
