/**
 * Drawing Toolbar — pro-style controls for the active Drawer.
 * Refactored to resemble a classic MS Paint ribbon with a Tech-Brutalist Web3 aesthetic.
 */

import { useId } from 'react';
import { Pencil, Paintbrush, Eraser, Trash2 } from 'lucide-react';

export type ToolbarProps = {
  color: string;
  onColorChange: (color: string) => void;
  width: number;
  onWidthChange: (width: number) => void;
  isEraser: boolean;
  onEraserToggle: (active: boolean) => void;
  onClear: () => void;
};

export const TOOLBAR_PALETTE: readonly string[] = [
  '#000000', '#4b5563', '#9ca3af', '#ffffff',
  '#ef4444', '#f97316', '#facc15', '#22c55e',
  '#0ea5e9', '#3b82f6', '#7c3aed', '#ec4899',
  '#fda4af', '#fcd34d', '#bef264', '#86efac',
  '#67e8f9', '#a5b4fc', '#c4b5fd', '#f9a8d4',
  '#a16207', '#92400e', '#451a03', '#fde68a',
] as const;

export const MIN_WIDTH = 2;
export const MAX_WIDTH = 30;

const WIDTH_PRESETS: readonly number[] = [2, 5, 10, 18, 28];

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

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
      className="flex items-stretch rounded-lg border border-white/10 bg-[#111] overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.8)]"
    >
      {/* SECTION 1: Tools (3 Columns) */}
      <div className="grid grid-cols-3 gap-1 p-2 border-r border-white/10">
        <button
          type="button"
          aria-label="Pen"
          aria-checked={!isEraser && clampedWidth <= 5}
          onClick={() => {
            if (isEraser) onEraserToggle(false);
            onWidthChange(3);
          }}
          className={[
            'flex items-center justify-center p-2 rounded transition-colors border',
            !isEraser && clampedWidth <= 5
              ? 'bg-[#00FF66]/10 border-[#00FF66] text-[#00FF66]'
              : 'text-white/60 hover:bg-white/5 border-transparent'
          ].join(' ')}
          title="Pen (Thin)"
        >
          <Pencil size={18} />
        </button>
        <button
          type="button"
          aria-label="Brush"
          aria-checked={!isEraser && clampedWidth > 5}
          onClick={() => {
            if (isEraser) onEraserToggle(false);
            onWidthChange(10);
          }}
          className={[
            'flex items-center justify-center p-2 rounded transition-colors border',
            !isEraser && clampedWidth > 5
              ? 'bg-[#00FF66]/10 border-[#00FF66] text-[#00FF66]'
              : 'text-white/60 hover:bg-white/5 border-transparent'
          ].join(' ')}
          title="Brush (Thick)"
        >
          <Paintbrush size={18} />
        </button>
        <button
          type="button"
          aria-label="Eraser"
          aria-checked={isEraser}
          onClick={() => onEraserToggle(!isEraser)}
          className={[
            'flex items-center justify-center p-2 rounded transition-colors border',
            isEraser
              ? 'bg-[#00FF66]/10 border-[#00FF66] text-[#00FF66]'
              : 'text-white/60 hover:bg-white/5 border-transparent'
          ].join(' ')}
          title="Eraser"
        >
          <Eraser size={18} />
        </button>
      </div>

      {/* SECTION 2: Sizes (Vertical Lines) */}
      <div className="flex flex-col justify-center gap-1.5 p-3 border-r border-white/10 min-w-[70px]">
        {WIDTH_PRESETS.map((preset) => {
          const isActive = !isEraser && preset === activePreset;
          return (
            <button
              key={preset}
              onClick={() => onWidthChange(preset)}
              className={[
                'w-full py-1.5 flex justify-center items-center rounded transition-colors',
                isActive ? 'bg-[#00FF66]/20' : 'hover:bg-white/10'
              ].join(' ')}
              title={`${preset}px`}
            >
              <div
                className={['w-8 rounded-full', isActive ? 'bg-[#00FF66]' : 'bg-white/60'].join(' ')}
                style={{ height: Math.max(2, preset / 2) }}
              />
            </button>
          );
        })}
      </div>

      {/* SECTION 3: Colors (Palette) */}
      <div className="flex items-center p-2 border-r border-white/10 gap-3">
        {/* Custom Color Picker Square */}
        <div className="flex flex-col items-center justify-center pl-1 pr-2">
          <label
            htmlFor={customColorId}
            className={[
              'relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border-2 border-white/20 shadow-inner',
              'bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]',
              'hover:scale-110 transition-transform duration-200',
            ].join(' ')}
            title="Choose Custom Color"
          >
            <input
              id={customColorId}
              type="color"
              value={isEraser ? '#ffffff' : color}
              onChange={(e) => {
                if (isEraser) onEraserToggle(false);
                onColorChange(e.target.value);
              }}
              className="opacity-0 absolute w-full h-full cursor-pointer"
            />
          </label>
        </div>

        {/* Dense 2-Row Grid */}
        <div className="grid grid-cols-12 gap-1">
          {TOOLBAR_PALETTE.map((paletteColor) => {
            const isActive = !isEraser && paletteColor.toLowerCase() === color.toLowerCase();
            return (
              <button
                key={paletteColor}
                type="button"
                onClick={() => {
                  if (isEraser) onEraserToggle(false);
                  onColorChange(paletteColor);
                }}
                className={[
                  'w-5 h-5 rounded-sm border transition-transform',
                  isActive 
                    ? 'border-white scale-125 z-10 shadow-[0_0_8px_rgba(255,255,255,0.8)]' 
                    : 'border-white/10 hover:scale-110'
                ].join(' ')}
                style={{ backgroundColor: paletteColor }}
                title={paletteColor}
              />
            );
          })}
        </div>
      </div>

      {/* SECTION 4: Actions */}
      <div className="flex items-center p-3">
        <button
          type="button"
          onClick={onClear}
          className="flex flex-col items-center justify-center gap-1 p-2 rounded hover:bg-white/5 text-white/60 hover:text-pink transition-colors group"
          title="Clear Canvas"
        >
          <Trash2 size={22} className="group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Clear</span>
        </button>
      </div>
    </div>
  );
}

export default Toolbar;
