import type { Page } from "@/lib/pages/model";
import {
  deleteEntries,
  loadCorpus,
  putEntries,
  type CorpusEntry,
} from "./corpus";
import { SearchEngine } from "./engine";

const CONCURRENCY = 6;
const NOTIFY_MS = 100;
const PERSIST_MS = 500;

const contentAt = (p: Page) => (p.contentUpdatedAt ?? p.updatedAt).getTime();

/**
 * Keeps the search engine in step with the pages store:
 *
 * 1. On start, builds the index from the text saved in IndexedDB.
 * 2. Titles come straight from page metadata, so they are searchable at once.
 * 3. Text is read from Firestore only for pages whose content changed since
 *    it was saved (contentUpdatedAt is newer) — on a reload, usually none.
 * 4. A save on this device goes into the index directly, without a read.
 */
export class SearchIndexer {
  readonly engine = new SearchEngine();
  private corpus = new Map<string, CorpusEntry>();
  private titles = new Map<string, string>();
  /** Pages saved here whose next contentUpdatedAt is our own save. */
  private savedHere = new Set<string>();
  private queue: Page[] = [];
  private inFlight = new Set<string>();
  private workers = 0;
  private pages: Page[] | null = null;
  private loaded = false;
  private toPersist = new Map<string, CorpusEntry>();
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private notifyTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<() => void>();
  private disposed = false;
  version = 0;

  constructor(private fetchText: (pageId: string) => Promise<string>) {}

  private loading: Promise<void> | null = null;

  /** Can follow stop(): React mounts effects twice in development. */
  start() {
    this.disposed = false;
    this.loading ??= loadCorpus().then((entries) => {
      for (const e of entries) this.corpus.set(e.id, e);
      this.loaded = true;
    });
    return this.loading.then(() => this.sync());
  }

  stop() {
    this.disposed = true;
    this.flush();
    if (this.notifyTimer) clearTimeout(this.notifyTimer);
  }

  /** Number of pages whose text is still being read. */
  get pending() {
    return this.queue.length + this.inFlight.size;
  }

  text(pageId: string) {
    return this.corpus.get(pageId)?.text ?? "";
  }

  setPages(pages: Page[]) {
    this.pages = pages;
    if (this.loaded) this.sync();
  }

  contentSaved(pageId: string, text: string) {
    const entry = this.corpus.get(pageId);
    const updated = { id: pageId, text, contentAt: entry?.contentAt ?? 0 };
    this.corpus.set(pageId, updated);
    this.savedHere.add(pageId);
    this.engine.set({
      id: pageId,
      title: this.titles.get(pageId) ?? "",
      text,
    });
    this.persist(updated);
    this.notify();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  getVersion = () => this.version;

  private sync() {
    if (!this.pages || this.disposed) return;
    const ids = new Set(this.pages.map((p) => p.id));

    const gone = [...this.corpus.keys()].filter((id) => !ids.has(id));
    for (const id of [...this.titles.keys()]) {
      if (!ids.has(id)) {
        this.engine.remove(id);
        this.titles.delete(id);
      }
    }
    for (const id of gone) this.corpus.delete(id);
    this.queue = this.queue.filter((p) => ids.has(p.id));
    void deleteEntries(gone);

    for (const page of this.pages) {
      const entry = this.corpus.get(page.id);
      const at = contentAt(page);
      if (entry && at > entry.contentAt && this.savedHere.has(page.id)) {
        // The server confirmed our own save; the text is already current.
        this.savedHere.delete(page.id);
        entry.contentAt = at;
        this.persist(entry);
      }
      if (this.titles.get(page.id) !== page.title) {
        this.titles.set(page.id, page.title);
        this.engine.set({
          id: page.id,
          title: page.title,
          text: entry?.text ?? "",
        });
      }
      // A pending server timestamp reads as 0: wait for the real one.
      const stale = !entry || (at > 0 && at > entry.contentAt);
      if (stale && !this.inFlight.has(page.id)) {
        if (!this.queue.some((q) => q.id === page.id)) this.queue.push(page);
      }
    }
    this.pump();
    this.notify();
  }

  private pump() {
    while (this.workers < CONCURRENCY && this.queue.length) {
      this.workers++;
      void this.work().finally(() => this.workers--);
    }
  }

  private async work() {
    let page: Page | undefined;
    while ((page = this.queue.shift()) && !this.disposed) {
      this.inFlight.add(page.id);
      try {
        const text = await this.fetchText(page.id);
        if (this.disposed) return;
        // Deleted while its text was on the way.
        if (!this.titles.has(page.id)) continue;
        const entry = { id: page.id, text, contentAt: contentAt(page) };
        this.corpus.set(page.id, entry);
        this.engine.set({
          id: page.id,
          title: this.titles.get(page.id) ?? page.title,
          text,
        });
        this.persist(entry);
      } catch {
        // Offline with nothing cached: the next snapshot will try again.
      } finally {
        this.inFlight.delete(page.id);
        this.notify();
      }
    }
  }

  private persist(entry: CorpusEntry) {
    this.toPersist.set(entry.id, { ...entry });
    this.persistTimer ??= setTimeout(() => this.flush(), PERSIST_MS);
  }

  private flush() {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = null;
    void putEntries([...this.toPersist.values()]);
    this.toPersist.clear();
  }

  private notify() {
    this.notifyTimer ??= setTimeout(() => {
      this.notifyTimer = null;
      this.version++;
      for (const listener of this.listeners) listener();
    }, NOTIFY_MS);
  }
}
