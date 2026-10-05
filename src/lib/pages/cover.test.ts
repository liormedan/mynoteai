import { describe, expect, it } from "vitest";
import { gradientCover, GRADIENTS, isImageUrl, parseCover } from "./cover";

describe("parseCover", () => {
  it("reads built-in gradients", () => {
    expect(parseCover(gradientCover("sea"))).toEqual({
      kind: "gradient",
      name: "sea",
      css: GRADIENTS.sea,
    });
  });

  it("reads image URLs", () => {
    expect(parseCover("https://example.com/a.jpg")).toEqual({
      kind: "image",
      url: "https://example.com/a.jpg",
    });
  });

  it("rejects empty, unknown and unsafe values", () => {
    expect(parseCover(null)).toBeNull();
    expect(parseCover("")).toBeNull();
    expect(parseCover("gradient:rainbow")).toBeNull();
    expect(parseCover("javascript:alert(1)")).toBeNull();
    expect(parseCover("not a url")).toBeNull();
  });
});

describe("isImageUrl", () => {
  it("accepts http(s) only, up to 2048 characters", () => {
    expect(isImageUrl("http://x.y/z.png")).toBe(true);
    expect(isImageUrl("data:image/png;base64,AAAA")).toBe(false);
    expect(isImageUrl(`https://x.y/${"a".repeat(2048)}`)).toBe(false);
  });
});
