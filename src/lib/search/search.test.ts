import { describe, expect, it } from "vitest";
import { SearchEngine } from "./engine";
import { indexTerms, normalize, snippet, stems, words } from "./hebrew";

describe("hebrew normalization", () => {
  it("drops niqqud, folds final letters and quotes inside words", () => {
    expect(normalize("שָׁלוֹם")).toBe("שלומ");
    expect(words('צה"ל ו־צה״ל')).toEqual(["צהל", "ו", "צהל"]);
    expect(normalize("Hello WORLD")).toBe("hello world");
  });

  it("peels up to three prefix letters, keeping at least two", () => {
    expect(stems("ולבית")).toEqual(["לבית", "בית", "ית"]);
    expect(stems("הים")).toEqual(["ים"]);
    expect(stems("בית")).toEqual(["ית"]);
    expect(stems("גינה")).toEqual([]);
    expect(stems("שלומ")).toEqual(["לומ", "ומ"]);
    expect(stems("dog")).toEqual([]);
  });

  it("indexes every word with its stems once", () => {
    expect(indexTerms("הבית בבית")).toEqual(["הבית", "בית", "ית", "בבית"]);
  });
});

describe("SearchEngine", () => {
  const engine = new SearchEngine();
  engine.set({ id: "home", title: "הבית שלנו", text: "גינה ומרפסת" });
  engine.set({ id: "sea", title: "חופשה", text: "ירדנו לים בבוקר" });
  engine.set({ id: "adv", title: "יתרונות", text: "רשימה" });
  engine.set({
    id: "en",
    title: "Meeting notes",
    text: "Budget for the house",
  });
  engine.set({ id: "peace", title: "ברכות", text: "שָׁלוֹם וּבְרָכָה" });
  const ids = (q: string) => engine.search(q).map((h) => h.id);

  it("finds a Hebrew word behind prefix letters, both ways", () => {
    expect(ids("בית")).toEqual(["home"]);
    expect(ids("בבית")).toEqual(["home"]);
    expect(ids("ולבית")).toEqual(["home"]);
    expect(ids("מרפסת")).toEqual(["home"]);
    expect(ids("הים")).toEqual(["sea"]);
  });

  it("does not let a two-letter stem prefix-match other words", () => {
    expect(ids("הבית")).not.toContain("adv");
  });

  it("matches words typed halfway, final letters and niqqud included", () => {
    expect(ids("שלו")).toEqual(["peace"]);
    expect(ids("שלום")).toEqual(["peace"]);
    expect(ids("meet")).toEqual(["en"]);
  });

  it("requires every query word and ranks titles first", () => {
    expect(ids("meeting budget")).toEqual(["en"]);
    expect(ids("meeting גינה")).toEqual([]);
    engine.set({ id: "garden", title: "גינה", text: "" });
    expect(ids("גינה")).toEqual(["garden", "home"]);
  });

  it("updates and removes documents", () => {
    engine.set({ id: "sea", title: "חופשה", text: "טיילנו בהרים" });
    expect(ids("הים")).toEqual([]);
    expect(ids("הרים")).toEqual(["sea"]);
    engine.remove("sea");
    expect(ids("הרים")).toEqual([]);
  });

  it("builds an index of 500 pages quickly", () => {
    const big = new SearchEngine();
    const text =
      "שלום עולם זהו עמוד לדוגמה עם טקסט עברי ומילים באנגלית like this ".repeat(
        40,
      );
    const t0 = performance.now();
    for (let i = 0; i < 500; i++)
      big.set({ id: `p${i}`, title: `עמוד ${i}`, text });
    expect(performance.now() - t0).toBeLessThan(1000);
    expect(big.search("לדוגמה").length).toBe(20);
  });
});

describe("snippet", () => {
  it("marks the match in the original text", () => {
    expect(snippet("ירדנו לים בבוקר", words("הים"))).toEqual({
      before: "ירדנו ל",
      match: "ים",
      after: " בבוקר",
    });
    expect(snippet("A long text about Budget", words("budget"), 5)).toEqual({
      before: "…",
      match: "Budget",
      after: "",
    });
  });
});
