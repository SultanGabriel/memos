# Writing Pen

The installed tldraw 5.5 draw styles expose discrete size, dash, fill, and color,
but not freehand smoothing or streamline. Its public `getStroke` API exposes
size, smoothing, streamline, thinning, simulated pressure, taper, and caps.

`WritingPenTool` inherits `DrawShapeTool` with its existing drawing states and
coalesced pen input. It does not install DOM pointer handlers or change touch
policy. `WritingPenDrawShapeUtil` uses the public shape-util replacement API for
`draw`, forwarding ordinary shapes to the stock implementation. Only marked
Writing Pen strokes use the custom outline for display, hit geometry, selection
indicators, and SVG exports/thumbnails. Existing drawing point collection remains
stock, including its short-distance sampling and pressure normalization.

The local profile is stored as version 1 under `memos-whiteboard-writing-pen`,
following the Rich Editor's guarded JSON/localStorage pattern. Size is a diameter
in canvas units; taper is a distance in canvas units. Smoothing and streamline
range from 0 to 1, thinning from -1 to 1. UI bounds limit size to 1–24 and taper
to 0–100. These are application limits, not claimed SDK limits.

The tool snapshots the profile on pointer-down without consuming/modifying the
event. Inherited drawing states handle all coordinates and input. Long strokes
split by the stock tool keep the same profile across their continuation records.
Each new Writing Pen draw record receives a copy in
`meta.whiteboardWritingPen` at creation. This rendering recipe necessarily travels
with the stroke in the document snapshot, preserving its appearance on reload
and export. There is no backend user-preset resource. Changing/resetting the
local profile never updates existing shape records. Normal draw records stay
untagged, and old documents require no schema migration.

Utility/tool arrays are module constants. Profile reads go through a per-editor
WeakMap callback; preferences are never editor/store construction dependencies.
