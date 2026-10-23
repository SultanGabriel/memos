import { isWhiteboardConflict } from "./whiteboard-revision";

export type SaveStatus = "saved" | "unsaved" | "saving" | "error" | "conflict";

export interface WhiteboardAutosaveController {
  readonly status: SaveStatus;
  readonly dirty: boolean;
  markChanged(): void;
  saveNow(): Promise<void>;
  subscribe(listener: () => void): () => void;
  suspend(): void;
  reset(): void;
  whenIdle(): Promise<void>;
  dispose(): void;
}

/** Local edit counters acknowledge only submitted snapshots; the resource revision belongs to the shared mutation queue. */
export function createWhiteboardAutosave<T>({
  getSnapshot,
  save,
  debounceMs = 2000,
  isConflicted = () => false,
}: {
  getSnapshot: () => T;
  save: (snapshot: T) => Promise<void>;
  debounceMs?: number;
  isConflicted?: () => boolean;
}): WhiteboardAutosaveController {
  let revision = 0;
  let savedRevision = 0;
  let status: SaveStatus = "saved";
  let disposed = false;
  let suspended = false;
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
    if (suspended || isConflicted()) return;
    timer = setTimeout(() => {
      timer = undefined;
      void saveNow();
    }, debounceMs);
  };
  function suspend() {
    suspended = true;
    cancelTimer();
    if (status !== "conflict") {
      status = "conflict";
      notify();
    }
  }
  async function saveNow(): Promise<void> {
    cancelTimer();
    if (suspended || isConflicted()) {
      suspend();
      return;
    }
    if (disposed || revision === savedRevision) return;
    if (inFlight) {
      await inFlight;
      if (!disposed && revision !== savedRevision && status !== "error" && status !== "conflict") await saveNow();
      return;
    }
    const submittedRevision = revision;
    status = "saving";
    // Starting on a microtask sets inFlight before getSnapshot/save can synchronously throw.
    inFlight = Promise.resolve().then(async () => {
      try {
        await save(getSnapshot());
        if (!suspended) {
          savedRevision = submittedRevision;
          status = revision === savedRevision ? "saved" : "unsaved";
        }
      } catch (error) {
        if (isWhiteboardConflict(error) || suspended || isConflicted()) suspend();
        else status = "error";
      } finally {
        inFlight = undefined;
        if (!disposed) {
          notify();
          if (revision !== savedRevision && status !== "error" && status !== "conflict") schedule();
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
      if (suspended || isConflicted()) {
        suspend();
        return;
      }
      if (!inFlight) status = "unsaved";
      notify();
      schedule();
    },
    saveNow,
    suspend,
    reset() {
      cancelTimer();
      suspended = false;
      savedRevision = revision;
      status = "saved";
      notify();
    },
    whenIdle: () => inFlight ?? Promise.resolve(),
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
