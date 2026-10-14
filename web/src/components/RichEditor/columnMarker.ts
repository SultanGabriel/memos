import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

// `ch` tracks the editor's base monospace font as font size changes. Live-preview
// headings and widgets can use different metrics, so this is a source-column
// guide, not an exact character position in rendered Markdown.
export function columnMarkerExtension(column: number | null): Extension {
  if (column === null) return [];
  return EditorView.theme({
    // A background clips naturally on narrow/wrapped documents without adding
    // horizontal overflow, unlike an absolutely positioned pseudo-element.
    ".cm-content": {
      backgroundImage: "linear-gradient(var(--border), var(--border))",
      backgroundSize: "1px 100%",
      backgroundRepeat: "no-repeat",
      backgroundPosition: `calc(4px + ${column}ch) 0`,
    },
  });
}
