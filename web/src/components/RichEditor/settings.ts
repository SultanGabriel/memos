export interface RichEditorSettings {
  version: 1;
  vim: boolean;
  autosaveSeconds: 0 | 3 | 5 | 10 | 30 | 60;
  lineNumbers: boolean;
  lineWrapping: boolean;
  fontSize: 8 | 9 | 11 | 12 | 14 | 16 | 18 | 20 | 22 | 24 | 26 | 28 | 30 | 32;
  contentWidth: "narrow" | "normal" | "wide" | "full";
  tabSize: 2 | 4;
  indentWithTabs: boolean;
  spellcheck: boolean;
  livePreview: boolean;
  columnMarker: number | null;
  highlightActiveLine: boolean;
  highlightSelectionMatches: boolean;
  bracketMatching: boolean;
  closeBrackets: boolean;
  foldGutter: boolean;
  showWhitespace: "off" | "trailing" | "all";
  scrollPastEnd: boolean;
  showWordCount: boolean;
  showCharacterCount: boolean;
  lineHeight: 1.4 | 1.6 | 1.8;
}

export const DEFAULT_RICH_EDITOR_SETTINGS: RichEditorSettings = {
  version: 1,
  vim: false,
  autosaveSeconds: 5,
  lineNumbers: true,
  lineWrapping: true,
  fontSize: 14,
  contentWidth: "wide",
  tabSize: 2,
  indentWithTabs: false,
  spellcheck: true,
  livePreview: true,
  columnMarker: 80,
  highlightActiveLine: true,
  highlightSelectionMatches: true,
  bracketMatching: true,
  closeBrackets: true,
  foldGutter: false,
  showWhitespace: "off",
  scrollPastEnd: true,
  showWordCount: true,
  showCharacterCount: false,
  lineHeight: 1.6,
};

export const autosaveOptions = [0, 3, 5, 10, 30, 60] as const;
export const fontSizeOptions = [8, 9, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32] as const;
export const lineHeightOptions = [1.4, 1.6, 1.8] as const;
export const contentWidthOptions = ["narrow", "normal", "wide", "full"] as const;
export const contentWidths = { narrow: 720, normal: 900, wide: 1100, full: undefined } as const;

export function validateRichEditorSettings(value: unknown): RichEditorSettings {
  const settings = { ...DEFAULT_RICH_EDITOR_SETTINGS };
  if (!value || typeof value !== "object" || Array.isArray(value)) return settings;
  const stored = value as Record<string, unknown>;
  // Future schemas must be migrated deliberately, not interpreted as version 1.
  if (stored.version !== undefined && stored.version !== 1) return settings;
  for (const key of [
    "vim",
    "lineNumbers",
    "lineWrapping",
    "indentWithTabs",
    "spellcheck",
    "livePreview",
    "highlightActiveLine",
    "highlightSelectionMatches",
    "bracketMatching",
    "closeBrackets",
    "foldGutter",
    "scrollPastEnd",
    "showWordCount",
    "showCharacterCount",
  ] as const) {
    if (typeof stored[key] === "boolean") settings[key] = stored[key];
  }
  for (const option of autosaveOptions) {
    if (stored.autosaveSeconds === option) settings.autosaveSeconds = option;
  }
  for (const option of fontSizeOptions) {
    if (stored.fontSize === option) settings.fontSize = option;
  }
  for (const option of lineHeightOptions) {
    if (stored.lineHeight === option) settings.lineHeight = option;
  }
  if (stored.showWhitespace === "off" || stored.showWhitespace === "trailing" || stored.showWhitespace === "all") {
    settings.showWhitespace = stored.showWhitespace;
  }
  for (const option of contentWidthOptions) {
    if (stored.contentWidth === option) settings.contentWidth = option;
  }
  if (stored.tabSize === 2 || stored.tabSize === 4) settings.tabSize = stored.tabSize;
  if (stored.columnMarker === null) settings.columnMarker = null;
  else if (
    typeof stored.columnMarker === "number" &&
    Number.isInteger(stored.columnMarker) &&
    stored.columnMarker >= 40 &&
    stored.columnMarker <= 200
  ) {
    settings.columnMarker = stored.columnMarker;
  }
  return settings;
}
