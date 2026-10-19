export const BACKGROUND_LAYOUTS = ["blank", "lines", "engineering", "graph", "isometric"] as const;
export type BackgroundLayout = (typeof BACKGROUND_LAYOUTS)[number];

export function backgroundLayout(value: string): BackgroundLayout {
  return BACKGROUND_LAYOUTS.find((layout) => layout === value) ?? "blank";
}

/** World spacing never changes with zoom; only visibility changes. */
export function backgroundLayers(layout: BackgroundLayout, zoom: number) {
  if (layout === "blank") return [];
  const levels = layout === "lines" ? [0] : [0, 1, 2];
  const angles = layout === "lines" ? [0] : layout === "isometric" ? [0, 60, -60] : [0, 90];
  const opacities = layout === "engineering" ? [0.10, 0.19, 0.30] : [0.09, 0.14, 0.20];
  return levels.map((level) => {
    const spacing = 20 * 5 ** level;
    const fade = Math.max(0, Math.min(1, (spacing * zoom - 6) / 12));
    return { level, spacing, angles, opacity: opacities[level] * fade };
  });
}
