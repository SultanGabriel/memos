import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";

export interface MarkdownHeading {
  from: number;
  to: number;
  level: number;
  title: string;
}

/** Extract only headings recognized by the Markdown parser, including Setext headings. */
export function extractHeadings(state: EditorState): MarkdownHeading[] {
  const headings: MarkdownHeading[] = [];
  syntaxTree(state).iterate({
    enter(node) {
      const match = /^(?:ATX|Setext)Heading([1-6])$/.exec(node.name);
      if (!match) return;
      const marks: { from: number; to: number }[] = [];
      const cursor = node.node.cursor();
      if (cursor.firstChild()) {
        do {
          if (cursor.name === "HeaderMark") marks.push({ from: cursor.from, to: cursor.to });
        } while (cursor.nextSibling());
      }
      let title = "";
      let from = node.from;
      for (const mark of marks) {
        title += state.doc.sliceString(from, mark.from);
        from = mark.to;
      }
      title += state.doc.sliceString(from, node.to);
      headings.push({ from: node.from, to: node.to, level: Number(match[1]), title: title.trim() });
      // Inline markup and embedded languages cannot introduce section headings.
      return false;
    },
  });
  return headings;
}

/** Find the nested section path containing a document position. */
export function getHeadingPathAtPosition(headings: readonly MarkdownHeading[], position: number): MarkdownHeading[] {
  const path: MarkdownHeading[] = [];
  for (const heading of headings) {
    if (heading.from > position) break;
    while (path.length && path[path.length - 1].level >= heading.level) path.pop();
    path.push(heading);
  }
  return path;
}
