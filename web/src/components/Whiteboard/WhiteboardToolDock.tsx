import { createContext, type ReactNode, useContext } from "react";
import { DefaultStylePanel, DefaultToolbar, PORTRAIT_BREAKPOINT, type TLUiStylePanelProps, useBreakpoint, useReadonly } from "tldraw";
import type { ToolDockPosition } from "./tool-dock-preferences";

export const WhiteboardToolDockContext = createContext<{ toolbar: ToolDockPosition; styles: ToolDockPosition }>({
  toolbar: "bottom",
  styles: "right",
});

/** Layout container for the toolbar and future sibling controls, independent of Editor. */
export function WhiteboardToolDock({ position, children }: { position: ToolDockPosition; children: ReactNode }) {
  return (
    <div className="whiteboard-tool-dock" data-position={position}>
      <div className="whiteboard-tool-dock__content">{children}</div>
    </div>
  );
}

/** Stable tldraw Toolbar slot. Position updates only this layout and toolbar orientation. */
export function WhiteboardToolbar() {
  const { toolbar: position, styles } = useContext(WhiteboardToolDockContext);
  const breakpoint = useBreakpoint();
  const readonly = useReadonly();
  return (
    <WhiteboardToolDock position={position}>
      <DefaultToolbar orientation={position === "left" || position === "right" ? "vertical" : "horizontal"} />
      {styles === position && breakpoint >= PORTRAIT_BREAKPOINT.TABLET_SM && !readonly && <DefaultStylePanel />}
    </WhiteboardToolDock>
  );
}

/** Share an edge/dock with the toolbar when requested; retain the stock mobile popover. */
export function WhiteboardStylePanel(props: TLUiStylePanelProps) {
  const { toolbar, styles } = useContext(WhiteboardToolDockContext);
  if (props.isMobile) return <DefaultStylePanel {...props} />;
  if (toolbar === styles) return null;
  return (
    <WhiteboardToolDock position={styles}>
      <DefaultStylePanel {...props} />
    </WhiteboardToolDock>
  );
}
