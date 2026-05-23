/**
 * Home page — 3-section scroll experience.
 *
 *   1. Draw       → Create Room form
 *   2. Guess      → Join Room form
 *   3. Validator  → Weekly leaderboard
 *
 * Each section's `title` is a single short word that runs through the
 * scroll-fx widget's masked-word animation. The actual interactive
 * content (form / leaderboard) lives in the `content` slot underneath
 * the title so the animation stays clean.
 *
 * The floating tab navigation lets the user jump straight to a section,
 * and the active tab follows the user's scroll position via
 * `onIndexChange`.
 */

import { useRef, useState } from 'react';

import {
  FullScreenScrollFX,
  type FullScreenFXAPI,
} from '@/components/ui/full-screen-scroll-fx';
import SiteWordmark from '../components/SiteWordmark';
import InlineCreatePanel from './home/InlineCreatePanel';
import InlineJoinPanel from './home/InlineJoinPanel';
import InlineLeaderboardPanel from './home/InlineLeaderboardPanel';

/**
 * Background photos for the three slides. Picked to match the
 * conceptual idea of each section: drawing tools, multiplayer
 * gathering, blockchain / verification.
 *
 * (Currently unused — the global AnimatedDots backdrop in App.tsx is
 *  the only visual layer behind the slideshow now. Kept as a
 *  reference for re-enabling photo backgrounds later.)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _SLIDE_BG = {
  draw: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1920&q=80',
  guess:
    'https://images.unsplash.com/photo-1606092195730-5d7b9af1efc5?auto=format&fit=crop&w=1920&q=80',
  validator:
    'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1920&q=80',
} as const;

const TABS = [
  { label: 'Create Room' },
  { label: 'Join Room' },
  { label: 'Leaderboard' },
] as const;

export default function Home(): JSX.Element {
  const apiRef = useRef<FullScreenFXAPI>(null);
  /** Index of the visible slideshow section (0..2). */
  const [activeIndex, setActiveIndex] = useState<number>(0);

  // The slideshow no longer paints photo backgrounds — the global
  // AnimatedDots backdrop in `App.tsx` plays that role for the whole
  // site. Each slide passes an empty string so the scroll-fx widget
  // skips its `<img>` render and the dots show through cleanly.
  const sections = [
    {
      id: 'create',
      leftLabel: '',
      rightLabel: '',
      title: 'Create Room',
      content: <InlineCreatePanel />,
      background: '',
    },
    {
      id: 'join',
      leftLabel: '',
      rightLabel: '',
      title: 'Join Room',
      content: <InlineJoinPanel />,
      background: '',
    },
    {
      id: 'leaderboard',
      leftLabel: '',
      rightLabel: '',
      title: 'Leaderboard',
      content: <InlineLeaderboardPanel />,
      background: '',
    },
  ];

  return (
    <main className="relative min-h-full no-scrollbar">
      {/* Graffiti Hero Title Overlay */}
      <div className="pointer-events-none fixed top-8 left-0 right-0 z-40 flex flex-col items-center justify-center text-center px-4">
        <h1 className="font-display text-5xl md:text-7xl font-bold tracking-wider text-white drop-shadow-[0_4px_0_rgba(236,72,153,0.8)] mb-2">
          GENDRAW
        </h1>
        <p className="font-sans text-lg md:text-xl font-bold text-white/90 drop-shadow-md">
          Draw it. Guess it. Win it.
        </p>
        <p className="mt-1 max-w-md font-sans text-xs md:text-sm text-white/70">
          A graffiti-style drawing game made for quick sketches, funny guesses, and creative battles.
        </p>
      </div>

      {/* Floating sleek tab group — glassmorphic, follows scroll. */}
      <nav
        aria-label="Primary navigation"
        className="pointer-events-none fixed bottom-6 left-1/2 z-30 -translate-x-1/2 px-4"
      >
        <div className="pointer-events-auto inline-flex items-center gap-1 rounded-xl border border-white/15 bg-bg-deep/75 p-1 shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur-md">
          {TABS.map((tab, i) => {
            const isActive = activeIndex === i;
            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => apiRef.current?.goTo(i)}
                aria-current={isActive ? 'page' : undefined}
                className={[
                  'rounded-lg px-4 py-2 text-sm font-sans font-medium tracking-tight',
                  'transition-all duration-200 ease-out',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
                  isActive
                    ? 'bg-white/20 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25)]'
                    : 'text-white/80 hover:bg-white/10 hover:text-white',
                ].join(' ')}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      <FullScreenScrollFX
        sections={sections}
        apiRef={apiRef}
        showProgress={false}
        onIndexChange={(i) => setActiveIndex(i)}
        bgTransition="fade"
        parallaxAmount={4}
        durations={{ change: 0.7, snap: 800 }}
        fontFamily='"Fredoka", "Nunito", system-ui, sans-serif'
        gridPaddingX={3}
        header={null}
        // Soft chromatic wash that doesn't drown the photo.
        colors={{
          text: 'rgba(255, 255, 255, 0.95)',
          overlay:
            'linear-gradient(135deg, rgba(14,7,40,0.30), rgba(168,85,247,0.18) 50%, rgba(236,72,153,0.30))',
          pageBg: '#0e0728',
          stageBg: '#070114',
        }}
      />
    </main>
  );
}
