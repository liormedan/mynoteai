import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import he from "../../messages/he.json";
import { locales, negotiateLocale } from "./config";

function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe("messages", () => {
  const all = { en, he } satisfies Record<(typeof locales)[number], object>;

  it("has a message file for every locale", () => {
    expect(Object.keys(all).sort()).toEqual([...locales].sort());
  });

  it("has the same keys in every locale", () => {
    for (const locale of locales) {
      expect(keys(all[locale]).sort()).toEqual(keys(en).sort());
    }
  });

  it("has no empty strings", () => {
    for (const locale of locales) {
      const flat = keys(all[locale]).map((k) =>
        k
          .split(".")
          .reduce<unknown>(
            (o, p) => (o as Record<string, unknown>)[p],
            all[locale],
          ),
      );
      expect(flat.every((v) => typeof v === "string" && v.trim() !== "")).toBe(
        true,
      );
    }
  });
});

describe("negotiateLocale", () => {
  it("falls back to English", () => {
    expect(negotiateLocale(null)).toBe("en");
    expect(negotiateLocale("fr-FR,fr;q=0.9")).toBe("en");
  });

  it("picks Hebrew by quality order", () => {
    expect(negotiateLocale("he-IL,he;q=0.9,en;q=0.8")).toBe("he");
    expect(negotiateLocale("en;q=0.5,he;q=0.9")).toBe("he");
  });

  it("maps the legacy iw code to Hebrew", () => {
    expect(negotiateLocale("iw")).toBe("he");
  });
});
