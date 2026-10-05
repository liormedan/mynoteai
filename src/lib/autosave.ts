export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

/**
 * Debounced saving for one document. `schedule(value)` restarts the timer;
 * only the latest value is written. `flush()` writes immediately (on page
 * hide, before navigation). Saves never overlap: a value scheduled while a
 * save is running is written right after it.
 */
export function createAutosave<T>(
  save: (value: T) => Promise<void>,
  {
    delay = 800,
    onStatus,
  }: { delay?: number; onStatus?: (s: SaveStatus) => void } = {},
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queued: { value: T } | undefined;
  let running: Promise<void> | undefined;
  let disposed = false;

  const setStatus = (s: SaveStatus) => {
    if (!disposed) onStatus?.(s);
  };

  async function run() {
    timer = undefined;
    if (running || !queued) return running;
    const { value } = queued;
    queued = undefined;
    setStatus("saving");
    running = save(value)
      .then(() => setStatus(queued ? "pending" : "saved"))
      .catch((e) => {
        console.error("Autosave failed", e);
        setStatus("error");
      })
      .finally(() => {
        running = undefined;
      });
    await running;
    if (queued && !timer) await run();
  }

  return {
    schedule(value: T) {
      queued = { value };
      setStatus("pending");
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, delay);
    },
    async flush() {
      if (timer) clearTimeout(timer);
      await run();
      if (running) await running;
    },
    get hasPending() {
      return Boolean(queued || running);
    },
    dispose() {
      if (timer) clearTimeout(timer);
      disposed = true;
    },
  };
}
