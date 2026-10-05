import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAutosave, type SaveStatus } from "./autosave";

describe("createAutosave", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("writes only the latest value after the delay", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const a = createAutosave<string>(save, { delay: 800 });
    a.schedule("ש");
    a.schedule("של");
    a.schedule("שלום");
    await vi.advanceTimersByTimeAsync(799);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("שלום");
  });

  it("flush writes immediately", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const a = createAutosave<number>(save);
    a.schedule(1);
    await a.flush();
    expect(save).toHaveBeenCalledWith(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("never overlaps saves and writes the value queued meanwhile", async () => {
    let release!: () => void;
    const save = vi
      .fn<(v: string) => Promise<void>>()
      .mockImplementationOnce(() => new Promise<void>((r) => (release = r)))
      .mockResolvedValue(undefined);
    const a = createAutosave<string>(save, { delay: 10 });
    a.schedule("first");
    await vi.advanceTimersByTimeAsync(10);
    a.schedule("second");
    await vi.advanceTimersByTimeAsync(10);
    expect(save).toHaveBeenCalledTimes(1); // still waiting for "first"
    release();
    await vi.runAllTimersAsync();
    expect(save.mock.calls.map((c) => c[0])).toEqual(["first", "second"]);
  });

  it("reports pending → saving → saved, and error on failure", async () => {
    const statuses: SaveStatus[] = [];
    const save = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("offline"));
    const a = createAutosave<string>(save, {
      delay: 5,
      onStatus: (s) => statuses.push(s),
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    a.schedule("x");
    await vi.advanceTimersByTimeAsync(5);
    a.schedule("y");
    await vi.advanceTimersByTimeAsync(5);
    expect(statuses).toEqual([
      "pending",
      "saving",
      "saved",
      "pending",
      "saving",
      "error",
    ]);
  });
});
