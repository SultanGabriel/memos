import { describe, expect, it, vi } from "vitest";
import { replaceWhiteboardThumbnail } from "@/lib/whiteboard-thumbnail";
import { WhiteboardConflictError } from "@/lib/whiteboard-revision";

describe("whiteboard thumbnail replacement", () => {
  it("never deletes the old thumbnail when the revision-protected link conflicts", async () => {
    const remove = vi.fn();
    await expect(replaceWhiteboardThumbnail({
      oldName: "attachments/old", upload: async () => "attachments/orphan",
      link: async () => { throw new WhiteboardConflictError(); }, remove, onCleanupError: vi.fn(),
    })).rejects.toBeInstanceOf(WhiteboardConflictError);
    expect(remove).not.toHaveBeenCalled();
  });
  it("awaits upload and link before deleting the old attachment", async () => {
    const events: string[] = [];
    let finishLink!: () => void;
    const link = vi.fn(async () => {
      events.push("link");
      await new Promise<void>((resolve) => {
        finishLink = resolve;
      });
    });
    const remove = vi.fn(async () => {
      events.push("delete");
    });
    const replacement = replaceWhiteboardThumbnail({
      oldName: "attachments/old",
      upload: async () => {
        events.push("upload");
        return "attachments/new";
      },
      link,
      remove,
      onCleanupError: vi.fn(),
    });
    await Promise.resolve();
    expect(events).toEqual(["upload", "link"]);
    expect(remove).not.toHaveBeenCalled();
    finishLink();
    await expect(replacement).resolves.toBe("attachments/new");
    expect(events).toEqual(["upload", "link", "delete"]);
    expect(remove).toHaveBeenCalledWith("attachments/old");
  });

  it("preserves the current thumbnail when linking fails", async () => {
    const remove = vi.fn();
    await expect(
      replaceWhiteboardThumbnail({
        oldName: "attachments/old",
        upload: async () => "attachments/new",
        link: async () => {
          throw new Error("offline");
        },
        remove,
        onCleanupError: vi.fn(),
      }),
    ).rejects.toThrow("offline");
    expect(remove).not.toHaveBeenCalled();
  });

  it("does not link or delete anything when upload fails", async () => {
    const link = vi.fn();
    const remove = vi.fn();
    await expect(
      replaceWhiteboardThumbnail({
        oldName: "attachments/old",
        upload: async () => {
          throw new Error("upload failed");
        },
        link,
        remove,
        onCleanupError: vi.fn(),
      }),
    ).rejects.toThrow("upload failed");
    expect(link).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("keeps the new reference and reports a failed old-thumbnail cleanup", async () => {
    const onCleanupError = vi.fn();
    const error = new Error("cleanup failed");
    const link = vi.fn().mockResolvedValue(undefined);
    await expect(
      replaceWhiteboardThumbnail({
        oldName: "attachments/old",
        upload: async () => "attachments/new",
        link,
        remove: async () => {
          throw error;
        },
        onCleanupError,
      }),
    ).resolves.toBe("attachments/new");
    expect(link).toHaveBeenCalledExactlyOnceWith("attachments/new");
    expect(onCleanupError).toHaveBeenCalledWith("attachments/old", error);
  });
});
