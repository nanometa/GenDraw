/**
 * Stroke utilities — coordinate normalization, wire-format conversion, and a
 * requestAnimationFrame-based batcher used by the drawing canvas to coalesce
 * high-frequency pointer events into per-frame Socket.IO emissions.
 *
 * Validates Requirements 6.3, 6.6:
 *  - Strokes are emitted with coordinates normalized to [0, 1] relative to the
 *    canvas dimensions (Req 6.3).
 *  - Received strokes are mapped back to the local canvas dimensions when
 *    rendering on a read-only canvas (Req 6.6).
 *
 * Together these helpers anchor Property 10 (stroke coordinate round-trip):
 * `denormalize_{W',H'}(normalize_{W,H}((x, y)))` lands inside the destination
 * canvas regardless of source/destination size.
 */

import type { Stroke, WireStroke } from '@gendraw/contract';

/** A 2D point in either canvas-pixel or normalized [0, 1] space. */
export interface Point {
  x: number;
  y: number;
}

/**
 * Clamp `value` into the inclusive range [`min`, `max`]. Used to defend
 * against pointer events fired slightly outside the canvas bounding box
 * (e.g. when the user drags past the edge before releasing).
 */
function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Convert a canvas-pixel point into normalized [0, 1] x [0, 1] space.
 *
 * Both `w` and `h` must be positive; if a caller passes a non-positive
 * dimension we treat the result as 0 (origin) rather than NaN/Infinity so
 * the wire payload remains well-formed.
 */
export function normalizePoint(p: Point, w: number, h: number): Point {
  const nx = w > 0 ? clamp(p.x / w, 0, 1) : 0;
  const ny = h > 0 ? clamp(p.y / h, 0, 1) : 0;
  return { x: nx, y: ny };
}

/**
 * Convert a normalized [0, 1] x [0, 1] point back into canvas-pixel space
 * for the supplied target canvas size. Inverse of {@link normalizePoint}.
 */
export function denormalizePoint(p: Point, w: number, h: number): Point {
  return { x: p.x * w, y: p.y * h };
}

/**
 * Encode an in-memory Stroke into the compact `WireStroke` form used on the
 * `draw:stroke` Socket.IO event. Field names are shortened so high-frequency
 * stroke broadcasts stay small on the wire.
 */
export function toWire(stroke: Stroke): WireStroke {
  return {
    pts: stroke.points.map((point) => [point.x, point.y]),
    c: stroke.color,
    w: stroke.width,
    e: stroke.isEraser ? 1 : 0,
  };
}

/** Inverse of {@link toWire} — rehydrates a WireStroke into a Stroke. */
export function fromWire(wire: WireStroke): Stroke {
  return {
    points: wire.pts.map(([x, y]) => ({ x, y })),
    color: wire.c,
    width: wire.w,
    isEraser: wire.e === 1,
  };
}

/**
 * Public surface of the requestAnimationFrame batcher returned by
 * {@link createRafBatcher}. `push` queues an item for the next frame flush;
 * `dispose` cancels any pending frame and prevents further flushes.
 */
export interface RafBatcher<T> {
  /** Queue an item for the next batched flush. */
  push: (item: T) => void;
  /** Cancel any pending flush and stop accepting new items. */
  dispose: () => void;
}

/**
 * Minimal subset of the global RAF API we rely on. Declared explicitly so the
 * batcher works in Node test environments (where `requestAnimationFrame` is
 * undefined) by transparently falling back to `setTimeout(0)`.
 */
type RafFn = (cb: (timestamp: number) => void) => number;
type CafFn = (handle: number) => void;

/**
 * Create a per-frame batcher. Items pushed during a frame are buffered and
 * delivered to `flush` exactly once on the next animation frame. When
 * `requestAnimationFrame` is unavailable (e.g. running under Vitest in Node),
 * the batcher falls back to `setTimeout(cb, 0)` and `clearTimeout` so callers
 * can exercise the same code path in tests.
 */
export function createRafBatcher<T>(flush: (batch: T[]) => void): RafBatcher<T> {
  // Resolve scheduling primitives once at construction so behavior is stable
  // even if a test patches `globalThis.requestAnimationFrame` later.
  const g = globalThis as {
    requestAnimationFrame?: RafFn;
    cancelAnimationFrame?: CafFn;
  };
  const hasRaf = typeof g.requestAnimationFrame === 'function';
  const schedule: RafFn = hasRaf
    ? g.requestAnimationFrame!.bind(globalThis)
    : ((cb) => setTimeout(() => cb(Date.now()), 0) as unknown as number);
  const cancel: CafFn = hasRaf && typeof g.cancelAnimationFrame === 'function'
    ? g.cancelAnimationFrame.bind(globalThis)
    : ((handle) => clearTimeout(handle as unknown as ReturnType<typeof setTimeout>));

  let buffer: T[] = [];
  let pending: number | null = null;
  let disposed = false;

  const runFlush = (): void => {
    pending = null;
    if (buffer.length === 0) return;
    const batch = buffer;
    buffer = [];
    flush(batch);
  };

  return {
    push: (item: T): void => {
      if (disposed) return;
      buffer.push(item);
      if (pending === null) {
        pending = schedule(runFlush);
      }
    },
    dispose: (): void => {
      disposed = true;
      if (pending !== null) {
        cancel(pending);
        pending = null;
      }
      buffer = [];
    },
  };
}
