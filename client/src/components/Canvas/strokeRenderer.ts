/**
 * Pure rendering helpers used by `ReadOnlyCanvas` (and reusable by
 * `DrawingCanvas`) to paint normalized strokes onto a 2D canvas context.
 *
 * Validates Requirements 6.6, 6.7:
 *  - Strokes arrive with normalized [0, 1] coordinates and are mapped back to
 *    the local canvas dimensions before being painted (Req 6.6).
 *  - `clearCanvas` repaints the entire canvas with the background color so
 *    the surface is fully cleared on `draw:clear` (Req 6.7).
 *
 * The functions are intentionally pure — they only mutate the supplied 2D
 * context and never reach into the DOM. That keeps them straightforward to
 * unit-test against a `node-canvas`/jsdom 2D context fake.
 */

import type { Stroke } from '@gendraw/contract';
import { denormalizePoint } from '../../lib/strokes';

/** Local canvas pixel size used to denormalize stroke points. */
export interface CanvasSize {
  /** Canvas width in pixels (must be > 0 to render anything meaningful). */
  w: number;
  /** Canvas height in pixels (must be > 0 to render anything meaningful). */
  h: number;
}

/**
 * Repaint the entire canvas with the supplied background color. This is the
 * implementation of the `draw:clear` event for the read-only canvas.
 */
export function clearCanvas(
  ctx: CanvasRenderingContext2D,
  canvasSize: CanvasSize,
  backgroundColor: string,
): void {
  ctx.save();
  // Reset any inherited transform so we always clear the full surface.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvasSize.w, canvasSize.h);
  ctx.restore();
}

/**
 * Render a single stroke onto the canvas context, denormalizing each
 * normalized point to the supplied canvas pixel size.
 *
 * Behavior notes:
 *  - For eraser strokes, paint with `backgroundColor` so the stroke visually
 *    "erases" by overwriting prior pixels with the canvas background
 *    (matches the design's eraser semantics — see Requirement 6.8 toolbar).
 *  - A single-point stroke renders as a filled disc so taps still leave a
 *    visible mark, mirroring how the drawing canvas commits a tap.
 *  - `lineCap`/`lineJoin = 'round'` keeps poly-line strokes smooth at
 *    direction changes, which is the typical pen feel for sketch apps.
 *  - Empty stroke (no points) is a no-op so callers don't need to filter.
 */
export function renderStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  canvasSize: CanvasSize,
  backgroundColor: string,
): void {
  const { points } = stroke;
  if (points.length === 0) return;

  const paintColor = stroke.isEraser ? backgroundColor : stroke.color;

  ctx.save();
  ctx.strokeStyle = paintColor;
  ctx.fillStyle = paintColor;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const firstPoint = points[0];
  if (!firstPoint) {
    // Defensive guard — `points.length === 0` is handled above, but TS
    // narrowing under noUncheckedIndexedAccess still requires this check.
    ctx.restore();
    return;
  }

  if (points.length === 1) {
    const only = denormalizePoint(firstPoint, canvasSize.w, canvasSize.h);
    ctx.beginPath();
    ctx.arc(only.x, only.y, stroke.width / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    const first = denormalizePoint(firstPoint, canvasSize.w, canvasSize.h);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i += 1) {
      const point = points[i];
      if (!point) continue;
      const next = denormalizePoint(point, canvasSize.w, canvasSize.h);
      ctx.lineTo(next.x, next.y);
    }
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Clear the canvas and then paint every stroke in order. Used by the
 * `ReadOnlyCanvas` on mount, on every `strokes` prop change, and on canvas
 * size changes so denormalization stays in sync with the local pixel size.
 */
export function renderAllStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: readonly Stroke[],
  canvasSize: CanvasSize,
  backgroundColor: string,
): void {
  clearCanvas(ctx, canvasSize, backgroundColor);
  for (const stroke of strokes) {
    renderStroke(ctx, stroke, canvasSize, backgroundColor);
  }
}
