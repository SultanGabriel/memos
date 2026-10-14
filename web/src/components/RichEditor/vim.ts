import type { Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { getCM, vim } from "@replit/codemirror-vim";

export const vimExtension = (enabled: boolean): Extension => (enabled ? vim() : []);

export function watchVimMode(view: EditorView, onMode: (mode: string | null) => void): () => void {
  const cm = getCM(view);
  if (!cm) {
    onMode(null);
    return () => {};
  }
  const update = () => {
    const state = cm.state.vim;
    onMode(!state ? null : state.insertMode ? "INSERT" : state.visualMode ? "VISUAL" : "NORMAL");
  };
  cm.on("vim-mode-change", update);
  update();
  return () => cm.off("vim-mode-change", update);
}
