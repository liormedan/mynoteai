import { describe, expect, it } from "vitest";
import { describeDatabase, propsFromInput, rowToRecord } from "./input";
import type { Database } from "./types";

const db: Database = {
  properties: [
    {
      id: "st",
      name: "Status",
      type: "select",
      options: [{ id: "o1", name: "To do", color: "gray" }],
    },
    { id: "tg", name: "תגיות", type: "multiSelect", options: [] },
    { id: "est", name: "Estimate", type: "number", options: [] },
    { id: "due", name: "Due", type: "date", options: [] },
    { id: "ok", name: "Done?", type: "checkbox", options: [] },
  ],
  views: [],
};

describe("values from an agent", () => {
  it("maps names to ids and adds missing options", () => {
    const r = propsFromInput(db, {
      status: "To do",
      תגיות: ["בית", "עבודה"],
      Estimate: "3",
      Due: "2026-10-09",
      "Done?": "true",
    });
    expect(r.errors).toEqual([]);
    expect(r.props.st).toBe("o1");
    const tags = r.db.properties[1].options.map((o) => o.name);
    expect(tags).toEqual(["בית", "עבודה"]);
    expect(r.props.tg).toEqual(r.db.properties[1].options.map((o) => o.id));
    expect(r.props).toMatchObject({ est: 3, due: "2026-10-09", ok: true });
  });

  it("reports unknown fields and bad values instead of guessing", () => {
    const r = propsFromInput(db, {
      Priority: "high",
      Estimate: "a lot",
      Due: "tomorrow",
    });
    expect(r.errors).toHaveLength(3);
    expect(r.props).toEqual({});
  });

  it("reads rows back by field name", () => {
    const { props, db: next } = propsFromInput(db, {
      Status: "Doing",
      תגיות: "בית",
    });
    expect(
      rowToRecord(next, { id: "r", title: "משימה", position: 1, props }),
    ).toEqual({
      title: "משימה",
      Status: "Doing",
      תגיות: ["בית"],
      Estimate: null,
      Due: null,
      "Done?": false,
    });
    expect(describeDatabase(next)[0]).toEqual({
      name: "Status",
      type: "select",
      options: ["To do", "Doing"],
    });
  });
});
