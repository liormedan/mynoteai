/*
 * Text normalization for search, built for Hebrew first:
 *
 * - Niqqud and cantillation marks are dropped, so "שָׁלוֹם" matches "שלום".
 * - Final letters become regular ones (ם→מ, ן→נ, ץ→צ, ף→פ, ך→כ), so a word
 *   typed halfway ("שלו") still prefix-matches "שלום".
 * - Geresh and gershayim inside a word are dropped, so "צה״ל" matches "צהל".
 * - Prefix letters (ו, ה, ב, כ, ל, מ, ש) are peeled off into extra variants,
 *   so "בבית", "הבית" and "ולבית" all reach "בית".
 */

const MARKS = /[̀-֑ͯ-ׇֽֿׁׂׅׄ]/g;
const QUOTES = /(?<=[\p{L}\p{N}])["'׳״’](?=[\p{L}\p{N}])/gu;
const WORD = /[\p{L}\p{N}]+/gu;

const FINALS: Record<string, string> = {
  ך: "כ",
  ם: "מ",
  ן: "נ",
  ף: "פ",
  ץ: "צ",
};
const FINAL = /[ךםןףץ]/g;

const PREFIXES = new Set("והבכלמש");
/** Up to three prefix letters, as in "וכשה…"; at least two letters remain. */
const MAX_PREFIX = 3;
const MIN_STEM = 2;

/** Same length as the input: lower case and regular letters for finals. */
export function foldCase(text: string) {
  return text.toLowerCase().replace(FINAL, (c) => FINALS[c]);
}

export function normalize(text: string) {
  return foldCase(text.normalize("NFKD").replace(MARKS, "")).replace(
    QUOTES,
    "",
  );
}

export function words(text: string) {
  return normalize(text).match(WORD) ?? [];
}

/** The word without one, two or three leading prefix letters. */
export function stems(word: string) {
  const out: string[] = [];
  for (let i = 0; i < MAX_PREFIX && PREFIXES.has(word[i]); i++) {
    const rest = word.slice(i + 1);
    if (rest.length < MIN_STEM) break;
    out.push(rest);
  }
  return out;
}

/** Every word of the text together with its stems, ready for the index. */
export function indexTerms(text: string) {
  const terms = new Set<string>();
  for (const w of words(text)) {
    terms.add(w);
    for (const s of stems(w)) terms.add(s);
  }
  return [...terms];
}

const WORD_START = /[\p{L}\p{N}]/u;

/**
 * A short piece of the text around the first query match, split so the match
 * can be highlighted. Works on the original text (niqqud and all), with only
 * case and final letters folded for comparison.
 */
export function snippet(text: string, queryWords: string[], radius = 40) {
  const folded = foldCase(text);
  const terms = queryWords
    .flatMap((w) => [w, ...stems(w)])
    .sort((a, b) => b.length - a.length);
  for (const term of terms) {
    let at = folded.indexOf(term);
    // Prefer a match at the start of a word, the way the index matches.
    while (at > 0 && WORD_START.test(folded[at - 1])) {
      const next = folded.indexOf(term, at + 1);
      if (next < 0) break;
      at = next;
    }
    if (at < 0) continue;
    let start = Math.max(0, at - radius);
    let end = Math.min(text.length, at + term.length + radius);
    // Cut between words, not inside them.
    if (start > 0) {
      const space = text.indexOf(" ", start);
      if (space >= 0 && space < at) start = space + 1;
    }
    if (end < text.length) {
      const space = text.lastIndexOf(" ", end);
      if (space > at + term.length) end = space;
    }
    return {
      before: (start > 0 ? "…" : "") + text.slice(start, at),
      match: text.slice(at, at + term.length),
      after: text.slice(at + term.length, end) + (end < text.length ? "…" : ""),
    };
  }
  return null;
}
