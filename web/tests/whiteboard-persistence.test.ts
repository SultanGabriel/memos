import type { Editor } from "tldraw";
import { describe, expect, it, vi } from "vitest";
import { loadWhiteboardDocument, reloadWhiteboardDocument, serializeWhiteboardDocument } from "@/components/Whiteboard/persistence";

const snapshots = vi.hoisted(() => ({ getSnapshot: vi.fn(), loadSnapshot: vi.fn() }));
vi.mock("tldraw", () => snapshots);
const editor = { store: {} } as Editor;

describe("whiteboard persistence boundary", () => {
  it("serializes document records without camera, selection, or session state", () => {
    const document = { schema: { schemaVersion: 2 }, store: {} };
    snapshots.getSnapshot.mockReturnValue({ document, session: { camera: { x: 10 }, selection: ["shape:one"] } });
    expect(JSON.parse(serializeWhiteboardDocument(editor))).toEqual(document);
  });

  it("loads only the backend document and accepts an empty new board", () => {
    loadWhiteboardDocument(editor.store, "{}");
    expect(snapshots.loadSnapshot).not.toHaveBeenCalled();
    const document = { schema: { schemaVersion: 2 }, store: {} };
    loadWhiteboardDocument(editor.store, JSON.stringify(document));
    expect(snapshots.loadSnapshot).toHaveBeenCalledExactlyOnceWith(editor.store, { document });
  });

  it("explicit reload uses remote changes and clears undo history, including for a blank server board", () => {
    const mergeRemoteChanges = vi.fn((apply: () => void) => apply());
    const clearHistory = vi.fn();
    const schema = { schemaVersion: 2 };
    snapshots.getSnapshot.mockReturnValue({ document: { schema, store: { "shape:old": {} } } });
    const current = { store: { mergeRemoteChanges, schema: { serialize: () => schema } }, clearHistory } as unknown as Editor;
    reloadWhiteboardDocument(current, "{}");
    expect(mergeRemoteChanges).toHaveBeenCalledTimes(1);
    expect(snapshots.loadSnapshot).toHaveBeenCalledWith(current.store, { document: { schema, store: {} } });
    expect(clearHistory).toHaveBeenCalledTimes(1);
  });

  it("restores the local document if the explicit server snapshot cannot be loaded", () => {
    const previous = { schema: {}, store: { "shape:local": {} } };
    const current = { store: { mergeRemoteChanges: (apply: () => void) => apply() }, clearHistory: vi.fn() } as unknown as Editor;
    snapshots.getSnapshot.mockReturnValue({ document: previous });
    snapshots.loadSnapshot.mockImplementationOnce(() => { throw new Error("invalid server snapshot"); });
    expect(() => reloadWhiteboardDocument(current, '{"schema":{},"store":{}}')).toThrow("invalid server snapshot");
    expect(snapshots.loadSnapshot).toHaveBeenLastCalledWith(current.store, { document: previous });
    expect(current.clearHistory).not.toHaveBeenCalled();
  });

  it("refuses to persist image binaries or temporary browser URLs", () => {
    for (const src of ["data:image/png;base64,AA==", "blob:https://memos.test/image"]) {
      snapshots.getSnapshot.mockReturnValue({
        document: { store: { "asset:one": { typeName: "asset", type: "image", props: { src }, meta: { attachment: "attachments/one" } } } },
      });
      expect(() => serializeWhiteboardDocument(editor)).toThrow("Images must finish uploading");
    }
  });
});
