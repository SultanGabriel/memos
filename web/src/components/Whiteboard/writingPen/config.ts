import type { StrokeOptions } from "tldraw";

export interface WritingPenConfig {
  version: 1;
  size: number;
  smoothing: number;
  streamline: number;
  thinning: number;
  simulatePressure: boolean;
  taperStart: number;
  taperEnd: number;
  capStart: boolean;
  capEnd: boolean;
}

export const WRITING_PEN_RANGES = {
  size: { min: 1, max: 24, step: 0.5 },
  smoothing: { min: 0, max: 1, step: 0.05 },
  streamline: { min: 0, max: 1, step: 0.05 },
  thinning: { min: -1, max: 1, step: 0.05 },
  taperStart: { min: 0, max: 100, step: 1 },
  taperEnd: { min: 0, max: 100, step: 1 },
} as const;

export const DEFAULT_WRITING_PEN: Readonly<WritingPenConfig> = Object.freeze({
  version: 1,
  size: 3,
  smoothing: 0.25,
  streamline: 0.1,
  thinning: 0,
  simulatePressure: false,
  taperStart: 0,
  taperEnd: 0,
  capStart: true,
  capEnd: true,
});

export function normalizeWritingPen(value: unknown): WritingPenConfig {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const next = { ...DEFAULT_WRITING_PEN };
  for (const key of Object.keys(WRITING_PEN_RANGES) as (keyof typeof WRITING_PEN_RANGES)[]) {
    const number = input[key];
    const { min, max } = WRITING_PEN_RANGES[key];
    next[key] = typeof number === "number" && Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : DEFAULT_WRITING_PEN[key];
  }
  for (const key of ["simulatePressure", "capStart", "capEnd"] as const) {
    next[key] = typeof input[key] === "boolean" ? input[key] : DEFAULT_WRITING_PEN[key];
  }
  return next;
}

/** Size and taper distances use shape/world units; the other numeric options are ratios. */
export function writingPenStrokeOptions(config: WritingPenConfig, scale = 1, complete = true): StrokeOptions {
  return {
    size: config.size * scale,
    smoothing: config.smoothing,
    streamline: config.streamline,
    thinning: config.thinning,
    simulatePressure: config.simulatePressure,
    start: { taper: config.taperStart * scale, cap: config.capStart },
    end: { taper: config.taperEnd * scale, cap: config.capEnd },
    last: complete,
  };
}
