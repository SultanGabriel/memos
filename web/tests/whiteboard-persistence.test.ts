import type { Editor } from "tldraw";
import { describe, expect, it, vi } from "vitest";
import { loadWhiteboardDocument, serializeWhiteboardDocument } from "@/components/Whiteboard/persistence";

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

  it("refuses to persist image binaries or temporary browser URLs", () => {
    for (const src of ["data:image/png;base64,AA==", "blob:https://memos.test/image"]) {
      snapshots.getSnapshot.mockReturnValue({
        document: { store: { "asset:one": { typeName: "asset", type: "image", props: { src }, meta: { attachment: "attachments/one" } } } },
      });
      expect(() => serializeWhiteboardDocument(editor)).toThrow("Images must finish uploading");
    }
  });
});
