import type { Extension } from "@codemirror/state";
import { EditorView, ViewPlugin } from "@codemirror/view";
import {
  codeBlockField,
  collapseOnSelectionFacet,
  editorTheme,
  imageField,
  linkPlugin,
  livePreviewPlugin,
  markdownStylePlugin,
  mouseSelectingField,
  setMouseSelecting,
  tableField,
} from "codemirror-live-markdown";

// Keep the library's drag-selection lifecycle scoped to the editor's lifetime.
const mouseSelection = ViewPlugin.define((view) => {
  let frame = 0;
  const finish = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => view.dispatch({ effects: setMouseSelecting.of(false) }));
  };
  view.dom.ownerDocument.addEventListener("mouseup", finish);
  return {
    destroy() {
      cancelAnimationFrame(frame);
      view.dom.ownerDocument.removeEventListener("mouseup", finish);
    },
  };
});

export function livePreviewExtensions(): Extension {
  return [
    collapseOnSelectionFacet.of(true),
    mouseSelectingField,
    livePreviewPlugin,
    markdownStylePlugin,
    editorTheme,
    tableField,
    codeBlockField({ copyButton: true }),
    imageField(),
    linkPlugin(),
    mouseSelection,
    EditorView.domEventHandlers({
      mousedown(_event, view) {
        view.dispatch({ effects: setMouseSelecting.of(true) });
        return false;
      },
      blur(_event, view) {
        view.dispatch({ effects: setMouseSelecting.of(false) });
        return false;
      },
    }),
  ];
}
