import { useLocalStorage } from "@/hooks/useLocalStorage";

export const TOOL_DOCK_POSITIONS = ["top", "bottom", "left", "right"] as const;
export type ToolDockPosition = (typeof TOOL_DOCK_POSITIONS)[number];
export const TOOL_DOCK_STORAGE_KEY = "memos-whiteboard-toolbar-position";
export const STYLE_DOCK_STORAGE_KEY = "memos-whiteboard-style-panel-position";

export function toolDockPosition(value: unknown, fallback: ToolDockPosition = "bottom"): ToolDockPosition {
  return TOOL_DOCK_POSITIONS.find((position) => position === value) ?? fallback;
}

export function useWhiteboardToolDock() {
  const [stored, setStored] = useLocalStorage<unknown>(TOOL_DOCK_STORAGE_KEY, "bottom");
  const [styleStored, setStyleStored] = useLocalStorage<unknown>(STYLE_DOCK_STORAGE_KEY, "right");
  return {
    position: toolDockPosition(stored),
    setPosition: (value: string) => setStored(toolDockPosition(value)),
    stylePosition: toolDockPosition(styleStored, "right"),
    setStylePosition: (value: string) => setStyleStored(toolDockPosition(value, "right")),
  };
}
