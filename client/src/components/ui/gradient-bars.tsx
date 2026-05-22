/**
 * GradientBars — animated vertical-bar backdrop. Each bar fades from
 * a saturated colour at the bottom to transparent at the top, scales
 * up to a deterministic height based on its position (taller at the
 * edges, shorter in the middle), and pulses smoothly with a staggered
 * delay so the whole row reads as a slow equalizer.
 *
 * Adapted from the upstream component for our app:
 *  - Fixed positioning is left to the host (we render `absolute
 *    inset-0`); place this inside a container that owns its own bg.
 *  - The default palette is multicolour — each bar pulls its hue from
 *    a HSL ramp so the page picks up the GenDraw rainbow vibe instead
 *    of being a single-colour gradient.
 *  - SSR-safe: uses inline styles + a single `<style>` tag for the
 *    keyframes, no global side-effects.
 */

import React from 'react';

interface GradientBarsProps {
  numBars?: number;
  /** Override every bar with the same `from` colour. When omitted,
   *  each bar pulls its hue from `colors`. */
  gradientFrom?: string;
  /** Top stop colour (defaults to fully transparent so bars fade out
   *  cleanly into the page background). */
  gradientTo?: string;
  /** Pulse duration in seconds. */
  animationDuration?: number;
  /** Optional explicit list of HSL/RGB strings — one per bar. When
   *  shorter than `numBars` we cycle through it. */
  colors?: string[];
  className?: string;
}

const DEFAULT_COLORS = [
  'rgb(252, 211, 77)',  // amber
  'rgb(251, 146, 60)',  // orange
  'rgb(244, 114, 182)', // pink
  'rgb(217, 70, 239)',  // fuchsia
  'rgb(139, 92, 246)',  // violet
  'rgb(99, 102, 241)',  // indigo
  'rgb(59, 130, 246)',  // blue
  'rgb(34, 211, 238)',  // cyan
  'rgb(74, 222, 128)',  // green
  'rgb(250, 204, 21)',  // yellow
];

export const GradientBars: React.FC<GradientBarsProps> = ({
  numBars = 24,
  gradientFrom,
  gradientTo = 'transparent',
  animationDuration = 2,
  colors = DEFAULT_COLORS,
  className = '',
}) => {
  const calculateHeight = (index: number, total: number): number => {
    if (total <= 1) return 100;
    const position = index / (total - 1);
    const maxHeight = 100;
    const minHeight = 30;
    const center = 0.5;
    const distanceFromCenter = Math.abs(position - center);
    const heightPercentage = Math.pow(distanceFromCenter * 2, 1.2);
    return minHeight + (maxHeight - minHeight) * heightPercentage;
  };

  return (
    <>
      <style>{`
        @keyframes gradientBarPulse {
          0%   { transform: scaleY(var(--initial-scale)); }
          100% { transform: scaleY(calc(var(--initial-scale) * 0.7)); }
        }
      `}</style>
      <div
        aria-hidden="true"
        className={`absolute inset-0 z-0 overflow-hidden ${className}`}
      >
        <div
          className="flex h-full"
          style={{
            width: '100%',
            transform: 'translateZ(0)',
            backfaceVisibility: 'hidden',
            WebkitFontSmoothing: 'antialiased',
          }}
        >
          {Array.from({ length: numBars }).map((_, index) => {
            const height = calculateHeight(index, numBars);
            const from =
              gradientFrom !== undefined
                ? gradientFrom
                : (colors[index % colors.length] ?? DEFAULT_COLORS[0]!);
            return (
              <div
                key={index}
                style={{
                  flex: `1 0 calc(100% / ${numBars})`,
                  maxWidth: `calc(100% / ${numBars})`,
                  height: '100%',
                  background: `linear-gradient(to top, ${from}, ${gradientTo})`,
                  transform: `scaleY(${height / 100})`,
                  transformOrigin: 'bottom',
                  transition: 'transform 0.5s ease-in-out',
                  animation: `gradientBarPulse ${animationDuration}s ease-in-out infinite alternate`,
                  animationDelay: `${index * 0.1}s`,
                  outline: '1px solid rgba(0, 0, 0, 0)',
                  boxSizing: 'border-box',
                  // CSS custom property consumed by the keyframes.
                  ['--initial-scale' as never]: String(height / 100),
                }}
              />
            );
          })}
        </div>
      </div>
    </>
  );
};

export default GradientBars;
