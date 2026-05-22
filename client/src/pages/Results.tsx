/**
 * Results page (Requirement 10).
 *
 * Validates:
 *  - 10.1: On mount, calls `get_leaderboard` and sorts entries non-
 *    increasing by score with a deterministic address-ascending
 *    tiebreaker (delegated to `lib/leaderboard.ts` for testability —
 *    Property 18).
 *  - 10.2 / 10.3: Renders a podium with `min(3, |L|)` slots so a room with
 *    fewer than three players degrades gracefully to the available
 *    positions.
 *  - 10.4: Displays a confetti animation on mount.
 *  - 10.5: Displays a "Verified by GenLayer" badge.
 *  - 10.6: Each podium / list score animates from 0 to its final value via
 *    {@link ScoreCounter}.
 *  - 10.7: Renders an error message when the leaderboard load fails.
 *  - 10.8: Provides a "Play Again" button that returns the player to `/`.
 *
 * Implementation notes:
 *  - The confetti is a lightweight pure-CSS effect — a small array of
 *    absolutely-positioned squares, each with a randomised animation
 *    delay / horizontal offset, falling and fading via inline keyframes
 *    declared once in the JSX `<style>` block. This keeps the page free
 *    of any external dependency.
 *  - `entries` and `loadError` are the only two non-null states; the
 *    loading state is the implicit `entries === null && loadError === null`
 *    case and renders a simple skeleton message.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { LeaderboardEntry } from '@gendraw/contract';

import { getLeaderboard, createReadClient } from '../lib/contract';
import { selectPodium, sortLeaderboard } from '../lib/leaderboard';
import PlayerAvatar from '../components/PlayerAvatar';
import ScoreCounter from '../components/ScoreCounter';
import { displayName } from '../lib/addr';
import SiteWordmark from '../components/SiteWordmark';

/**
 * Visual ordering of the podium slots (1st in the centre, 2nd on the left,
 * 3rd on the right) so the page evokes a real award podium. The array is
 * indexed by sorted rank (`0 = 1st`, `1 = 2nd`, `2 = 3rd`).
 */
const PODIUM_LAYOUT: ReadonlyArray<{
  rank: number;
  /** Tailwind `order-*` class for visual placement on >= sm screens. */
  order: string;
  /** Height tier — 1st is tallest. */
  height: string;
  /** Background color tile per Requirement 14.1 palette. */
  tile: string;
  /** Display label for the rank ("1st", "2nd", "3rd"). */
  label: string;
}> = [
  { rank: 1, order: 'sm:order-2', height: 'h-40', tile: 'bg-yellow', label: '1st' },
  { rank: 2, order: 'sm:order-1', height: 'h-32', tile: 'bg-purple', label: '2nd' },
  { rank: 3, order: 'sm:order-3', height: 'h-24', tile: 'bg-pink', label: '3rd' },
];

/** Number of confetti particles emitted at mount (Req 10.4). */
const CONFETTI_COUNT = 24;

/** Pre-built palette of colours used for the confetti pieces. */
const CONFETTI_COLORS = ['#7c3aed', '#ec4899', '#3b82f6', '#10b981', '#f59e0b'] as const;

/**
 * Deterministic-ish particle config built once per mount. Using
 * `Math.random()` here is fine — confetti is a purely cosmetic flourish
 * and does not need to be reproducible across renders. Keeping the array
 * in `useMemo([])` ensures we don't regenerate on every state change.
 */
interface ConfettiPiece {
  left: number; // percent
  delay: number; // seconds
  duration: number; // seconds
  rotate: number; // degrees
  color: string;
}

function buildConfetti(): ConfettiPiece[] {
  const pieces: ConfettiPiece[] = [];
  for (let i = 0; i < CONFETTI_COUNT; i += 1) {
    pieces.push({
      left: Math.random() * 100,
      delay: Math.random() * 1.5,
      duration: 2.5 + Math.random() * 2,
      rotate: Math.random() * 360,
      color:
        CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)] ??
        CONFETTI_COLORS[0],
    });
  }
  return pieces;
}

export default function Results(): JSX.Element {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fetch the leaderboard exactly once per `roomId`. The cancellation
  // token guards against a `roomId` change in the middle of the fetch
  // (which is unlikely on the Results route but cheap to be safe about).
  useEffect(() => {
    if (roomId === undefined || roomId.length === 0) {
      setLoadError("Couldn't load the leaderboard.");
      return;
    }

    let cancelled = false;
    setEntries(null);
    setLoadError(null);

    async function load(id: string): Promise<void> {
      try {
        const client = createReadClient();
        const raw = await getLeaderboard(client, id);
        if (cancelled) return;
        // Anchor Property 18: sort is delegated to a pure helper so the
        // property test can exercise the same code path without React.
        setEntries(sortLeaderboard(raw));
      } catch {
        if (cancelled) return;
        // Per Req 10.7 we surface a single, friendly message rather than
        // the raw RPC error — the Home page is a one-click recovery.
        setLoadError("Couldn't load the leaderboard.");
      }
    }

    void load(roomId);

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const podium = useMemo(() => {
    if (entries === null) return [];
    return selectPodium(entries);
  }, [entries]);

  // Confetti pieces are stable across re-renders so the animation does
  // not restart whenever `entries` flips from null to populated.
  const confetti = useMemo(buildConfetti, []);

  return (
    <main className="relative min-h-full overflow-hidden px-4 py-12">
      {/* Confetti animation (Req 10.4). Pure CSS — no dependencies. */}
      {loadError === null && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-full overflow-hidden"
        >
          {confetti.map((piece, i) => (
            <span
              key={i}
              className="absolute -top-4 block h-2 w-2 rounded-sm"
              style={{
                left: `${piece.left}%`,
                backgroundColor: piece.color,
                transform: `rotate(${piece.rotate}deg)`,
                animation: `gendraw-confetti ${piece.duration}s ${piece.delay}s linear forwards`,
              }}
            />
          ))}
          <style>{`
            @keyframes gendraw-confetti {
              0% { transform: translateY(0) rotate(0deg); opacity: 1; }
              100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
            }
          `}</style>
        </div>
      )}

      <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center gap-8">
        <header className="flex flex-col items-center gap-3 text-center">
          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.4)]">
            Final Results
          </h1>
          {/* "Verified by GenLayer" badge (Req 10.5). */}
          <span
            className="inline-flex items-center gap-2 rounded-full border border-green/40 bg-green/10 px-3 py-1 text-sm font-semibold text-green"
            aria-label="Verified by GenLayer"
          >
            <span aria-hidden="true">·</span>
            Verified by GenLayer
          </span>
        </header>

        {loadError !== null ? (
          <div
            role="alert"
            className="w-full rounded-lg border border-pink/40 bg-pink/10 px-4 py-3 text-center text-sm text-pink"
          >
            {loadError}
          </div>
        ) : entries === null ? (
          <p className="text-sm text-white/60" aria-live="polite">
            Loading leaderboard…
          </p>
        ) : (
          <>
            {/* Podium (Req 10.2 / 10.3). */}
            <section
              aria-label="Podium"
              className="flex w-full flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-end"
            >
              {podium.map((entry, sortedIndex) => {
                const layout = PODIUM_LAYOUT[sortedIndex];
                if (layout === undefined) return null;
                return (
                  <div
                    key={entry.address}
                    className={`flex flex-col items-center gap-2 ${layout.order}`}
                  >
                    <PlayerAvatar
                      player={{ address: entry.address, name: entry.name }}
                      index={sortedIndex}
                      className="h-16 w-16 text-xl"
                    />
                    <span className="max-w-[10rem] truncate text-base font-semibold text-white">
                      {displayName(entry.address, entry.name)}
                    </span>
                    <span className="text-2xl font-bold text-white">
                      <ScoreCounter value={entry.score} />
                    </span>
                    <div
                      className={`flex w-full items-start justify-center rounded-t-lg pt-2 text-sm font-bold text-white/90 ${layout.height} ${layout.tile}`}
                    >
                      {layout.label}
                    </div>
                  </div>
                );
              })}
            </section>

            {/* Full ranking. Always shown so the page is informative even
                when the room had only two players (podium is shorter). */}
            <section
              aria-label="Full ranking"
              className="glass w-full rounded-3xl p-5"
            >
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/60">
                Full ranking
              </h2>
              <ol className="flex flex-col divide-y divide-white/5">
                {entries.map((entry, index) => (
                  <li
                    key={entry.address}
                    className="flex items-center gap-3 py-2"
                  >
                    <span className="w-6 text-right text-sm font-bold text-white/60">
                      {index + 1}
                    </span>
                    <PlayerAvatar
                      player={{ address: entry.address, name: entry.name }}
                      index={index}
                    />
                    <span className="flex-1 truncate text-sm text-white">
                      {displayName(entry.address, entry.name)}
                    </span>
                    <span className="text-sm font-bold text-white">
                      <ScoreCounter value={entry.score} />
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}

        {/* Play Again CTA (Req 10.8). Always rendered so even an error
            state keeps the recovery path one click away. */}
        <button
          type="button"
          onClick={() => navigate('/')}
          className="rounded-lg bg-purple px-8 py-3 font-semibold text-white transition-colors hover:bg-purple/90 focus:outline-none focus:ring-2 focus:ring-purple focus:ring-offset-2 focus:ring-offset-bg"
        >
          Play Again
        </button>
      </div>
    </main>
  );
}
