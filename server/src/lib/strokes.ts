/**
 * Server-side stroke wire-format helpers.
 *
 * The client owns the canonical stroke utilities (normalize / denormalize
 * coordinates against canvas size, RAF batching, etc.) in
 * `client/src/lib/strokes.ts`, but the server only ever needs to round-trip
 * between the compact `WireStroke` envelope and the in-memory `Stroke`
 * shape used by `gameManager`'s stroke cache. To avoid pulling client-only
 * code (or a DOM dependency) into the server bundle we re-implement the
 * tiny `fromWire` / `toWire` pair here, mirroring the client implementation.
 *
 * Keeping these helpers in `server/src/lib/` lets the `draw:stroke` handler
 * (task 6.3) decode the incoming wire payload before appending it to the
 * stroke cache (Requirement 6.9, Property 11) and lets the join handler
 * (task 6.2) re-encode cached strokes for `strokes:replay`.
 */

import type { Stroke, WireStroke } from '@gendraw/contract';

/**
 * Decode a {@link WireStroke} into the in-memory {@link Stroke} shape used
 * by the server's per-room stroke cache. Inverse of {@link toWire}.
 */
export function fromWire(wire: WireStroke): Stroke {
  return {
    points: wire.pts.map(([x, y]) => ({ x, y })),
    color: wire.c,
    width: wire.w,
    isEraser: wire.e === 1,
  };
}

/**
 * Encode an in-memory {@link Stroke} into the compact {@link WireStroke}
 * envelope used on the `draw:stroke` and `strokes:replay` Socket.IO events.
 * Inverse of {@link fromWire}.
 */
export function toWire(stroke: Stroke): WireStroke {
  return {
    pts: stroke.points.map((point) => [point.x, point.y]),
    c: stroke.color,
    w: stroke.width,
    e: stroke.isEraser ? 1 : 0,
  };
}
