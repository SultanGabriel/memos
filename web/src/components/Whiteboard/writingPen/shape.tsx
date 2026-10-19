import {
  DrawShapeUtil,
  getDisplayValues,
  getPointsFromDrawSegments,
  getStroke,
  Polygon2d,
  SVGContainer,
  type SvgExportContext,
  type TLDrawShape,
} from "tldraw";
import { normalizeWritingPen, writingPenStrokeOptions } from "./config";
import { profileForNewWritingStroke } from "./tool";

const PROFILE_META = "whiteboardWritingPen";

function strokeProfile(shape: TLDrawShape) {
  const value = shape.meta[PROFILE_META];
  return value && typeof value === "object" && !Array.isArray(value) && value.version === 1 ? normalizeWritingPen(value) : undefined;
}

function outline(shape: TLDrawShape) {
  const profile = strokeProfile(shape);
  if (!profile) return undefined;
  return getStroke(
    getPointsFromDrawSegments(shape.props.segments, shape.props.scaleX, shape.props.scaleY),
    writingPenStrokeOptions(profile, shape.props.scale, shape.props.isComplete),
  );
}

function outlinePath(shape: TLDrawShape) {
  const points = outline(shape);
  if (!points?.length) return "";
  // getStroke already computes the outline; do not add another smoothing pass.
  return `M ${points.map(({ x, y }) => `${x} ${y}`).join(" L ")} Z`;
}

/** Native draw records, with a frozen rendering profile only on Writing Pen strokes. */
export class WritingPenDrawShapeUtil extends DrawShapeUtil {
  override onBeforeCreate(shape: TLDrawShape) {
    if (shape.props.isComplete || shape.meta[PROFILE_META]) return shape;
    const profile = profileForNewWritingStroke(this.editor);
    return profile ? { ...shape, meta: { ...shape.meta, [PROFILE_META]: { ...profile } } } : shape;
  }

  override component(shape: TLDrawShape) {
    if (!strokeProfile(shape)) return super.component(shape);
    return (
      <SVGContainer>
        <path d={outlinePath(shape)} fill={getDisplayValues(this, shape).strokeColor} />
      </SVGContainer>
    );
  }

  override getGeometry(shape: TLDrawShape) {
    const points = outline(shape);
    return points && points.length > 2 ? new Polygon2d({ points, isFilled: true }) : super.getGeometry(shape);
  }

  override getIndicatorPath(shape: TLDrawShape): Path2D {
    return strokeProfile(shape) ? new Path2D(outlinePath(shape)) : super.getIndicatorPath(shape);
  }

  override toSvg(shape: TLDrawShape, ctx: SvgExportContext) {
    if (!strokeProfile(shape)) return super.toSvg(shape, ctx);
    return (
      <g transform={`scale(${1 / shape.props.scale})`}>
        <path d={outlinePath(shape)} fill={getDisplayValues(this, shape, ctx.colorMode).strokeColor} />
      </g>
    );
  }

  override expandSelectionOutlinePx(shape: TLDrawShape) {
    return strokeProfile(shape) ? 0 : super.expandSelectionOutlinePx(shape);
  }
}

// Stable constructor arrays are essential: preference renders must never recreate Editor.
export const WRITING_PEN_SHAPE_UTILS = [WritingPenDrawShapeUtil];
