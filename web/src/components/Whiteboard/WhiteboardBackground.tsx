import { createContext, useContext, useId } from "react";
import { useEditor, useValue } from "tldraw";
import { backgroundLayers, type BackgroundLayout } from "./background-layout";
import { WhiteboardStylePanel, WhiteboardToolbar } from "./WhiteboardToolDock";

export const WhiteboardBackgroundContext = createContext<BackgroundLayout>("blank");

/** tldraw background slot: SVG clips to the viewport and stays outside document records. */
function WhiteboardBackground() {
  const layout = useContext(WhiteboardBackgroundContext);
  const editor = useEditor();
  const camera = useValue("whiteboard background camera", () => editor.getCamera(), [editor]);
  const id = useId().replace(/:/g, "");
  const layers = backgroundLayers(layout, camera.z);
  return (
    <div className="tl-background whiteboard-background" style={{ pointerEvents: "none" }}>
      <svg width="100%" height="100%" aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <defs>
          {layers.flatMap(({ level, spacing, angles }) => angles.map((angle) => (
            <pattern
              key={`${level}:${angle}`}
              id={`${id}-${level}-${angle}`}
              width={spacing}
              height={spacing}
              patternUnits="userSpaceOnUse"
              patternTransform={`translate(${camera.x * camera.z} ${camera.y * camera.z}) scale(${camera.z}) rotate(${angle})`}
            >
              <path d={`M 0 0 H ${spacing}`} fill="none" stroke="currentColor" strokeWidth={1 / camera.z} />
            </pattern>
          )))}
        </defs>
        {layers.flatMap(({ level, angles, opacity }) => angles.map((angle) => (
          <rect key={`${level}:${angle}`} width="100%" height="100%" fill={`url(#${id}-${level}-${angle})`} opacity={opacity} />
        )))}
      </svg>
    </div>
  );
}

// Module-level identity: changing metadata must never replace the editor configuration.
export const WHITEBOARD_COMPONENTS = {
  Background: WhiteboardBackground,
  Grid: null,
  Toolbar: WhiteboardToolbar,
  StylePanel: WhiteboardStylePanel,
};
