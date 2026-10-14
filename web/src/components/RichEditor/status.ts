import { syntaxTree } from "@codemirror/language";
import { type EditorState, countColumn } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { type MarkdownHeading, extractHeadings, getHeadingPathAtPosition } from "./headings";

export interface RichEditorStatus {
  line: number;
  column: number;
  words: number;
  characters: number;
  selectionLength: number;
  headingPath: string[];
}

// Cache document counts and headings; cursor movement only recomputes position
// and section ancestry. Background parser updates refresh the heading cache.
export function createStatusReporter(onStatus: (status: RichEditorStatus) => void) {
  let document: EditorState["doc"] | undefined;
  let tree: ReturnType<typeof syntaxTree> | undefined;
  let headings: MarkdownHeading[] = [];
  let words = 0;
  let characters = 0;
  let previous = "";
  const report = (state: EditorState) => {
    const documentChanged = document !== state.doc;
    if (documentChanged) {
      document = state.doc;
      const content = document.toString();
      words = content.match(/\S+/gu)?.length ?? 0;
      characters = Array.from(content).length;
    }
    const nextTree = syntaxTree(state);
    if (documentChanged || nextTree !== tree) {
      tree = nextTree;
      headings = extractHeadings(state);
    }
    const position = state.selection.main.head;
    const line = state.doc.lineAt(position);
    const status: RichEditorStatus = {
      line: line.number,
      column: countColumn(line.text, state.tabSize, position - line.from) + 1,
      words,
      characters,
      selectionLength: state.selection.ranges.reduce(
        (total, range) => total + Array.from(state.doc.sliceString(range.from, range.to)).length,
        0,
      ),
      headingPath: getHeadingPathAtPosition(headings, position).map((heading) => heading.title),
    };
    const serialized = JSON.stringify(status);
    if (serialized !== previous) {
      previous = serialized;
      onStatus(status);
    }
  };
  return { extension: EditorView.updateListener.of((update) => report(update.state)), report };
}
