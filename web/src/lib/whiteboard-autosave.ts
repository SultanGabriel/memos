export type SaveStatus = "saved" | "unsaved" | "saving" | "error";

export interface WhiteboardAutosaveController {
  readonly status: SaveStatus;
  readonly dirty: boolean;
  markChanged(): void;
  saveNow(): Promise<void>;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

/** Revision counters acknowledge only the snapshot actually submitted. Snapshot construction is deferred until a save starts. */
export function createWhiteboardAutosave<T>({
  getSnapshot,
  save,
  debounceMs = 2000,
}: {
  getSnapshot: () => T;
  save: (snapshot: T) => Promise<void>;
  debounceMs?: number;
}): WhiteboardAutosaveController {
  let revision = 0;
  let savedRevision = 0;
  let status: SaveStatus = "saved";
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void> | undefined;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const cancelTimer = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const schedule = () => {
    cancelTimer();
    timer = setTimeout(() => {
      timer = undefined;
      void saveNow();
    }, debounceMs);
  };
  async function saveNow(): Promise<void> {
    cancelTimer();
    if (disposed || revision === savedRevision) return;
    if (inFlight) {
      await inFlight;
      if (!disposed && revision !== savedRevision && status !== "error") await saveNow();
      return;
    }
    const submittedRevision = revision;
    status = "saving";
    // Starting on a microtask sets inFlight before getSnapshot/save can synchronously throw.
    inFlight = Promise.resolve().then(async () => {
      try {
        await save(getSnapshot());
        savedRevision = submittedRevision;
        status = revision === savedRevision ? "saved" : "unsaved";
      } catch {
        status = "error";
      } finally {
        inFlight = undefined;
        if (!disposed) {
          notify();
          if (revision !== savedRevision && status !== "error") schedule();
        }
      }
    });
    notify();
    await inFlight;
  }
  return {
    get status() {
      return status;
    },
    get dirty() {
      return revision !== savedRevision;
    },
    markChanged() {
      if (disposed) return;
      revision++;
      if (!inFlight) status = "unsaved";
      notify();
      schedule();
    },
    saveNow,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      disposed = true;
      cancelTimer();
      listeners.clear();
    },
  };
}
