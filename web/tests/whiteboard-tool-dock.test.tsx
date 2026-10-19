import { act, render, renderHook, screen } from "@testing-library/react";
import type { TLUiStylePanelProps } from "tldraw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STYLE_DOCK_STORAGE_KEY, TOOL_DOCK_STORAGE_KEY, useWhiteboardToolDock } from "@/components/Whiteboard/tool-dock-preferences";
import { WhiteboardStylePanel, WhiteboardToolbar, WhiteboardToolDockContext } from "@/components/Whiteboard/WhiteboardToolDock";

const device = vi.hoisted(() => ({ breakpoint: 6 }));
vi.mock("tldraw", () => ({
  DefaultToolbar: ({ orientation }: { orientation: string }) => <div data-testid="toolbar" data-orientation={orientation} />,
  DefaultStylePanel: ({ isMobile }: TLUiStylePanelProps) => <div data-testid="style-panel" data-mobile={String(Boolean(isMobile))} />,
  PORTRAIT_BREAKPOINT: { TABLET_SM: 5 },
  useBreakpoint: () => device.breakpoint,
  useReadonly: () => false,
}));

beforeEach(() => {
  localStorage.removeItem(TOOL_DOCK_STORAGE_KEY);
  localStorage.removeItem(STYLE_DOCK_STORAGE_KEY);
  device.breakpoint = 6;
});

describe("Whiteboard docks", () => {
  it("uses independent local defaults, persists positions, and handles invalid configuration", () => {
    const first = renderHook(() => useWhiteboardToolDock());
    expect(first.result.current.position).toBe("bottom");
    expect(first.result.current.stylePosition).toBe("right");
    act(() => {
      first.result.current.setPosition("left");
      first.result.current.setStylePosition("top");
    });
    expect(JSON.parse(localStorage.getItem(TOOL_DOCK_STORAGE_KEY) ?? "null")).toBe("left");
    const reopened = renderHook(() => useWhiteboardToolDock());
    expect(reopened.result.current.position).toBe("left");
    expect(reopened.result.current.stylePosition).toBe("top");
    localStorage.setItem(TOOL_DOCK_STORAGE_KEY, "{broken");
    localStorage.setItem(STYLE_DOCK_STORAGE_KEY, JSON.stringify("unknown"));
    const invalid = renderHook(() => useWhiteboardToolDock());
    expect(invalid.result.current.position).toBe("bottom");
    expect(invalid.result.current.stylePosition).toBe("right");
  });

  it("changes orientation without replacing the toolbar and groups controls on a shared edge", () => {
    const tree = (toolbar: "bottom" | "left", styles: "top" | "left") => (
      <WhiteboardToolDockContext value={{ toolbar, styles }}>
        <WhiteboardToolbar />
        <WhiteboardStylePanel />
      </WhiteboardToolDockContext>
    );
    const view = render(tree("bottom", "top"));
    const toolbar = screen.getByTestId("toolbar");
    expect(toolbar).toHaveAttribute("data-orientation", "horizontal");
    expect(screen.getByTestId("style-panel").closest(".whiteboard-tool-dock")).toHaveAttribute("data-position", "top");
    view.rerender(tree("left", "left"));
    expect(screen.getByTestId("toolbar")).toBe(toolbar);
    expect(toolbar).toHaveAttribute("data-orientation", "vertical");
    expect(screen.getAllByTestId("style-panel")).toHaveLength(1);
    expect(screen.getByTestId("style-panel").closest(".whiteboard-tool-dock")).toBe(toolbar.closest(".whiteboard-tool-dock"));
  });

  it("leaves the narrow-screen color popover stock and avoids a duplicate shared panel", () => {
    device.breakpoint = 3;
    render(
      <WhiteboardToolDockContext value={{ toolbar: "bottom", styles: "bottom" }}>
        <WhiteboardToolbar />
        <WhiteboardStylePanel isMobile />
      </WhiteboardToolDockContext>,
    );
    expect(screen.getAllByTestId("style-panel")).toHaveLength(1);
    expect(screen.getByTestId("style-panel")).toHaveAttribute("data-mobile", "true");
    expect(screen.getByTestId("style-panel").closest(".whiteboard-tool-dock")).toBeNull();
  });
});
