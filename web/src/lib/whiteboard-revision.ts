import { Code, ConnectError } from "@connectrpc/connect";

export class WhiteboardConflictError extends Error {
  constructor() {
    super("This whiteboard was changed somewhere else");
    this.name = "WhiteboardConflictError";
  }
}

export function isWhiteboardConflict(error: unknown) {
  return error instanceof WhiteboardConflictError || ConnectError.from(error).code === Code.FailedPrecondition;
}

/** One resource-wide revision and queue. Only successful writes or explicit reload advance it. */
export function createWhiteboardRevisionCoordinator(initialRevision: bigint) {
  let state = { revision: initialRevision, conflict: false };
  let tail: Promise<unknown> = Promise.resolve();
  let epoch = 0;
  let disposed = false;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    enqueue<T extends { revision: bigint }>(write: (expectedRevision: bigint) => Promise<T>): Promise<T> {
      const queuedEpoch = epoch;
      const result = tail.then(async () => {
        if (disposed) throw new Error("Whiteboard session closed");
        if (queuedEpoch !== epoch || state.conflict) throw new WhiteboardConflictError();
        if (state.revision < 1n) throw new Error("Load the Whiteboard revision before editing");
        try {
          const response = await write(state.revision);
          state = { revision: response.revision, conflict: false };
          notify();
          return response;
        } catch (error) {
          if (isWhiteboardConflict(error)) {
            state = { ...state, conflict: true };
            notify();
          }
          throw error;
        }
      });
      tail = result.catch(() => {});
      return result;
    },
    whenIdle: () => tail,
    reset(revision: bigint) {
      if (revision < 1n) throw new Error("Invalid Whiteboard revision");
      epoch++;
      state = { revision, conflict: false };
      notify();
    },
    dispose() {
      disposed = true;
      listeners.clear();
    },
  };
}
