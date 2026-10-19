/** Commas delimit metadata; preserve spelling and case without Markdown interpretation. */
export const parseWhiteboardTags = (text: string): string[] => [
  ...new Set(
    text
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
  ),
];
