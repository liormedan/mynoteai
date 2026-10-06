import { describe, expect, it } from "vitest";
import {
  addOption,
  addProperty,
  addView,
  defaultDatabase,
  newId,
  removeOption,
  removeProperty,
  removeView,
  updateProperty,
  updateView,
} from "./schema";

const labels = {
  status: "סטטוס",
  todo: "לביצוע",
  doing: "בתהליך",
  done: "בוצע",
  table: "טבלה",
  board: "לוח",
};

describe("database definition edits", () => {
  it("starts with a status select, a table and a board grouped by it", () => {
    const db = defaultDatabase(labels);
    const [status] = db.properties;
    expect(status.options.map((o) => o.name)).toEqual([
      "לביצוע",
      "בתהליך",
      "בוצע",
    ]);
    expect(db.views.map((v) => [v.type, v.groupBy])).toEqual([
      ["table", null],
      ["board", status.id],
    ]);
  });

  it("makes ids that are safe Firestore field names", () => {
    for (let i = 0; i < 50; i++) expect(newId()).toMatch(/^p[a-z0-9]{12}$/);
  });

  it("removing a property cleans the views that use it", () => {
    let db = defaultDatabase(labels);
    const status = db.properties[0].id;
    const board = db.views[1].id;
    db = updateView(db, board, {
      sorts: [{ prop: status, desc: false }],
      filters: [{ prop: status, op: "isEmpty", value: null }],
      hidden: [status],
    });
    db = removeProperty(db, status);
    expect(db.properties).toEqual([]);
    expect(db.views[1]).toMatchObject({
      sorts: [],
      filters: [],
      hidden: [],
      groupBy: null,
    });
  });

  it("a property that stops being a select stops grouping a board", () => {
    let db = defaultDatabase(labels);
    db = updateProperty(db, db.properties[0].id, { type: "text" });
    expect(db.views[1].groupBy).toBeNull();
  });

  it("adds options once by name, and removes them from filters", () => {
    let db = defaultDatabase(labels);
    const status = db.properties[0].id;
    const a = addOption(db, status, "חסום");
    const b = addOption(a.db, status, "חסום");
    expect(b.id).toBe(a.id);
    db = updateView(b.db, db.views[0].id, {
      filters: [{ prop: status, op: "is", value: a.id }],
    });
    db = removeOption(db, status, a.id!);
    expect(db.properties[0].options).toHaveLength(3);
    expect(db.views[0].filters).toEqual([]);
  });

  it("adds properties and views, and always keeps one view", () => {
    let db = defaultDatabase(labels);
    db = addProperty(db, "הערכה", "number").db;
    expect(db.properties.map((p) => p.type)).toEqual(["select", "number"]);
    const { db: withBoard } = addView(db, "board", "לוח 2");
    expect(withBoard.views[2].groupBy).toBe(db.properties[0].id);
    let one = removeView(db, db.views[0].id);
    one = removeView(one, one.views[0].id);
    expect(one.views).toHaveLength(1);
  });
});
