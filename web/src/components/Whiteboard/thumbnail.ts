import { Code, ConnectError } from "@connectrpc/connect";
import { Box, type Editor } from "tldraw";
import { attachmentServiceClient } from "@/connect";
import { replaceWhiteboardThumbnail } from "@/lib/whiteboard-thumbnail";
import { uploadWhiteboardImage } from "./assets";

export function createWhiteboardThumbnails({
  editor,
  initialThumbnail,
  canGenerate,
  isClean,
  link,
  onError,
}: {
  editor: Editor;
  initialThumbnail: string;
  canGenerate: boolean;
  isClean: () => boolean;
  link: (name: string) => Promise<unknown>;
  onError: (error: unknown) => void;
}) {
  let current = initialThumbnail;
  let generation = 0;
  let completedGeneration = -1;
  let disposed = false;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cleanup = new Set<string>();
  const remove = async (name: string) => {
    try {
      await attachmentServiceClient.deleteAttachment({ name });
    } catch (error) {
      if (ConnectError.from(error).code !== Code.NotFound) throw error;
    }
  };
  const retryCleanup = async () => {
    for (const name of [...cleanup]) {
      try {
        await remove(name);
        cleanup.delete(name);
      } catch (error) {
        onError(error);
      }
    }
  };
  const schedule = () => {
    clearTimeout(timer);
    if (!disposed && canGenerate)
      timer = setTimeout(() => {
        void generate();
      }, 15000);
  };
  async function generate() {
    if (disposed || running || !canGenerate || !isClean()) return;
    const version = generation;
    running = true;
    try {
      await retryCleanup();
      if (version === completedGeneration || disposed) return;
      // Use a deterministic page, independent of current camera, selection, and session page.
      const page = editor.getPages().find((page) => editor.getPageShapeIds(page.id).size > 0);
      const ids = page ? [...editor.getPageShapeIds(page.id)] : [];
      if (!ids.length) {
        if (current) {
          await link("");
          cleanup.add(current);
          current = "";
          await retryCleanup();
        }
        completedGeneration = version;
        return;
      }
      const boxes = ids.map((id) => editor.getShapePageBounds(id)).filter((box) => box !== undefined);
      if (!boxes.length) return;
      const bounds = Box.Common(boxes);
      const scale = Math.min(1, 640 / Math.max(bounds.width + 32, bounds.height + 32));
      const { blob } = await editor.toImage(ids, { format: "webp", scale, pixelRatio: 1, padding: 16, background: true });
      if (disposed || generation !== version || !isClean()) return;
      // Browsers may fall back to PNG even when WebP was requested.
      const type = blob.type || "image/png";
      const file = new File([blob], type === "image/webp" ? "whiteboard-preview.webp" : "whiteboard-preview.png", { type });
      current = await replaceWhiteboardThumbnail({
        oldName: current,
        upload: async () => {
          const attachment = await uploadWhiteboardImage(file);
          if (disposed || generation !== version || !isClean()) throw new Error("Thumbnail superseded by newer edits");
          return attachment.name;
        },
        link,
        remove,
        onCleanupError(name, error) {
          cleanup.add(name);
          onError(error);
        },
      });
      completedGeneration = version;
    } catch (error) {
      if (!disposed) onError(error);
    } finally {
      running = false;
      if (!disposed && (generation !== version || cleanup.size)) schedule();
    }
  }
  return {
    markSaved() {
      generation++;
      schedule();
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
    },
  };
}
