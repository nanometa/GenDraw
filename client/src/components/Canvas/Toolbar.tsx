/**
 * Drawing Toolbar — pro-style controls for the active Drawer.
 *
 * Layout (Requirement 6.8 — "at least 8 colors", line-width control,
 * eraser, clear):
 *   1. 24-color grid palette covering monochromes, primaries, secondary
 *      accents, pastels, and skin tones — gives the drawer enough range
 *      for a Gartic-style party board without leaving the toolbar.
 *   2. Visual brush-size selector with 5 preset chips that render the
 *      stroke as an actual filled circle so the user picks by sight.
 *   3. Eraser toggle — when active the canvas paints with the
 *      background color (white, owned by the parent).
 *   4. Clear button — wipes the canvas.
 *
 * Component is fully controlled: every change is reported via the
 * matching callback prop. The parent owns `color`, `width`, and
 * `isEraser`.
 */

import { useId } from 'react';

export type ToolbarProps = {
  color: string;
  onColorChange: (color: string) => void;
  /** Stroke width in pixels. Must be in the inclusive range [2, 30]. */
  width: number;
  onWidthChange: (width: number) => void;
  isEraser: boolean;
  onEraserToggle: (active: boolean) => void;
  onClear: () => void;
};

/**
 * 24-swatch palette laid out as a 12 × 2 grid. Order:
 *   row 1 — monochrome ramp + primaries + secondaries.
 *   row 2 — pastels + skin tones + earth tones.
 *
 * Picked to give a balanced range without overlapping shades. Every
 * entry is a 6-digit hex literal so a property test can verify the
 * round-trip into stroke metadata is identity.
 */
export const TOOLBAR_PALETTE: readonly string[] = [
  // row 1 — bold tones (12)
  '#000000', '#4b5563', '#9ca3af', '#ffffff',
  '#ef4444', '#f97316', '#facc15', '#22c55e',
  '#0ea5e9', '#3b82f6', '#7c3aed', '#ec4899',
  // row 2 — soft / earth tones (12)
  '#fda4af', '#fcd34d', '#bef264', '#86efac',
  '#67e8f9', '#a5b4fc', '#c4b5fd', '#f9a8d4',
  '#a16207', '#92400e', '#451a03', '#fde68a',
] as const;

/** Inclusive lower / upper bounds for the line-width control. */
export const MIN_WIDTH = 2;
export const MAX_WIDTH = 30;

/**
 * Brush-size presets shown as filled-circle chips. The user picks by
 * sight; the slider is gone but the underlying width range still
 * carries through `onWidthChange`.
 */
const WIDTH_PRESETS: readonly number[] = [2, 5, 10, 18, 28];

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** Closest preset to `width` — used to render the active chip. */
function pickClosestPreset(width: number): number {
  let best = WIDTH_PRESETS[0]!;
  let bestDelta = Math.abs(width - best);
  for (const w of WIDTH_PRESETS) {
    const delta = Math.abs(width - w);
    if (delta < bestDelta) {
      best = w;
      bestDelta = delta;
    }
  }
  return best;
}

export function Toolbar({
  color,
  onColorChange,
  width,
  onWidthChange,
  isEraser,
  onEraserToggle,
  onClear,
}: ToolbarProps) {
  const customColorId = useId();
  const clampedWidth = clamp(width, MIN_WIDTH, MAX_WIDTH);
  const activePreset = pickClosestPreset(clampedWidth);

  return (
    <div
      role="toolbar"
      aria-label="Drawing toolbar"
      className="flex flex-wrap items-center gap-3 rounded-2xl glass px-4 py-3 text-white"
    >
      {/* Color palette — 12 × 2 grid */}
      <div
        role="radiogroup"
        aria-label="Brush color"
        className="grid grid-cols-12 gap-1"
      >
        {TOOLBAR_PALETTE.map((paletteColor) => {
          const isActive =
            !isEraser && paletteColor.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={paletteColor}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={`Color ${paletteColor}`}
              title={paletteColor}
              onClick={() => {
                if (isEraser) onEraserToggle(false);
                onColorChange(paletteColor);
              }}
              style={{ backgroundColor: paletteColor }}
              className={[
                'h-6 w-6 rounded-md border border-white/20 transition',
                'hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow',
                isActive
                  ? 'ring-2 ring-offset-2 ring-offset-bg-deep ring-yellow'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
          );
        })}
      </div>

      {/* Custom color picker — fills the gap when the user wants
          something outside the palette. The native swatch UI is
          replaced by a single tiny chip + an absolutely-positioned
          input that opens the color dialog on click. */}
      <label
        htmlFor={customColorId}
        title="Pick a custom color"
        aria-label="Custom color"
        className={[
          'relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-white/30',
          'bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]',
          'hover:scale-110 transition',
        ].join(' ')}
      >
        <input
          id={customColorId}
          type="color"
          value={isEraser ? '#ffffff' : color}
          onChange={(event) => {
            if (isEraser) onEraserToggle(false);
            onColorChange(event.target.value);
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>

      {/* Width presets — filled circles, biggest = boldest brush. */}
      <div
        role="radiogroup"
        aria-label="Brush size"
        className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 backdrop-blur"
      >
        {WIDTH_PRESETS.map((preset) => {
          const isActive = !isEraser && preset === activePreset;
          // Render the chip with the *current* color so the user
          // previews the brush before drawing.
          const dotColor = isEraser ? '#ffffff' : color;
          return (
            <button
              key={preset}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={`Brush size ${preset} pixels`}
              title={`${preset}px`}
              onClick={() => onWidthChange(preset)}
              className={[
                'flex h-7 w-7 items-center justify-center rounded-md transition',
                'hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow',
                isActive ? 'bg-white/15 ring-2 ring-yellow' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span
                aria-hidden="true"
                style={{
                  backgroundColor: dotColor,
                  width: `${Math.min(preset, 18)}px`,
                  height: `${Math.min(preset, 18)}px`,
                  borderRadius: '9999px',
                  display: 'inline-block',
                  border:
                    dotColor.toLowerCase() === '#ffffff'
                      ? '1px solid rgba(255,255,255,0.45)'
                      : '0',
                }}
              />
            </button>
          );
        })}
      </div>

      {/* Tool group — pen / brush / eraser. Pen and brush are mode
          presets: pen snaps to a thin width (3px) and brush gives the
          drawer a fatter mark (12px). Eraser swaps the paint colour
          for the canvas background — the actual swap happens inside
          DrawingCanvas via `applyStyle`. The selected tool ring uses
          the yellow accent so the user can tell at a glance. */}
      <div
        role="radiogroup"
        aria-label="Drawing tool"
        className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1 backdrop-blur"
      >
        <button
          type="button"
          role="radio"
          aria-checked={!isEraser && clampedWidth <= 5}
          onClick={() => {
            if (isEraser) onEraserToggle(false);
            onWidthChange(3);
          }}
          className={[
            'rounded-lg px-3 py-1 text-xs font-bold uppercase tracking-widest transition',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow',
            !isEraser && clampedWidth <= 5
              ? 'bg-yellow text-bg-deep'
              : 'text-white/65 hover:bg-white/10 hover:text-white/90',
          ].join(' ')}
        >
          Pen
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={!isEraser && clampedWidth > 5 && clampedWidth <= 18}
          onClick={() => {
            if (isEraser) onEraserToggle(false);
            onWidthChange(10);
          }}
          className={[
            'rounded-lg px-3 py-1 text-xs font-bold uppercase tracking-widest transition',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow',
            !isEraser && clampedWidth > 5 && clampedWidth <= 18
              ? 'bg-yellow text-bg-deep'
              : 'text-white/65 hover:bg-white/10 hover:text-white/90',
          ].join(' ')}
        >
          Brush
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={!isEraser && clampedWidth > 18}
          onClick={() => {
            if (isEraser) onEraserToggle(false);
            onWidthChange(24);
          }}
          className={[
            'rounded-lg px-3 py-1 text-xs font-bold uppercase tracking-widest transition',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow',
            !isEraser && clampedWidth > 18
              ? 'bg-yellow text-bg-deep'
              : 'text-white/65 hover:bg-white/10 hover:text-white/90',
          ].join(' ')}
        >
          Marker
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={isEraser}
          onClick={() => onEraserToggle(!isEraser)}
          className={[
            'rounded-lg px-3 py-1 text-xs font-bold uppercase tracking-widest transition',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow',
            isEraser
              ? 'bg-yellow text-bg-deep'
              : 'text-white/65 hover:bg-white/10 hover:text-white/90',
          ].join(' ')}
        >
          Eraser
        </button>
      </div>

      {/* Clear button */}
      <button
        type="button"
        onClick={onClear}
        className={[
          'rounded-xl px-3 py-1.5 text-sm font-semibold tracking-tight transition',
          'border border-pink/40 bg-pink/15 text-pink-bright backdrop-blur',
          'hover:bg-pink/25 hover:border-pink/60 hover:text-white',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-pink',
        ].join(' ')}
      >
        Clear
      </button>
    </div>
  );
}

export default Toolbar;
