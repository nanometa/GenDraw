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
      className="flex flex-wrap items-center justify-center gap-4 rounded-full border border-white/10 bg-black/40 backdrop-blur-md px-6 py-2 shadow-lg"
    >
      {/* Color palette — 12 × 2 grid */}
      <div
        role="radiogroup"
        aria-label="Brush color"
        className="grid grid-cols-12 gap-1.5"
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
                'h-5 w-5 rounded-full border border-white/20 transition-all duration-200',
                'hover:scale-110 focus:outline-none',
                isActive
                  ? 'ring-2 ring-offset-2 ring-offset-black ring-[#00FF66] scale-110'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
          );
        })}
      </div>

      {/* Vertical separator */}
      <div className="h-6 w-px bg-white/10 mx-1" />

      {/* Custom color picker */}
      <label
        htmlFor={customColorId}
        title="Pick a custom color"
        aria-label="Custom color"
        className={[
          'relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-white/30',
          'bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]',
          'hover:scale-110 transition-transform duration-200',
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

      {/* Vertical separator */}
      <div className="h-6 w-px bg-white/10 mx-1" />

      {/* Width presets */}
      <div
        role="radiogroup"
        aria-label="Brush size"
        className="flex items-center gap-2"
      >
        {WIDTH_PRESETS.map((preset) => {
          const isActive = !isEraser && preset === activePreset;
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
                'flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200',
                'hover:bg-white/10 focus:outline-none',
                isActive ? 'bg-white/10 ring-1 ring-[#00FF66]' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span
                aria-hidden="true"
                style={{
                  backgroundColor: dotColor,
                  width: `${Math.min(preset, 20)}px`,
                  height: `${Math.min(preset, 20)}px`,
                  borderRadius: '50%',
                  display: 'block',
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

      {/* Vertical separator */}
      <div className="h-6 w-px bg-white/10 mx-1" />

      {/* Tool group — pen / brush / marker / eraser. */}
      <div
        role="radiogroup"
        aria-label="Drawing tool"
        className="flex items-center gap-1"
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
            'rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest transition-all duration-200',
            'focus:outline-none',
            !isEraser && clampedWidth <= 5
              ? 'bg-[#00FF66] text-black shadow-[0_0_10px_rgba(0,255,102,0.3)]'
              : 'text-white/60 hover:bg-white/10 hover:text-white',
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
            'rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest transition-all duration-200',
            'focus:outline-none',
            !isEraser && clampedWidth > 5 && clampedWidth <= 18
              ? 'bg-[#00FF66] text-black shadow-[0_0_10px_rgba(0,255,102,0.3)]'
              : 'text-white/60 hover:bg-white/10 hover:text-white',
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
            'rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest transition-all duration-200',
            'focus:outline-none',
            !isEraser && clampedWidth > 18
              ? 'bg-[#00FF66] text-black shadow-[0_0_10px_rgba(0,255,102,0.3)]'
              : 'text-white/60 hover:bg-white/10 hover:text-white',
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
            'rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest transition-all duration-200',
            'focus:outline-none',
            isEraser
              ? 'bg-[#00FF66] text-black shadow-[0_0_10px_rgba(0,255,102,0.3)]'
              : 'text-white/60 hover:bg-white/10 hover:text-white',
          ].join(' ')}
        >
          Eraser
        </button>
      </div>

      {/* Vertical separator */}
      <div className="h-6 w-px bg-white/10 mx-1" />

      {/* Clear button */}
      <button
        type="button"
        onClick={onClear}
        className={[
          'rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest transition-all duration-200',
          'border border-red-500/40 bg-red-500/10 text-red-400',
          'hover:bg-red-500/20 hover:border-red-500/60 hover:text-red-300',
          'focus:outline-none',
        ].join(' ')}
      >
        Clear
      </button>
    </div>
  );
}

export default Toolbar;
