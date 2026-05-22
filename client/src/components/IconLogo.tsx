/**
 * IconLogo — text-free brand mark for GenDraw.
 *
 * Visual: a rounded-square tile filled with the site's signature
 * yellow → pink → purple gradient. Inside, three connected nodes
 * (representing decentralised players) sit on a flowing brush curve
 * (representing the act of drawing). The composition reads simultaneously
 * as a "drawing tool" and a "decentralised network" — fitting GenDraw's
 * dual identity (drawing party game + GenLayer on-chain validation).
 *
 * Strictly icon-only — no letters, no wordmark inside the SVG. Use this
 * component anywhere a compact brand stamp is needed (page headers,
 * favicons, future PWA tile assets).
 */

import { useId } from 'react';

export interface IconLogoProps {
  /** Pixel size of the rendered square. Defaults to `48`. */
  size?: number | string;
  className?: string;
  /** Accessible label rendered as `<title>` inside the SVG. */
  title?: string;
}

export function IconLogo({
  size = 48,
  className,
  title = 'GenDraw',
}: IconLogoProps): JSX.Element {
  // Stable per-instance id so multiple logos on the same page don't
  // collide on their gradient `id` attributes.
  const uid = useId().replace(/:/g, '');
  const tileGradientId = `iconLogoTile-${uid}`;
  const nodeGradientId = `iconLogoNode-${uid}`;
  const strokeGradientId = `iconLogoStroke-${uid}`;

  return (
    <svg
      role="img"
      aria-label={title}
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <defs>
        {/* Tile gradient — yellow → pink → purple, the signature
            colour ramp used across the site (gradient buttons,
            wordmark, etc.) so the icon reads as part of the family. */}
        <linearGradient id={tileGradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="55%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>

        {/* Node + stroke share the same off-white colour so the inner
            shapes read clearly on top of the saturated tile. Slight
            opacity on the stroke gives the "brushstroke" feel. */}
        <linearGradient id={strokeGradientId} x1="0" y1="0.5" x2="1" y2="0.5">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.55" />
        </linearGradient>
        <radialGradient id={nodeGradientId} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.85" />
        </radialGradient>
      </defs>

      {/* Tile background — rounded square so the icon stays friendly
          at favicon size while keeping a Web3 / app-tile silhouette. */}
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="14"
        ry="14"
        fill={`url(#${tileGradientId})`}
      />

      {/* Subtle inner rim for depth. */}
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="14"
        ry="14"
        fill="none"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="1.25"
      />

      {/* Brush curve — flowing S-line that ties the three nodes
          together. Reads as both "stroke a brush leaves on canvas"
          and "edges in a small distributed network". */}
      <path
        d="M14 44 C 22 28, 32 50, 42 30 S 56 18, 50 14"
        fill="none"
        stroke={`url(#${strokeGradientId})`}
        strokeWidth="3.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Three node dots — placed on the brush curve so the eye
          travels along the stroke. */}
      <circle cx="14" cy="44" r="4.5" fill={`url(#${nodeGradientId})`} />
      <circle cx="42" cy="30" r="4.5" fill={`url(#${nodeGradientId})`} />
      <circle cx="50" cy="14" r="4.5" fill={`url(#${nodeGradientId})`} />
    </svg>
  );
}

export default IconLogo;
