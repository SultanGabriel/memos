import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BACKGROUND_LAYOUTS, backgroundLayers, backgroundLayout } from "@/components/Whiteboard/background-layout";
import { useWhiteboardSession } from "@/hooks/useWhiteboardSession";

afterEach(() => vi.useRealTimers());

describe("whiteboard backgrounds", () => {
  it("maps persisted names and defaults old boards to blank", () => {
    for (const layout of BACKGROUND_LAYOUTS) expect(backgroundLayout(layout)).toBe(layout);
    expect(backgroundLayout("")).toBe("blank");
    expect(backgroundLayout("unknown")).toBe("blank");
    expect(backgroundLayers("blank", 1)).toEqual([]);
    expect(backgroundLayers("lines", 1)[0].angles).toEqual([0]);
    expect(backgroundLayers("isometric", 1)[0].angles).toEqual([0, 60, -60]);
  });

  it("fades fine detail without changing world spacing", () => {
    for (const layout of ["engineering", "graph", "isometric"] as const) {
      const close = backgroundLayers(layout, 1);
      const far = backgroundLayers(layout, 0.05);
      expect(close.map((layer) => layer.spacing)).toEqual([20, 100, 500]);
      expect(far.map((layer) => layer.spacing)).toEqual(close.map((layer) => layer.spacing));
      expect(far[0].opacity).toBe(0);
      expect(far[1].opacity).toBe(0);
      expect(far[2].opacity).toBeGreaterThan(0);
      expect(close[2].opacity).toBeGreaterThan(close[0].opacity);
    }
  });

  it("saves background independently and keeps failed metadata dirty for retry", async () => {
    vi.useFakeTimers();
    const patch = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const getDocument = vi.fn();
    const onDocumentSaved = vi.fn();
    const { result } = renderHook(() => useWhiteboardSession({
      initialTitle: "Board", initialTags: ["work"], initialBackground: "blank", patch, getDocument, onDocumentSaved,
    }));
    act(() => result.current.setBackground("engineering"));
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(result.current.status).toBe("error");
    expect(result.current.isDirty()).toBe(true);
    await act(async () => { await result.current.saveNow(); });
    expect(patch).toHaveBeenLastCalledWith({ whiteboard: { backgroundLayout: "engineering" }, updateMask: ["background_layout"] });
    expect(result.current.background).toBe("engineering");
    expect(result.current.status).toBe("saved");
    expect(getDocument).not.toHaveBeenCalled();
    expect(onDocumentSaved).not.toHaveBeenCalled();
    expect(result.current.isDocumentClean()).toBe(true);
  });
});
