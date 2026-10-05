import { Index } from "flexsearch";
import { indexTerms, stems, words } from "./hebrew";

export type SearchDoc = { id: string; title: string; text: string };
export type SearchHit = { id: string; score: number; terms: string[] };

const TITLE_WEIGHT = 3;
const BODY_WEIGHT = 1;
/** A match through a stripped prefix counts a little less than the word itself. */
const STEM_FACTOR = 0.8;
/** Stems this short match whole words only: "ית" must not find "יתרון". */
const SHORT_STEM = 2;
const POOL = 2000;

const newIndex = () =>
  new Index({
    tokenize: "forward",
    // Terms arrive already normalized and expanded by indexTerms().
    encode: (s: string) => s.split(" ").filter(Boolean),
  });

/**
 * Full-text search over page titles and text. Every word of the query must
 * match (as a prefix of a word, or through one of its prefix-less stems);
 * title matches rank above text matches.
 */
export class SearchEngine {
  private title = newIndex();
  private body = newIndex();
  private short = new Map<string, { title: Set<string>; body: Set<string> }>();
  private ids = new Set<string>();

  get size() {
    return this.ids.size;
  }

  set(doc: SearchDoc) {
    const title = indexTerms(doc.title);
    const body = indexTerms(doc.text);
    if (this.ids.has(doc.id)) {
      this.title.update(doc.id, title.join(" "));
      this.body.update(doc.id, body.join(" "));
    } else {
      this.title.add(doc.id, title.join(" "));
      this.body.add(doc.id, body.join(" "));
      this.ids.add(doc.id);
    }
    const isShort = (t: string) => t.length <= SHORT_STEM;
    this.short.set(doc.id, {
      title: new Set(title.filter(isShort)),
      body: new Set(body.filter(isShort)),
    });
  }

  remove(id: string) {
    if (!this.ids.delete(id)) return;
    this.title.remove(id);
    this.body.remove(id);
    this.short.delete(id);
  }

  search(query: string, limit = 20): SearchHit[] {
    const qWords = [...new Set(words(query))];
    if (!qWords.length) return [];

    let total: Map<string, number> | null = null;
    for (const word of qWords) {
      const scores = new Map<string, number>();
      const hit = (id: string, score: number) =>
        scores.set(id, Math.max(scores.get(id) ?? 0, score));

      for (const term of [word, ...stems(word)]) {
        const factor = term === word ? 1 : STEM_FACTOR;
        if (term !== word && term.length <= SHORT_STEM) {
          for (const [id, s] of this.short) {
            if (s.title.has(term)) hit(id, TITLE_WEIGHT * factor);
            else if (s.body.has(term)) hit(id, BODY_WEIGHT * factor);
          }
          continue;
        }
        for (const id of this.title.search(term, { limit: POOL }))
          hit(String(id), TITLE_WEIGHT * factor);
        for (const id of this.body.search(term, { limit: POOL }))
          hit(String(id), BODY_WEIGHT * factor);
      }

      if (!total) {
        total = scores;
      } else {
        const next = new Map<string, number>();
        for (const [id, s] of total) {
          const add = scores.get(id);
          if (add !== undefined) next.set(id, s + add);
        }
        total = next;
      }
      if (!total.size) return [];
    }

    return [...total!]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id, score]) => ({ id, score, terms: qWords }));
  }
}
