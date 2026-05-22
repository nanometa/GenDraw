/**
 * ScoreCounter component.
 *
 * Validates Requirements 10.6, 14.4 (Property 19 — score count-up animation):
 *  - When the `value` prop changes, the displayed value animates from the
 *    previous value to the new value.
 *  - The animation duration is clamped to the inclusive range
 *    `[300, 1000]` ms (Req 14.4). Default is 600 ms.
 *  - For increasing transitions (`oldValue ≤ newValue`) every intermediate
 *    sampled value lies in `[oldValue, newValue]` and is non-decreasing, by
 *    construction: the displayed integer is `Math.round(old + (new - old) * t)`
 *    where `t ∈ [0, 1]` is the eased progress, and `Math.round` is monotonic
 *    in its argument.
 *  - At animation end the displayed value equals the new prop value.
 *
 * Implementation notes:
 *  - We animate via `requestAnimationFrame` so the work happens off the
 *    React commit path — calling `setState` once per frame is fine for a
 *    single counter.
 *  - We track the previous prop value in a ref. On change, we kick off a
 *    new RAF loop and cancel any in-flight one. The "from" value is the
 *    *currently displayed* value, not the previous prop, so an in-progress
 *    animation interrupted by a new value continues smoothly without
 *    snapping back to the prior baseline.
 */

import { useEffect, useRef, useState } from 'react';

export type ScoreCounterProps = {
  /** Target value to display. */
  value: number;
  /**
   * Animation duration in milliseconds. Clamped to `[300, 1000]` per
   * Requirement 14.4. Defaults to 600 ms.
   */
  durationMs?: number;
  /** Optional className passthrough for parent layout / typography. */
  className?: string;
};

/** Inclusive lower / upper bounds for the animation duration (Req 14.4). */
export const MIN_DURATION_MS = 300;
export const MAX_DURATION_MS = 1000;
export const DEFAULT_DURATION_MS = 600;

/**
 * Clamp `value` into the closed interval `[min, max]`. NaN falls through to
 * `min` so a malformed prop produces a valid duration.
 */
function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function ScoreCounter({
  value,
  durationMs = DEFAULT_DURATION_MS,
  className,
}: ScoreCounterProps) {
  // `displayed` is the value the user actually sees on each frame.
  const [displayed, setDisplayed] = useState<number>(value);
  // Mirror of `displayed` we can read synchronously inside the RAF callback
  // without going through the React state update cycle.
  const displayedRef = useRef<number>(value);
  // Handle of the in-flight RAF so we can cancel it when `value` changes
  // again mid-animation, preventing two concurrent loops from racing.
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // No transition: value matches what's already on screen. Keep the ref
    // in sync and skip the animation entirely.
    if (value === displayedRef.current) {
      return;
    }

    const duration = clamp(durationMs, MIN_DURATION_MS, MAX_DURATION_MS);
    const startValue = displayedRef.current;
    const delta = value - startValue;
    const startTime = performance.now();

    // Cancel any previous animation so we don't leak frames or fight a
    // prior loop. The new loop animates from the *current* displayed value
    // to the new target, so transitions chain smoothly.
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const tick = (now: number) => {
      const elapsed = now - startTime;
      // Linear progression. We use linear instead of an easing function so
      // Property 19's monotonicity holds tightly: the underlying float is
      // strictly monotonic in `elapsed`, and Math.round preserves that for
      // increasing transitions (the integer value never decreases between
      // consecutive frames when `delta ≥ 0`).
      const t = elapsed >= duration ? 1 : Math.max(0, elapsed / duration);
      const next = Math.round(startValue + delta * t);

      // Update both the ref (for the next frame's diff calculation) and
      // the React state (for actual rendering).
      displayedRef.current = next;
      setDisplayed(next);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Pin to the exact target on completion to guarantee the final
        // frame equals `value` even if RAF skipped a frame.
        if (next !== value) {
          displayedRef.current = value;
          setDisplayed(value);
        }
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [value, durationMs]);

  return (
    <span
      // Live region so screen readers hear the final score after the
      // animation. We avoid `assertive` to prevent over-announcement on
      // every intermediate tick.
      aria-live="polite"
      className={['tabular-nums', className ?? ''].filter(Boolean).join(' ')}
    >
      {displayed}
    </span>
  );
}

export default ScoreCounter;
