/*
 * A page cover is stored in `coverUrl` as either a built-in gradient
 * ("gradient:<name>") or an http(s) image URL. Gradients need no storage and
 * work on every install.
 */

export const GRADIENTS = {
  dawn: "linear-gradient(120deg, #fbc2eb 0%, #a6c1ee 100%)",
  sea: "linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)",
  sunset: "linear-gradient(120deg, #f6d365 0%, #fda085 100%)",
  dusk: "linear-gradient(120deg, #a18cd1 0%, #fbc2eb 100%)",
  forest: "linear-gradient(120deg, #0ba360 0%, #3cba92 100%)",
  night: "linear-gradient(120deg, #30cfd0 0%, #330867 100%)",
  sand: "linear-gradient(120deg, #e6dada 0%, #274046 100%)",
  ink: "linear-gradient(120deg, #434343 0%, #000000 100%)",
} as const;

export type GradientName = keyof typeof GRADIENTS;

export type Cover =
  | { kind: "gradient"; name: GradientName; css: string }
  | { kind: "image"; url: string };

export const gradientCover = (name: GradientName) => `gradient:${name}`;

/** Parses a stored cover; unknown or unsafe values yield null. */
export function parseCover(value: string | null | undefined): Cover | null {
  if (!value) return null;
  if (value.startsWith("gradient:")) {
    const name = value.slice("gradient:".length);
    return name in GRADIENTS
      ? {
          kind: "gradient",
          name: name as GradientName,
          css: GRADIENTS[name as GradientName],
        }
      : null;
  }
  return isImageUrl(value) ? { kind: "image", url: value } : null;
}

export function isImageUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      value.length <= 2048
    );
  } catch {
    return false;
  }
}
