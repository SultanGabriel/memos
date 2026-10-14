import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { markdown } from "@codemirror/lang-markdown";
import { codeFolding, foldKeymap, indentOnInput } from "@codemirror/language";
import { search, searchKeymap } from "@codemirror/search";
import { EditorState, Prec } from "@codemirror/state";
import { crosshairCursor, dropCursor, keymap, rectangularSelection } from "@codemirror/view";
import { GFM } from "@lezer/markdown";
import { minimalSetup } from "codemirror";
import { richEditorTheme } from "./theme";
import { tagHighlights } from "./tagHighlights";

export const editorExtensions = () => [
  // basicSetup's bundled features cannot be individually disabled. Keep its
  // stable core and configure optional native extensions in Compartments.
  minimalSetup,
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  dropCursor(),
  rectangularSelection(),
  crosshairCursor(),
  autocompletion(),
  codeFolding(),
  search(),
  keymap.of([...searchKeymap, ...foldKeymap, ...completionKeymap]),
  markdown({ extensions: GFM }),
  tagHighlights,
  Prec.high(richEditorTheme),
];
