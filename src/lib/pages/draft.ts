/*
 * A synchronous local copy of the document being edited. Firestore writes are
 * debounced and asynchronous, so a refresh right after typing can beat them;
 * localStorage is written on every change and survives the reload.
 */

export type Draft<T> = { value: T; at: number };

const KEY = (pageId: string) => `mynoteai:draft:${pageId}`;
/** Very large documents are skipped: localStorage holds ~5 MB per origin. */
const MAX_DRAFT_CHARS = 1_000_000;

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

const storage = (): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

export function writeDraft<T>(
  pageId: string,
  value: T,
  at = Date.now(),
  s = storage(),
) {
  if (!s) return;
  try {
    const json = JSON.stringify({ value, at } satisfies Draft<T>);
    if (json.length <= MAX_DRAFT_CHARS) s.setItem(KEY(pageId), json);
  } catch {
    // Quota exceeded or private mode: Firestore still has the last save.
  }
}

export function readDraft<T>(pageId: string, s = storage()): Draft<T> | null {
  try {
    const raw = s?.getItem(KEY(pageId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as Draft<T>;
    return typeof draft.at === "number" ? draft : null;
  } catch {
    return null;
  }
}

/** Removes the draft if nothing newer than `savedAt` was written since. */
export function clearDraft(pageId: string, savedAt: number, s = storage()) {
  const draft = readDraft(pageId, s);
  if (draft && draft.at <= savedAt) s?.removeItem(KEY(pageId));
}

/** The draft wins only when it is newer than what the server has. */
export function pickNewer<T>(
  server: { value: T; updatedAt: Date },
  draft: Draft<T> | null,
): { value: T; fromDraft: boolean } {
  return draft && draft.at > server.updatedAt.getTime()
    ? { value: draft.value, fromDraft: true }
    : { value: server.value, fromDraft: false };
}
