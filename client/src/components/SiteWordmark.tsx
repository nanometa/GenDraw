/**
 * SiteWordmark — the GenDraw logotype + tagline used as the recurring
 * page header across the app. Pulled into a shared component so every
 * route renders it with the exact same gradient, drop-shadow, and
 * tracking. The size variants let tight pages (Game) drop the tagline
 * while still showing the brand.
 */

export type SiteWordmarkSize = 'sm' | 'md' | 'lg';

export interface SiteWordmarkProps {
  size?: SiteWordmarkSize;
  /** Show the "Draw. Guess. Verified on-chain." tagline. */
  tagline?: boolean;
  className?: string;
}

const SIZE_TO_HEADING: Record<SiteWordmarkSize, string> = {
  /* Single canonical size — everyone uses the same look. The "size"
     prop is kept for backwards compat but all variants now point at
     the same Tailwind classes (the `text-bg-deep` Leaderboard look,
     scaled down ~20% from the original `lg`). */
  sm: 'text-3xl sm:text-4xl md:text-5xl',
  md: 'text-3xl sm:text-4xl md:text-5xl',
  lg: 'text-3xl sm:text-4xl md:text-5xl',
};

const SIZE_TO_TAGLINE: Record<SiteWordmarkSize, string> = {
  sm: 'text-[10px] sm:text-xs',
  md: 'text-[10px] sm:text-xs',
  lg: 'text-[10px] sm:text-xs',
};

export function SiteWordmark({
  size = 'md',
  tagline = true,
  className,
}: SiteWordmarkProps): JSX.Element {
  return (
    <header className={['text-center', className ?? ''].filter(Boolean).join(' ')}>
      <h1
        className={[
          'font-display font-bold leading-none tracking-tight',
          'bg-gradient-to-r from-yellow via-pink to-purple bg-clip-text text-transparent',
          'drop-shadow-[0_3px_0_rgba(0,0,0,0.45)]',
          SIZE_TO_HEADING[size],
        ].join(' ')}
        aria-label="GenDraw"
      >
        GenDraw
      </h1>
      {tagline ? (
        <p
          className={[
            'mt-2 font-semibold uppercase tracking-widest text-white/85',
            SIZE_TO_TAGLINE[size],
          ].join(' ')}
        >
          Draw. Guess.{' '}
          <span className="text-yellow normal-case">Verified on-chain.</span>
        </p>
      ) : null}
    </header>
  );
}

export default SiteWordmark;
