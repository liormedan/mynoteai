import { describe, expect, it } from "vitest";
import { detectDirection } from "./direction";

describe("detectDirection", () => {
  it("detects Hebrew and Arabic as rtl", () => {
    expect(detectDirection("שלום עולם")).toBe("rtl");
    expect(detectDirection("مرحبا")).toBe("rtl");
  });

  it("detects Latin and other scripts as ltr", () => {
    expect(detectDirection("Hello")).toBe("ltr");
    expect(detectDirection("Привет")).toBe("ltr");
  });

  it("uses the first letter and skips digits and punctuation", () => {
    expect(detectDirection("1. (שלב) step")).toBe("rtl");
    expect(detectDirection("— Next.js עם pnpm")).toBe("ltr");
  });

  it("returns null when there are no letters", () => {
    expect(detectDirection("")).toBeNull();
    expect(detectDirection("/")).toBeNull();
    expect(detectDirection("123 - 456")).toBeNull();
  });
});
