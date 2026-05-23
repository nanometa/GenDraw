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

import { useEffect, useRef, useState } from 'react';

import {
  FullScreenScrollFX,
  type FullScreenFXAPI,
} from '@/components/ui/full-screen-scroll-fx';
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

/**
 * Path to the source PNG, served directly by Vite from `/public/`.
 * Same asset the global `BrandMark` uses, just rendered larger here.
 */
const HERO_LOGO_SRC = '/brand-logo.png';

/** Luminance threshold below which source pixels are treated as
 *  background and made fully transparent (matches `BrandMark`). */
const HERO_BLACK_LUMA_THRESHOLD = 30;

/**
 * Strip the black background out of the hero PNG by clearing the
 * alpha of every near-black pixel. Mirrors the helper inside
 * `BrandMark.tsx` so the giant landing-page logo and the corner
 * BrandMark stay visually consistent (no boxy black square around
 * the silhouette in either place).
 */
function blackToTransparent(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx === null) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0);
      try {
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const buf = frame.data;
        for (let i = 0; i < buf.length; i += 4) {
          const r = buf[i] ?? 0;
          const g = buf[i + 1] ?? 0;
          const b = buf[i + 2] ?? 0;
          const luma = 0.299 * r + 0.587 * g + 0.114 * b;
          if (luma < HERO_BLACK_LUMA_THRESHOLD) {
            buf[i + 3] = 0;
          }
        }
        ctx.putImageData(frame, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export default function Home(): JSX.Element {
  const apiRef = useRef<FullScreenFXAPI>(null);
  /** Index of the visible slideshow section (0..2). */
  const [activeIndex, setActiveIndex] = useState<number>(0);
  /** Cleaned-up hero logo (black background → transparent). Falls
   *  back to the original PNG until the canvas pass completes. */
  const [heroSrc, setHeroSrc] = useState<string>(HERO_LOGO_SRC);

  useEffect(() => {
    let cancelled = false;
    void blackToTransparent(HERO_LOGO_SRC).then((cleaned) => {
      if (cancelled || cleaned === null) return;
      setHeroSrc(cleaned);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const heroHeader = (
    <div className="flex flex-col items-center justify-center text-center px-4 w-full">
      <img 
        src="/logo.png" 
        alt="GENDRAW" 
        className="h-28 md:h-44 object-contain mb-2 drop-shadow-[0_8px_16px_rgba(0,0,0,0.9)] brightness-75 contrast-[1.1] opacity-95"
      />
      <p className="font-sans text-lg md:text-xl font-bold text-white/90 drop-shadow-md">
        Draw it. Guess it. Win it.
      </p>
      <p className="mt-1 max-w-md font-sans text-xs md:text-sm text-white/70 mx-auto">
        A graffiti-style drawing game made for quick sketches, funny guesses, and creative battles.
      </p>
    </div>
  );

  return (
    <main className="relative min-h-full no-scrollbar">
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
        header={heroHeader}
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
