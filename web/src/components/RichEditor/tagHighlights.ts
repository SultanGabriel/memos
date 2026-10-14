import { syntaxTree, syntaxTreeAvailable } from "@codemirror/language";
import type { Range } from "@codemirror/state";
import { Decoration, type DecorationSet, type EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { findTagMatches } from "@/utils/tag-grammar";

const tagPill = Decoration.mark({ class: "cm-rich-editor-tag" });
const excludedNodes = new Set([
  "FencedCode",
  "CodeBlock",
  "InlineCode",
  "CodeText",
  "Link",
  "Autolink",
  "URL",
  "Image",
  "LinkReference",
  "LinkLabel",
  "HTMLBlock",
  "HTMLTag",
  "CommentBlock",
  "Escape",
]);

function tagDecorations(view: EditorView): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const tree = syntaxTree(view.state);
  for (const { from, to } of view.visibleRanges) {
    // Wait for the parser before styling text that might still be code or a link.
    if (!syntaxTreeAvailable(view.state, to)) continue;
    const excluded: { from: number; to: number }[] = [];
    tree.iterate({
      from,
      to,
      enter(node) {
        if (excludedNodes.has(node.name) || /^(?:ATX|Setext)Heading[1-6]$/.test(node.name)) {
          excluded.push({ from: Math.max(from, node.from), to: Math.min(to, node.to) });
          return false;
        }
      },
    });
    const decorateRun = (start: number, end: number) => {
      const source = view.state.doc.sliceString(start, end);
      for (const match of findTagMatches(source)) {
        decorations.push(tagPill.range(start + match.from, start + match.to));
      }
    };
    let position = from;
    for (const span of excluded) {
      if (span.from > position) decorateRun(position, span.from);
      position = Math.max(position, span.to);
    }
    if (position < to) decorateRun(position, to);
  }
  return Decoration.set(decorations, true);
}

export const tagHighlights = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    private tree: ReturnType<typeof syntaxTree>;

    constructor(view: EditorView) {
      this.tree = syntaxTree(view.state);
      this.decorations = tagDecorations(view);
    }

    update(update: ViewUpdate) {
      const tree = syntaxTree(update.state);
      if (update.docChanged || update.viewportChanged || tree !== this.tree) {
        this.tree = tree;
        this.decorations = tagDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);
