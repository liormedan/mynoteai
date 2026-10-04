export const locales = ["en", "he"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const localeDirection: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  he: "rtl",
};

export function isLocale(value: unknown): value is Locale {
  return locales.includes(value as Locale);
}

/** Picks the best supported locale from an Accept-Language header. */
export function negotiateLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return defaultLocale;
  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { tag: tag.toLowerCase(), q: q ? Number(q.split("=")[1]) : 1 };
    })
    .filter((x) => x.tag && x.q > 0)
    .sort((a, b) => b.q - a.q);
  for (const { tag } of ranked) {
    // "iw" is the legacy code for Hebrew and still shows up in some browsers.
    const base = tag.split("-")[0] === "iw" ? "he" : tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return defaultLocale;
}
