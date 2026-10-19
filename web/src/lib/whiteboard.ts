export const whiteboardName = (uid: string) => `whiteboards/${uid}`;

export const whiteboardPath = (name: string) => {
  const match = /^whiteboards\/([^/]+)$/.exec(name);
  if (!match) throw new Error("Invalid whiteboard resource name");
  return `/whiteboards/${encodeURIComponent(match[1])}`;
};

/** JSON string literals are valid CEL string literals; user text never becomes executable filter syntax. */
export const whiteboardFilter = (search: string, tag: string) =>
  [search.trim() ? `title.contains(${JSON.stringify(search.trim())})` : "", tag.trim() ? `${JSON.stringify(tag.trim())} in tags` : ""]
    .filter(Boolean)
    .map((part) => `(${part})`)
    .join(" && ");
