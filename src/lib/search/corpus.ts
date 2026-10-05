/*
 * The text the search index is built from, kept in IndexedDB so a reload
 * does not read every page's content from Firestore again. Raw text is
 * stored rather than the FlexSearch index itself: rebuilding takes a few
 * milliseconds per hundred pages, and a change to the Hebrew normalizer
 * then needs no migration.
 */

export type CorpusEntry = {
  id: string;
  text: string;
  /** contentUpdatedAt (ms) of the page when the text was read. */
  contentAt: number;
};

const DB_NAME = "mynoteai-search";
const STORE = "pages";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function open() {
  dbPromise ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () =>
        req.result.createObjectStore(STORE, { keyPath: "id" });
      req.onsuccess = () => resolve(req.result);
      // Private windows may refuse IndexedDB; search then works from memory.
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function run(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => void,
): Promise<void> {
  return open().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) return resolve();
        const tx = db.transaction(STORE, mode);
        work(tx.objectStore(STORE));
        tx.oncomplete = tx.onerror = tx.onabort = () => resolve();
      }),
  );
}

export async function loadCorpus(): Promise<CorpusEntry[]> {
  const db = await open();
  if (!db) return [];
  return new Promise((resolve) => {
    const req = db.transaction(STORE).objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as CorpusEntry[]);
    req.onerror = () => resolve([]);
  });
}

export const putEntries = (entries: CorpusEntry[]) =>
  entries.length
    ? run("readwrite", (s) => entries.forEach((e) => s.put(e)))
    : Promise.resolve();

export const deleteEntries = (ids: string[]) =>
  ids.length
    ? run("readwrite", (s) => ids.forEach((id) => s.delete(id)))
    : Promise.resolve();
