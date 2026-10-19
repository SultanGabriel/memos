import { DrawShapeTool, type Editor } from "tldraw";
import { normalizeWritingPen, type WritingPenConfig } from "./config";

export const WRITING_PEN_TOOL_ID = "writing-pen";

/** Inherit stock drawing states, coalesced events, pressure, and pen/palm handling. */
export class WritingPenTool extends DrawShapeTool {
  static override id = WRITING_PEN_TOOL_ID;

  override onPointerDown() {
    // Only snapshot settings; inherited states still handle the event and all input.
    beginWritingPenStroke(this.editor);
  }
}

const profiles = new WeakMap<Editor, { getProfile: () => WritingPenConfig; stroke?: WritingPenConfig }>();

export function attachWritingPenProfile(editor: Editor, getProfile: () => WritingPenConfig) {
  const entry = { getProfile };
  profiles.set(editor, entry);
  return () => {
    if (profiles.get(editor) === entry) profiles.delete(editor);
  };
}

export function beginWritingPenStroke(editor: Editor) {
  const entry = profiles.get(editor);
  if (entry && !editor.isIn(`${WRITING_PEN_TOOL_ID}.drawing`)) entry.stroke = normalizeWritingPen(entry.getProfile());
}

/** Read only at creation: changing the local preset cannot rewrite older shapes. */
export function profileForNewWritingStroke(editor: Editor): WritingPenConfig | undefined {
  const entry = profiles.get(editor);
  if (!entry || !editor.isIn(`${WRITING_PEN_TOOL_ID}.drawing`)) return undefined;
  // Long strokes split into multiple draw records: all use the same creation-time recipe.
  return normalizeWritingPen(entry.stroke ?? entry.getProfile());
}

export function selectWritingPen(editor: Editor) {
  editor.setCurrentTool(WRITING_PEN_TOOL_ID);
}

export const WRITING_PEN_TOOLS = [WritingPenTool];
