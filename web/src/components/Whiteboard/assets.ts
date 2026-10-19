import type { TLAssetStore } from "tldraw";
import { attachmentServiceClient } from "@/connect";
import { getAttachmentUrl } from "@/utils/attachment";

export const WHITEBOARD_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"];

/** The existing AttachmentService accepts unlinked user-owned uploads. No board relationship is added. */
export async function uploadWhiteboardImage(file: File, signal?: AbortSignal) {
  if (!WHITEBOARD_IMAGE_TYPES.includes(file.type)) throw new Error("Unsupported image type");
  const content = new Uint8Array(await file.arrayBuffer());
  return attachmentServiceClient.createAttachment({ attachment: { filename: file.name, type: file.type, content } }, { signal });
}

export function createWhiteboardAssets({
  canUpload,
  onError,
  onPending,
}: {
  canUpload: boolean;
  onError: (error: unknown) => void;
  onPending: (pending: number) => void;
}) {
  const pending = new Set<Promise<unknown>>();
  const resolvedUrls = new Map<string, Promise<string | null>>();
  const assets: TLAssetStore = {
    async upload(asset, file, signal) {
      if (!canUpload || asset.type !== "image") {
        const error = new Error("Image uploads require the whiteboard owner");
        onError(error);
        throw error;
      }
      const upload = uploadWhiteboardImage(file, signal);
      pending.add(upload);
      onPending(pending.size);
      try {
        const attachment = await upload;
        return { src: getAttachmentUrl(attachment), meta: { attachment: attachment.name } };
      } catch (error) {
        onError(error);
        throw error;
      } finally {
        pending.delete(upload);
        onPending(pending.size);
      }
    },
    async resolve(asset) {
      const name = asset.meta.attachment;
      if (typeof name !== "string") return null;
      if (!resolvedUrls.has(name)) {
        resolvedUrls.set(
          name,
          attachmentServiceClient
            .getAttachment({ name })
            .then(getAttachmentUrl)
            .catch((error: unknown) => {
              resolvedUrls.delete(name);
              onError(error);
              return null;
            }),
        );
      }
      return (await resolvedUrls.get(name)) ?? null;
    },
    // No remove hook: ordinary orphan images are explicitly allowed in v1.
  };
  return {
    assets,
    async whenIdle() {
      while (pending.size) await Promise.allSettled([...pending]);
    },
  };
}
