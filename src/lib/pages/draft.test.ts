import { describe, expect, it } from "vitest";
import { clearDraft, pickNewer, readDraft, writeDraft } from "./draft";

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    size: () => m.size,
  };
}

describe("drafts", () => {
  it("round-trips a draft per page", () => {
    const s = memoryStorage();
    writeDraft("p1", ["שלום"], 100, s);
    expect(readDraft("p1", s)).toEqual({ value: ["שלום"], at: 100 });
    expect(readDraft("p2", s)).toBeNull();
  });

  it("clears only drafts that are not newer than the save", () => {
    const s = memoryStorage();
    writeDraft("p1", "v2", 200, s);
    clearDraft("p1", 150, s); // an older save finished: keep v2
    expect(readDraft("p1", s)?.value).toBe("v2");
    clearDraft("p1", 200, s);
    expect(readDraft("p1", s)).toBeNull();
  });

  it("ignores corrupt entries", () => {
    const s = memoryStorage();
    s.setItem("mynoteai:draft:p1", "{not json");
    expect(readDraft("p1", s)).toBeNull();
  });

  it("prefers the draft only when it is newer than the server copy", () => {
    const server = { value: "server", updatedAt: new Date(1_000) };
    expect(pickNewer(server, { value: "draft", at: 2_000 })).toEqual({
      value: "draft",
      fromDraft: true,
    });
    expect(pickNewer(server, { value: "draft", at: 500 })).toEqual({
      value: "server",
      fromDraft: false,
    });
    expect(pickNewer(server, null).fromDraft).toBe(false);
  });
});
