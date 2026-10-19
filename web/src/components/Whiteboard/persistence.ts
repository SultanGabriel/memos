import { type Editor, getSnapshot, loadSnapshot, type TLEditorSnapshot } from "tldraw";

/** Called only when constructing a board's store, before its editor mounts. */
export function loadWhiteboardDocument(store: Editor["store"], json: string) {
  const document = JSON.parse(json || "{}") as TLEditorSnapshot["document"];
  if (Object.keys(document).length === 0) return;
  loadSnapshot(store, { document });
}

/** Only document records cross the API boundary. Never serialize the editor/session snapshot. */
export function serializeWhiteboardDocument(editor: Editor): string {
  const { document } = getSnapshot(editor.store);
  for (const record of Object.values(document.store)) {
    if (record.typeName !== "asset") continue;
    if (
      record.type !== "image" ||
      typeof record.meta.attachment !== "string" ||
      !record.props.src ||
      /^(data|blob):/i.test(record.props.src)
    ) {
      throw new Error("Images must finish uploading to attachments before saving");
    }
  }
  return JSON.stringify(document);
}
