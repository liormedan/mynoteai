type Listener = (pageId: string, plainText: string) => void;

const listeners = new Set<Listener>();

/** Lets the search index pick up a save from this device without a read. */
export function onContentSaved(listener: Listener) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function emitContentSaved(pageId: string, plainText: string) {
  for (const listener of listeners) listener(pageId, plainText);
}
