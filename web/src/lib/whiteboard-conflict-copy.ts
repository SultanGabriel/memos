/** Deliberately omit identity, lifecycle, revision, and thumbnail reference. */
export function whiteboardConflictCopy(local: { document: string; title: string; tags: string[]; backgroundLayout: string }) {
  return {
    document: local.document,
    title: `${local.title.trim() || "Untitled Whiteboard"} (conflict copy)`,
    tags: [...local.tags],
    backgroundLayout: local.backgroundLayout,
  };
}
