/**
 * DrawingCanvas — interactive drawing surface for the active Drawer.
 *
 * Owns an HTML5 `<canvas>` sized to its parent container, accepts pointer
 * input, and emits completed `Stroke` payloads to the parent (which in turn
 * forwards them as `draw:stroke` Socket.IO events).
 *
 * Key behaviors mapped to Requirement 6:
 *  - Req 6.1 — Renders an interactive canvas that accepts pointer input
 *    while the local player is the Drawer (parent decides whether to mount
 *    this component vs `ReadOnlyCanvas`).
 *  - Req 6.2 — High-frequency pointer samples are coalesced through a
 *    `requestAnimationFrame`-driven batcher (`createRafBatcher`) so stroke
 *    rendering commits at ≥ 30 fps without blocking the main thread on
 *    every move event.
 *  - Req 6.3 — On `pointerup`, the in-progress stroke's pixel-space points
 *    are normalized to [0, 1] x [0, 1] via `normalizePoint(p, w, h)` before
 *    being handed to `onStroke`. The toolbar `color` and `width` (and the
 *    `isEraser` flag) flow through unchanged so the wire payload's color
 *    and width match the toolbar (anchors design-doc Property 10).
 *  - Req 6.4 — Calling `clearCanvas()` on the imperative handle wipes the
 *    canvas and invokes the optional `onClear` callback so the parent can
 *    emit a `draw:clear` event.
 *
 * The component holds completed strokes in normalized form so it can
 * faithfully redraw them at any size after a `ResizeObserver`-driven
 * resync of the canvas backing store.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Stroke } from '@gendraw/contract';
import {
  createRafBatcher,
  normalizePoint,
  type Point,
  type RafBatcher,
} from '../../lib/strokes';

/** Imperative handle exposed via `forwardRef`, used by the parent Toolbar. */
export type DrawingCanvasHandle = {
  /**
   * Clear the canvas, drop the in-memory stroke history, and invoke the
   * optional `onClear` callback so the parent can fan the event out over
   * the socket (Req 6.4).
   */
  clearCanvas: () => void;
};

export type DrawingCanvasProps = {
  /** Active toolbar color (hex string). */
  color: string;
  /** Active toolbar stroke width in pixels (expected 2..20 per Req 6.8). */
  width: number;
  /** Whether the eraser tool is currently selected. */
  isEraser: boolean;
  /** Invoked once per completed stroke; payload uses normalized coords. */
  onStroke: (stroke: Stroke) => void;
  /** Invoked when {@link DrawingCanvasHandle.clearCanvas} runs (Req 6.4). */
  onClear?: () => void;
  /** Canvas background color; also doubles as the eraser color (Req 6.8). */
  backgroundColor?: string;
  /** Optional className applied to the wrapping `<div>`. */
  className?: string;
};

/** Default canvas background — matches the dark surface from Requirement 14.1. */
const DEFAULT_BG = '#16162a';

/**
 * Active stroke buffered while the pointer is pressed. Coordinates are kept
 * in canvas-pixel space for live rendering; they are normalized on
 * pointerup before being emitted.
 */
type ActiveStroke = {
  points: Point[];
  color: string;
  width: number;
  isEraser: boolean;
};

export const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(
  function DrawingCanvas(
    {
      color,
      width,
      isEraser,
      onStroke,
      onClear,
      backgroundColor = DEFAULT_BG,
      className,
    },
    ref,
  ) {
    // Refs are used for everything that changes per-frame so we never trigger
    // a React re-render on pointer events — only the underlying canvas pixels
    // change, which is precisely what the RAF batcher coalesces (Req 6.2).
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const completedRef = useRef<Stroke[]>([]);
    const activeRef = useRef<ActiveStroke | null>(null);
    /** Number of active-stroke points already painted to the canvas. */
    const activeDrawnRef = useRef(0);
    const batcherRef = useRef<RafBatcher<Point> | null>(null);
    /** Latest backgroundColor mirrored into a ref for use inside callbacks. */
    const bgRef = useRef(backgroundColor);
    bgRef.current = backgroundColor;

    /** Configure stroke style for the supplied stroke. */
    const applyStyle = useCallback(
      (
        ctx: CanvasRenderingContext2D,
        stroke: { color: string; width: number; isEraser: boolean },
      ) => {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = stroke.width;
        const paint = stroke.isEraser ? bgRef.current : stroke.color;
        ctx.strokeStyle = paint;
        ctx.fillStyle = paint;
      },
      [],
    );

    const fillBackground = useCallback(
      (ctx: CanvasRenderingContext2D, w: number, h: number) => {
        ctx.fillStyle = bgRef.current;
        ctx.fillRect(0, 0, w, h);
      },
      [],
    );

    const drawSegment = useCallback(
      (ctx: CanvasRenderingContext2D, a: Point, b: Point) => {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      },
      [],
    );

    /** Paint a filled circle so single-tap strokes are visible. */
    const drawDot = useCallback(
      (ctx: CanvasRenderingContext2D, p: Point, lineWidth: number) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
      },
      [],
    );

    /** Repaint background plus all completed (and any in-progress) strokes. */
    const redrawAll = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const cw = canvas.width;
      const ch = canvas.height;
      fillBackground(ctx, cw, ch);

      for (const stroke of completedRef.current) {
        const pts = stroke.points;
        const head = pts[0];
        if (!head) continue;
        applyStyle(ctx, stroke);
        const first: Point = { x: head.x * cw, y: head.y * ch };
        if (pts.length === 1) {
          drawDot(ctx, first, stroke.width);
          continue;
        }
        let prev = first;
        for (let i = 1; i < pts.length; i++) {
          const np = pts[i]!;
          const cur: Point = { x: np.x * cw, y: np.y * ch };
          drawSegment(ctx, prev, cur);
          prev = cur;
        }
      }

      const active = activeRef.current;
      if (active && active.points.length > 0) {
        applyStyle(ctx, active);
        const points = active.points;
        if (points.length === 1) {
          drawDot(ctx, points[0]!, active.width);
        } else {
          let prev = points[0]!;
          for (let i = 1; i < points.length; i++) {
            const cur = points[i]!;
            drawSegment(ctx, prev, cur);
            prev = cur;
          }
        }
        activeDrawnRef.current = points.length;
      } else {
        activeDrawnRef.current = 0;
      }
    }, [applyStyle, drawDot, drawSegment, fillBackground]);

    /**
     * Sync the canvas backing store to the parent element's size. Called on
     * mount and whenever the container resizes, so the drawing area always
     * fills its slot and previously emitted strokes redraw correctly.
     */
    useEffect(() => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const sync = () => {
        const rect = container.getBoundingClientRect();
        const w = Math.max(1, Math.floor(rect.width));
        const h = Math.max(1, Math.floor(rect.height));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        redrawAll();
      };

      sync();

      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(sync);
        ro.observe(container);
        return () => ro.disconnect();
      }
      if (typeof window !== 'undefined') {
        window.addEventListener('resize', sync);
        return () => window.removeEventListener('resize', sync);
      }
      return undefined;
    }, [redrawAll]);

    /** Repaint when the eraser background color changes. */
    useEffect(() => {
      redrawAll();
    }, [backgroundColor, redrawAll]);

    /**
     * Flush handler invoked once per animation frame with the points that
     * arrived since the last frame. We render only the unpainted suffix of
     * the active stroke so per-frame work is bounded by samples-per-frame
     * rather than total stroke length (Req 6.2).
     */
    const flushBatch = useCallback(
      (_batch: Point[]) => {
        const canvas = canvasRef.current;
        const active = activeRef.current;
        if (!canvas || !active || active.points.length === 0) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        applyStyle(ctx, active);

        const points = active.points;
        const startIndex = activeDrawnRef.current;
        if (startIndex === 0) {
          // First flush — paint a dot so even a single-tap stroke is visible.
          drawDot(ctx, points[0]!, active.width);
          for (let i = 1; i < points.length; i++) {
            drawSegment(ctx, points[i - 1]!, points[i]!);
          }
        } else {
          // Continue from the last painted point so segments connect cleanly.
          let prev = points[startIndex - 1]!;
          for (let i = startIndex; i < points.length; i++) {
            const cur = points[i]!;
            drawSegment(ctx, prev, cur);
            prev = cur;
          }
        }
        activeDrawnRef.current = points.length;
      },
      [applyStyle, drawDot, drawSegment],
    );

    // Lazily build the RAF batcher; stable across the component's lifetime.
    if (batcherRef.current === null) {
      batcherRef.current = createRafBatcher<Point>(flushBatch);
    }
    useEffect(() => {
      return () => {
        batcherRef.current?.dispose();
        batcherRef.current = null;
      };
    }, []);

    /** Convert a pointer event into canvas-pixel coordinates. */
    const pointFromEvent = useCallback(
      (event: ReactPointerEvent<HTMLCanvasElement>): Point => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const scaleX = rect.width === 0 ? 1 : canvas.width / rect.width;
        const scaleY = rect.height === 0 ? 1 : canvas.height / rect.height;
        return {
          x: (event.clientX - rect.left) * scaleX,
          y: (event.clientY - rect.top) * scaleY,
        };
      },
      [],
    );

    const handlePointerDown = useCallback(
      (event: ReactPointerEvent<HTMLCanvasElement>) => {
        // Mouse: only react to the primary button. Touch / pen always pass.
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        try {
          canvas.setPointerCapture(event.pointerId);
        } catch {
          // Some environments (e.g. JSDOM) don't implement pointer capture.
        }
        const start = pointFromEvent(event);
        activeRef.current = {
          points: [start],
          color,
          width,
          isEraser,
        };
        activeDrawnRef.current = 0;
        batcherRef.current?.push(start);
      },
      [color, isEraser, pointFromEvent, width],
    );

    const handlePointerMove = useCallback(
      (event: ReactPointerEvent<HTMLCanvasElement>) => {
        const active = activeRef.current;
        if (!active) return;
        const next = pointFromEvent(event);
        active.points.push(next);
        batcherRef.current?.push(next);
      },
      [pointFromEvent],
    );

    /**
     * Finalize the active stroke: normalize its points to [0, 1] using the
     * current canvas dimensions, archive it in normalized form, and emit
     * `onStroke` (Req 6.3).
     */
    const finalizeStroke = useCallback(() => {
      const active = activeRef.current;
      const canvas = canvasRef.current;
      activeRef.current = null;
      activeDrawnRef.current = 0;
      if (!active || !canvas) return;
      const cw = canvas.width;
      const ch = canvas.height;
      const stroke: Stroke = {
        points: active.points.map((p) => normalizePoint(p, cw, ch)),
        color: active.color,
        width: active.width,
        isEraser: active.isEraser,
      };
      completedRef.current.push(stroke);
      onStroke(stroke);
    }, [onStroke]);

    const releaseCapture = useCallback(
      (event: ReactPointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        try {
          if (canvas.hasPointerCapture(event.pointerId)) {
            canvas.releasePointerCapture(event.pointerId);
          }
        } catch {
          // Ignore — see comment in handlePointerDown.
        }
      },
      [],
    );

    const handlePointerUp = useCallback(
      (event: ReactPointerEvent<HTMLCanvasElement>) => {
        releaseCapture(event);
        finalizeStroke();
      },
      [finalizeStroke, releaseCapture],
    );

    const handlePointerCancel = useCallback(
      (event: ReactPointerEvent<HTMLCanvasElement>) => {
        // Cancelled stroke: discard without emitting and repaint to clean up.
        releaseCapture(event);
        activeRef.current = null;
        activeDrawnRef.current = 0;
        redrawAll();
      },
      [redrawAll, releaseCapture],
    );

    /** Imperative clear — wipes pixels, drops history, emits `onClear`. */
    const clearCanvas = useCallback(() => {
      completedRef.current = [];
      activeRef.current = null;
      activeDrawnRef.current = 0;
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) fillBackground(ctx, canvas.width, canvas.height);
      }
      onClear?.();
    }, [fillBackground, onClear]);

    useImperativeHandle(ref, () => ({ clearCanvas }), [clearCanvas]);

    return (
      <div
        ref={containerRef}
        className={['relative h-full w-full', className].filter(Boolean).join(' ')}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            backgroundColor,
            // Disable browser scroll/zoom gestures on the canvas so pointer
            // events stream cleanly while drawing on touch devices.
            touchAction: 'none',
            cursor: 'crosshair',
          }}
        />
      </div>
    );
  },
);

export default DrawingCanvas;
