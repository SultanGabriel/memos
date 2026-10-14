import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { bracketMatching, foldGutter, indentUnit } from "@codemirror/language";
import { highlightSelectionMatches } from "@codemirror/search";
import { EditorState, type Extension } from "@codemirror/state";
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightTrailingWhitespace,
  highlightWhitespace,
  keymap,
  lineNumbers,
  scrollPastEnd,
} from "@codemirror/view";
import { columnMarkerExtension } from "./columnMarker";
import { livePreviewExtensions } from "./livePreview";
import type { RichEditorSettings } from "./settings";
import { vimExtension } from "./vim";

export const configurationKeys = [
  "vim",
  "lineNumbers",
  "lineWrapping",
  "tabSize",
  "indentation",
  "livePreview",
  "columnMarker",
  "attributes",
  "highlightActiveLine",
  "highlightSelectionMatches",
  "bracketMatching",
  "closeBrackets",
  "foldGutter",
  "showWhitespace",
  "scrollPastEnd",
] as const;

type ConfigurationKey = (typeof configurationKeys)[number];

export function configuration(settings: RichEditorSettings): Record<ConfigurationKey, Extension> {
  return {
    vim: vimExtension(settings.vim),
    lineNumbers: settings.lineNumbers ? lineNumbers() : [],
    lineWrapping: settings.lineWrapping ? EditorView.lineWrapping : [],
    tabSize: EditorState.tabSize.of(settings.tabSize),
    indentation: indentUnit.of(settings.indentWithTabs ? "\t" : " ".repeat(settings.tabSize)),
    livePreview: settings.livePreview ? livePreviewExtensions() : [],
    columnMarker: columnMarkerExtension(settings.columnMarker),
    attributes: EditorView.contentAttributes.of({ "aria-label": "Markdown document", spellcheck: String(settings.spellcheck) }),
    highlightActiveLine: settings.highlightActiveLine ? [highlightActiveLine(), highlightActiveLineGutter()] : [],
    highlightSelectionMatches: settings.highlightSelectionMatches ? highlightSelectionMatches() : [],
    bracketMatching: settings.bracketMatching ? bracketMatching() : [],
    closeBrackets: settings.closeBrackets ? [closeBrackets(), keymap.of(closeBracketsKeymap)] : [],
    foldGutter: settings.foldGutter ? foldGutter() : [],
    showWhitespace:
      settings.showWhitespace === "all"
        ? highlightWhitespace()
        : settings.showWhitespace === "trailing"
          ? highlightTrailingWhitespace()
          : [],
    scrollPastEnd: settings.scrollPastEnd ? scrollPastEnd() : [],
  };
}

export function configurationChanged(key: ConfigurationKey, previous: RichEditorSettings, next: RichEditorSettings): boolean {
  if (key === "indentation") return previous.indentWithTabs !== next.indentWithTabs || previous.tabSize !== next.tabSize;
  if (key === "attributes") return previous.spellcheck !== next.spellcheck;
  return previous[key] !== next[key];
}
