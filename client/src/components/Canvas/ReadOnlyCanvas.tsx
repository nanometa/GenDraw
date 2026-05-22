/**
 * Read-only drawing surface shown to Guessers while a round is active.
 *
 * Validates Requirements 6.5, 6.6, 6.7, 6.9:
 *  - The `<canvas>` is rendered with no pointer interaction so Guessers
 *    cannot draw on it (Req 6.5). We disable pointer events with CSS and
 *    do not attach any pointer/touch handlers.
 *  - On every `strokes` prop change, and on canvas size changes, we redraw
 *    the full stroke list by denormalizing each point against the current
 *    canvas pixel size (Req 6.6). This keeps the rendered drawing aligned
 *    with the source canvas regardless of viewport size.
 *  - Clearing is implicit in the controlled `strokes` array: when the
 *    parent applies a `draw:clear` by emptying the array (or replacing it
 *    with a shorter prefix), the canvas re-renders without the cleared
 *    strokes (Req 6.7).
 *  - Replay-on-mount: because the component renders whatever the parent
 *    passes in, when `Game.tsx` (task 12.6) seeds the `strokes` prop with
 *    the `strokes:replay` payload from the server, the joiner sees the
 *    in-progress drawing immediately on mount (Req 6.9).
 *
 * The component is intentionally controlled — it owns no stroke state of
 * its own. Parents merge incoming `draw:stroke` / `draw:clear` events into
 * the array passed via props, which keeps this component's responsibility
 * narrow and trivially testable.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Stroke } from '@gendraw/contract';
import { renderAllStrokes } from './strokeRenderer';

/** Default theme background color (matches Requirement 14.1 surface color). */
const DEFAULT_BACKGROUND = '#16162a';

export type ReadOnlyCanvasProps = {
  /** All strokes that should be visible (controlled). Re-renders on change. */
  strokes: Stroke[];
  /** Background color used for clearing and for eraser strokes. */
  backgroundColor?: string;
  /** Optional class applied to the wrapping element for layout sizing. */
  className?: string;
};

/**
 * Synchronize the underlying `<canvas>` backing-store size with its CSS
 * box size and the device pixel ratio. We scale the 2D context so all draw
 * commands continue to use CSS-pixel coordinates while the bitmap stays
 * crisp on high-DPI displays.
 *
 * Returns the CSS-pixel size used to denormalize stroke points; returns
 * null when the canvas has no size yet (initial layout pass).
 */
function syncCanvasBackingStore(
  canvas: HTMLCanvasElement,
): { w: number; h: number } | null {
  const rect = canvas.getBoundingClientRect();
  const cssW = Math.floor(rect.width);
  const cssH = Math.floor(rect.height);
  if (cssW <= 0 || cssH <= 0) return null;

  const dpr = typeof window !== 'undefined' && window.devicePixelRatio
    ? window.devicePixelRatio
    : 1;
  const targetW = Math.floor(cssW * dpr);
  const targetH = Math.floor(cssH * dpr);
  if (canvas.width !== targetW) canvas.width = targetW;
  if (canvas.height !== targetH) canvas.height = targetH;

  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Reset any prior transform before applying the DPR scale so repeated
    // syncs don't compound the scale factor.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  return { w: cssW, h: cssH };
}

export function ReadOnlyCanvas({
  strokes,
  backgroundColor = DEFAULT_BACKGROUND,
  className,
}: ReadOnlyCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Tracks the latest CSS-pixel canvas size. Used as a render dependency so
  // the paint effect re-runs whenever the canvas resizes (Req 6.6).
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  // Observe canvas size changes (responsive layouts, window resize) and
  // re-sync the backing store. We use a layout effect so the first sync
  // happens before paint and ResizeObserver picks up subsequent changes.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const sync = (): void => {
      const next = syncCanvasBackingStore(canvas);
      if (next) {
        setSize((prev) =>
          prev && prev.w === next.w && prev.h === next.h ? prev : next,
        );
      }
    };

    sync();

    // ResizeObserver may not be defined in older test environments; guard
    // its access so the component still mounts cleanly there.
    const RO: typeof ResizeObserver | undefined =
      typeof ResizeObserver !== 'undefined' ? ResizeObserver : undefined;
    if (!RO) {
      // Fall back to window resize so we still re-sync on viewport changes.
      window.addEventListener('resize', sync);
      return () => window.removeEventListener('resize', sync);
    }

    const observer = new RO(() => sync());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // Re-render every time the strokes array, canvas size, or background
  // color changes. `strokes` is a controlled prop owned by the parent, so
  // this single effect handles both the initial replay and incremental
  // appends transparently.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderAllStrokes(ctx, strokes, size, backgroundColor);
  }, [strokes, size, backgroundColor]);

  return (
    <div
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      <canvas
        ref={canvasRef}
        aria-label="Drawing canvas (read only)"
        role="img"
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          // Disable pointer interaction (Req 6.5) — no pointer/touch handlers
          // are attached and CSS pointer-events: none guarantees the canvas
          // is inert even if a parent forwards events.
          pointerEvents: 'none',
          backgroundColor,
          touchAction: 'none',
        }}
      />
    </div>
  );
}

export default ReadOnlyCanvas;
