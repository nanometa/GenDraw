/**
 * Weekly leaderboard page (`/leaderboard`).
 *
 * Reads `get_weekly_leaderboard(50)` + `get_current_week_id()` from the
 * v5 GenDraw contract and renders the top scorers of the current week.
 * The contract's week id is manually controlled by the owner so we do
 * not show a countdown; instead a small "Current week #N" label keeps
 * the user oriented.
 *
 * Layout follows the Lobby page: full-bleed photo backdrop with a
 * chromatic wash, GenDraw wordmark on top, big "Leaderboard" title,
 * frosted-glass card with rankings.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  createReadClient,
  getCurrentWeekId,
  getWeeklyLeaderboard,
  type WeeklyLeaderboardEntry,
} from '../lib/contract';
import { displayName, shortAddr } from '../lib/addr';
import { EXPLORER_ADDR_URL } from '../components/TxHashLink';
import SiteWordmark from '../components/SiteWordmark';

/** Photo backdrop, kept consistent with the "Validator" / leaderboard
 *  slide on the landing page so the user gets a smooth visual hand-off.
 *  (Currently unused — the global AnimatedDots backdrop in App.tsx is
 *   the only visual layer here. Kept for reference.) */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _LEADERBOARD_BG =
  'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1920&q=80';

export default function Leaderboard(): JSX.Element {
  const navigate = useNavigate();

  const [entries, setEntries] = useState<WeeklyLeaderboardEntry[]>([]);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [weekId, setWeekId] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    const client = createReadClient();
    const refresh = async (): Promise<void> => {
      try {
        const [board, wid] = await Promise.all([
          getWeeklyLeaderboard(client, 50),
          getCurrentWeekId(client),
        ]);
        if (cancelled) return;
        setEntries(board);
        setWeekId(wid);
        setLoaded(true);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'fetch failed');
        setLoaded(true);
      }
    };
    void refresh();
    const handle = window.setInterval(() => void refresh(), 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden flex items-center justify-center">
      <div className="relative w-full max-w-3xl flex flex-col items-center gap-8 px-4 py-10 sm:py-16">
        <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-bg-deep drop-shadow-[0_3px_0_rgba(255,255,255,0.25)]">
          Leaderboard
        </h2>

        <section className="glass relative w-full max-w-lg space-y-6 rounded-3xl p-6 sm:p-7">
          <div className="space-y-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-bg-deep">
              Top scorers of the current week
            </p>
            <div className="flex items-center justify-center">
              <span className="inline-flex items-center gap-2 rounded-xl border border-yellow/50 bg-yellow/30 px-5 py-2 font-mono text-lg font-bold text-bg-deep">
                Week #{weekId}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-bg-deep">
              Top players
            </h3>
            {!loaded ? (
              <p className="rounded-xl border border-bg-deep/20 bg-white/40 px-3 py-3 text-center text-sm text-bg-deep/80 backdrop-blur">
                Loading scores…
              </p>
            ) : error !== null ? (
              <p className="rounded-xl border border-pink/40 bg-pink/15 px-3 py-3 text-center text-sm font-semibold text-pink backdrop-blur">
                Couldn't load the leaderboard: {error}
              </p>
            ) : entries.length === 0 ? (
              <p className="rounded-xl border border-bg-deep/20 bg-white/40 px-3 py-3 text-center text-sm text-bg-deep/80 backdrop-blur">
                No points scored yet this week. Be the first.
              </p>
            ) : (
              <ol className="space-y-2">
                {entries.map((entry, idx) => {
                  const rank = idx + 1;
                  const medal =
                    rank === 1
                      ? '1st'
                      : rank === 2
                        ? '2nd'
                        : rank === 3
                          ? '3rd'
                          : null;
                  return (
                    <li
                      key={entry.address}
                      className={[
                        'flex items-center justify-between rounded-xl px-3 py-2.5 border backdrop-blur',
                        rank === 1
                          ? 'bg-yellow/30 border-yellow/50'
                          : 'bg-white/40 border-bg-deep/20',
                      ].join(' ')}
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <span
                          className={[
                            'flex h-8 w-8 items-center justify-center rounded-full font-display font-bold text-sm',
                            rank === 1
                              ? 'bg-yellow text-bg-deep'
                              : rank === 2
                                ? 'bg-bg-deep/80 text-white'
                                : rank === 3
                                  ? 'bg-pink text-white'
                                  : 'bg-bg-deep/15 text-bg-deep',
                          ].join(' ')}
                        >
                          {medal ?? rank}
                        </span>
                        <span className="font-semibold text-bg-deep truncate">
                          {displayName(entry.address, undefined)}
                        </span>
                        <a
                          href={`${EXPLORER_ADDR_URL}${entry.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={entry.address}
                          className="hidden sm:inline font-mono text-[10px] text-bg-deep/55 hover:text-bg-deep underline-offset-2 hover:underline"
                        >
                          {shortAddr(entry.address)}
                        </a>
                      </span>
                      <span className="font-display text-xl font-bold tabular-nums text-bg-deep">
                        {entry.score}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <button
            type="button"
            onClick={() => navigate('/')}
            className={[
              'w-full rounded-xl border border-bg-deep/30 bg-bg-deep/85 px-4 py-3',
              'text-sm font-semibold tracking-wide text-white backdrop-blur',
              'transition-all duration-200 hover:bg-bg-deep hover:border-bg-deep/60',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow',
            ].join(' ')}
          >
            ← Back home
          </button>
        </section>
      </div>
    </main>
  );
}
