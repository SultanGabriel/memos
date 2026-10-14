import { EditorView } from "@codemirror/view";

export const richEditorTheme = EditorView.theme({
  "&": {
    color: "var(--foreground)",
    backgroundColor: "var(--background)",
    height: "100%",
    minHeight: "0",
    fontSize: "var(--rich-editor-font-size, 14px)",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "inherit", overflow: "auto", minHeight: "0" },
  ".cm-content": {
    padding: "32px 0 16px",
    lineHeight: "var(--rich-editor-line-height, 1.6)",
    caretColor: "var(--foreground)",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
  ".cm-line": { padding: "0 4px", lineHeight: "inherit" },
  ".cm-codeblock-line": { fontSize: "inherit", lineHeight: "var(--rich-editor-line-height, 1.6)", minHeight: "0" },
  ".cm-gutters": { backgroundColor: "var(--background)", color: "var(--muted-foreground)", borderRight: "none" },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 12px 0 4px", fontVariantNumeric: "tabular-nums" },
  ".cm-activeLineGutter": { backgroundColor: "var(--muted)", color: "var(--foreground)" },
  ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--muted) 50%, transparent)" },
  ".cm-selectionMatch": { backgroundColor: "var(--accent)" },
  ".cm-trailingSpace": { backgroundColor: "color-mix(in srgb, var(--destructive) 25%, transparent)" },
  ".cm-highlightSpace, .cm-highlightTab": { color: "var(--muted-foreground)" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--foreground)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "var(--accent) !important" },
  ".cm-panels": { backgroundColor: "var(--muted)", color: "var(--foreground)" },
});
