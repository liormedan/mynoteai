const RTL_SCRIPT =
  /[\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}]/u;
const LETTER = /\p{L}/u;

/**
 * Direction of the first strongly-directional letter in `text`, or null when
 * the text has no letters at all (empty, digits, punctuation, "/").
 */
export function detectDirection(text: string): "rtl" | "ltr" | null {
  for (const ch of text) {
    if (!LETTER.test(ch)) continue;
    return RTL_SCRIPT.test(ch) ? "rtl" : "ltr";
  }
  return null;
}
