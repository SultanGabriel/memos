import { act, renderHook } from "@testing-library/react";
import type { Editor, TLDrawShape } from "tldraw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_WRITING_PEN, normalizeWritingPen, writingPenStrokeOptions } from "@/components/Whiteboard/writingPen/config";
import { WritingPenDrawShapeUtil } from "@/components/Whiteboard/writingPen/shape";
import { readWritingPen, useWritingPenPreferences, WRITING_PEN_STORAGE_KEY } from "@/components/Whiteboard/writingPen/storage";
import {
  attachWritingPenProfile, beginWritingPenStroke, profileForNewWritingStroke, selectWritingPen, WRITING_PEN_TOOL_ID,
} from "@/components/Whiteboard/writingPen/tool";

// Test our creation/preset boundary without executing the drawing or rendering engine.
vi.mock("tldraw", () => ({
  DrawShapeTool: class {},
  DrawShapeUtil: class { constructor(public editor: Editor) {} },
}));

beforeEach(() => localStorage.removeItem(WRITING_PEN_STORAGE_KEY));
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.removeItem(WRITING_PEN_STORAGE_KEY);
});

describe("Writing Pen local profile", () => {
  it("falls back on absent, corrupt, unsupported, and inaccessible storage", () => {
    expect(readWritingPen()).toEqual(DEFAULT_WRITING_PEN);
    for (const value of ["{broken", "null", "[]", '{"version":2,"size":20}']) {
      localStorage.setItem(WRITING_PEN_STORAGE_KEY, value);
      expect(readWritingPen()).toEqual(DEFAULT_WRITING_PEN);
    }
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(readWritingPen()).toEqual(DEFAULT_WRITING_PEN);
  });

  it("clamps supported ranges, rejects invalid types, and maps actual freehand options", () => {
    const config = normalizeWritingPen({
      size: 999, smoothing: -2, streamline: 3, thinning: -3,
      taperStart: 200, taperEnd: Number.NaN, simulatePressure: "false", capStart: false,
    });
    expect(config).toMatchObject({ size: 24, smoothing: 0, streamline: 1, thinning: -1, taperStart: 100, taperEnd: 0,
      simulatePressure: false, capStart: false });
    expect(normalizeWritingPen({ size: Number.POSITIVE_INFINITY, smoothing: "0.5" })).toEqual(DEFAULT_WRITING_PEN);
    expect(writingPenStrokeOptions(config, 2, false)).toEqual({
      size: 48, smoothing: 0, streamline: 1, thinning: -1, simulatePressure: false,
      start: { taper: 200, cap: false }, end: { taper: 0, cap: true }, last: false,
    });
  });

  it("persists normalized settings and resets to defaults", () => {
    const view = renderHook(() => useWritingPenPreferences());
    act(() => view.result.current.updateSettings({ size: 5, thinning: 0.1, simulatePressure: true }));
    expect(readWritingPen()).toEqual(view.result.current.settings);
    expect(JSON.parse(localStorage.getItem(WRITING_PEN_STORAGE_KEY) ?? "{}")).toMatchObject({ version: 1, size: 5 });
    const reopened = renderHook(() => useWritingPenPreferences());
    expect(reopened.result.current.settings.size).toBe(5);
    act(() => reopened.result.current.reset());
    expect(reopened.result.current.settings).toEqual(DEFAULT_WRITING_PEN);
    expect(readWritingPen()).toEqual(DEFAULT_WRITING_PEN);
  });

  it("keeps settings usable if persistence fails and handles changes from another tab", () => {
    const { result } = renderHook(() => useWritingPenPreferences());
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("full"); });
    act(() => result.current.updateSettings({ size: 7 }));
    expect(result.current.getProfile().size).toBe(7);
    write.mockRestore();
    localStorage.setItem(WRITING_PEN_STORAGE_KEY, JSON.stringify({ ...DEFAULT_WRITING_PEN, size: 9 }));
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: WRITING_PEN_STORAGE_KEY })));
    expect(result.current.settings.size).toBe(9);
    act(() => {
      localStorage.removeItem(WRITING_PEN_STORAGE_KEY);
      window.dispatchEvent(new StorageEvent("storage", { key: WRITING_PEN_STORAGE_KEY }));
    });
    expect(result.current.settings).toEqual(DEFAULT_WRITING_PEN);
  });

  it("selects a separate tool, freezes the stored profile on new strokes, and leaves normal/older strokes alone", () => {
    localStorage.setItem(WRITING_PEN_STORAGE_KEY, JSON.stringify({ ...DEFAULT_WRITING_PEN, size: 6 }));
    const { result } = renderHook(() => useWritingPenPreferences());
    const isIn = vi.fn(() => false);
    const setCurrentTool = vi.fn();
    const editor = { isIn, setCurrentTool } as unknown as Editor;
    const detach = attachWritingPenProfile(editor, result.current.getProfile);
    const util = new WritingPenDrawShapeUtil(editor);
    const shape = { type: "draw", meta: {}, props: { isComplete: false } } as TLDrawShape;
    expect(util.onBeforeCreate(shape)).toBe(shape);
    selectWritingPen(editor);
    expect(setCurrentTool).toHaveBeenCalledWith(WRITING_PEN_TOOL_ID);
    beginWritingPenStroke(editor);
    isIn.mockReturnValue(true); // tldraw has entered the inherited drawing state.
    const created = util.onBeforeCreate(shape);
    expect(created.meta.whiteboardWritingPen).toEqual({ ...DEFAULT_WRITING_PEN, size: 6 });
    expect(shape.meta).toEqual({});
    act(() => result.current.updateSettings({ size: 10, streamline: 0 }));
    expect(util.onBeforeCreate(created)).toBe(created);
    expect(created.meta.whiteboardWritingPen).toEqual({ ...DEFAULT_WRITING_PEN, size: 6 });
    // A continuation record in the same physical stroke retains its original settings.
    expect(util.onBeforeCreate(shape).meta.whiteboardWritingPen).toEqual({ ...DEFAULT_WRITING_PEN, size: 6 });
    isIn.mockReturnValue(false);
    beginWritingPenStroke(editor);
    isIn.mockReturnValue(true);
    expect(util.onBeforeCreate(shape).meta.whiteboardWritingPen).toEqual({ ...DEFAULT_WRITING_PEN, size: 10, streamline: 0 });
    isIn.mockReturnValue(false);
    expect(util.onBeforeCreate(shape)).toBe(shape);
    detach();
    isIn.mockReturnValue(true);
    expect(profileForNewWritingStroke(editor)).toBeUndefined();
  });
});
