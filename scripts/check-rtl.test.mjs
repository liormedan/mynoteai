import { describe, expect, it } from "vitest";
import { findPhysicalClasses } from "./check-rtl.mjs";

const classes = (src) => findPhysicalClasses(src).map((h) => h.cls);

describe("findPhysicalClasses", () => {
  it("flags physical margin, padding, position and alignment", () => {
    expect(classes(`<div className="ml-4 pr-2 left-0 text-right" />`)).toEqual([
      "ml",
      "pr",
      "left",
      "text-right",
    ]);
  });

  it("flags classes behind variants and negative values", () => {
    expect(classes(`cn("md:ml-2", "-mr-1", "hover:rounded-tl-lg")`)).toEqual([
      "ml",
      "mr",
      "rounded-tl",
    ]);
  });

  it("allows logical classes", () => {
    expect(
      classes(
        `<div className="ms-4 pe-2 start-0 text-start rounded-s-md border-e" />`,
      ),
    ).toEqual([]);
  });

  it("ignores words that only contain the prefixes", () => {
    expect(
      classes(`const html = "simple"; prefix-left; leftover; item-left`),
    ).toEqual([]);
  });

  it("ignores bare direction words used as values", () => {
    expect(classes(`side = "right"; type Side = "left" | "right";`)).toEqual(
      [],
    );
    expect(classes(`className="border-l rounded-r text-left"`)).toEqual([
      "border-l",
      "rounded-r",
      "text-left",
    ]);
  });

  it("skips comment lines", () => {
    expect(
      classes(`// Code is always left-to-right\n * right-to-left`),
    ).toEqual([]);
  });

  it("respects the rtl-ok escape hatch", () => {
    expect(
      classes(`<div className="left-0" /> // rtl-ok: tooltip arrow`),
    ).toEqual([]);
  });
});
