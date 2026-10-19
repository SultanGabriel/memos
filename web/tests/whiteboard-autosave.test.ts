import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWhiteboardAutosave } from "@/lib/whiteboard-autosave";

// { getSnapshot, save, debounceMs } -> { status, dirty, markChanged, saveNow, dispose }.
// Notifications carry no snapshot: serialization must happen only when a save starts.
describe("whiteboard autosave", () => {
  const disposers: Array<() => void> = [];

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    for (const dispose of disposers.splice(0)) dispose();
    vi.useRealTimers();
  });

  const setup = (save = vi.fn<(snapshot: string) => Promise<void>>().mockResolvedValue(undefined)) => {
    let current = "A";
    const getSnapshot = vi.fn(() => current);
    const controller = createWhiteboardAutosave({ getSnapshot, save, debounceMs: 2000 });
    disposers.push(() => controller.dispose());
    const change = (value: string) => {
      current = value;
      controller.markChanged();
    };
    return { controller, save, getSnapshot, change };
  };

  it("debounces changes and captures only the latest snapshot when saving", async () => {
    const { controller, change, save, getSnapshot } = setup();
    expect(controller.status).toBe("saved");
    change("A");
    expect(controller.status).toBe("unsaved");
    expect(controller.dirty).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    change("B");
    await vi.advanceTimersByTimeAsync(1999);
    expect(save).not.toHaveBeenCalled();
    expect(getSnapshot).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(getSnapshot).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledExactlyOnceWith("B");
    expect(controller.status).toBe("saved");
    expect(controller.dirty).toBe(false);
  });

  it("serializes saves and never acknowledges newer edits with an older completion", async () => {
    let finishA!: () => void;
    let finishB!: () => void;
    const save = vi
      .fn<(snapshot: string) => Promise<void>>()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishA = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishB = resolve;
          }),
      );
    const { controller, change } = setup(save);
    change("A");
    await vi.advanceTimersByTimeAsync(2000);
    expect(controller.status).toBe("saving");
    change("B");
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).toHaveBeenCalledTimes(1);
    finishA();
    await vi.advanceTimersByTimeAsync(2000);
    expect(controller.dirty).toBe(true);
    expect(controller.status).not.toBe("saved");
    expect(save.mock.calls).toEqual([["A"], ["B"]]);
    finishB();
    await vi.advanceTimersByTimeAsync(0);
    expect(controller.status).toBe("saved");
    expect(controller.dirty).toBe(false);
  });

  it("retains failed changes and supports an immediate manual retry", async () => {
    const save = vi.fn<(snapshot: string) => Promise<void>>().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
    const { controller, change } = setup(save);
    change("A");
    await vi.advanceTimersByTimeAsync(2000);
    expect(controller.status).toBe("error");
    expect(controller.dirty).toBe(true);
    await controller.saveNow();
    expect(save.mock.calls).toEqual([["A"], ["A"]]);
    expect(controller.status).toBe("saved");
    expect(controller.dirty).toBe(false);
  });

  it("manual save bypasses debounce and disposal cancels pending work", async () => {
    const { controller, change, save } = setup();
    change("A");
    await controller.saveNow();
    expect(save).toHaveBeenCalledExactlyOnceWith("A");
    change("B");
    controller.dispose();
    await vi.advanceTimersByTimeAsync(4000);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
