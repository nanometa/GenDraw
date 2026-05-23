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
        <h2 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-widest uppercase text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
          LEADERBOARD
        </h2>

        <section className="bg-white/5 border border-white/10 backdrop-blur-md relative w-full max-w-lg space-y-6 rounded-2xl p-6 sm:p-7 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <div className="space-y-3 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-white/80">
              Top scorers of the current week
            </p>
            <div className="flex items-center justify-center">
              <span className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-5 py-2 font-mono text-lg font-bold text-white shadow-sm">
                Week #{weekId}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/60">
              Top players
            </h3>
            {!loaded ? (
              <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-center text-sm font-bold text-white/80 backdrop-blur">
                Loading scores…
              </p>
            ) : error !== null ? (
              <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-3 text-center text-sm font-bold text-red-400 backdrop-blur">
                Couldn't load the leaderboard: {error}
              </p>
            ) : entries.length === 0 ? (
              <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-center text-sm font-bold text-white/80 backdrop-blur">
                No ink on the wall yet. Be the first to score!
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
                  
                  const getRankStyles = (r: number) => {
                    switch (r) {
                      case 1: return {
                        badge: 'bg-[#00FF66] text-black shadow-[0_0_10px_rgba(0,255,102,0.6)]',
                        row: 'bg-[#00FF66]/10 border-[#00FF66]/50 shadow-[0_0_15px_rgba(0,255,102,0.15)]',
                        score: 'text-[#00FF66]',
                      };
                      case 2: return {
                        badge: 'bg-[#00FFFF] text-black shadow-[0_0_10px_rgba(0,255,255,0.6)]',
                        row: 'bg-[#00FFFF]/10 border-[#00FFFF]/50 shadow-[0_0_15px_rgba(0,255,255,0.15)]',
                        score: 'text-[#00FFFF]',
                      };
                      case 3: return {
                        badge: 'bg-[#FF00FF] text-white shadow-[0_0_10px_rgba(255,0,255,0.6)]',
                        row: 'bg-[#FF00FF]/10 border-[#FF00FF]/50 shadow-[0_0_15px_rgba(255,0,255,0.15)]',
                        score: 'text-[#FF00FF]',
                      };
                      case 4: return {
                        badge: 'bg-[#FFFF00] text-black shadow-[0_0_10px_rgba(255,255,0,0.5)]',
                        row: 'bg-[#FFFF00]/10 border-[#FFFF00]/40',
                        score: 'text-[#FFFF00]',
                      };
                      case 5: return {
                        badge: 'bg-[#FF5500] text-white shadow-[0_0_10px_rgba(255,85,0,0.5)]',
                        row: 'bg-[#FF5500]/10 border-[#FF5500]/40',
                        score: 'text-[#FF5500]',
                      };
                      default: return {
                        badge: 'bg-white/10 text-white/80',
                        row: 'bg-white/5 border-white/10 hover:bg-white/10',
                        score: 'text-white/60',
                      };
                    }
                  };

                  const styles = getRankStyles(rank);

                  return (
                    <li
                      key={entry.address}
                      className={[
                        'flex items-center justify-between rounded-lg px-3 py-2.5 border backdrop-blur transition-colors',
                        styles.row,
                      ].join(' ')}
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <span
                          className={[
                            'flex h-8 w-8 items-center justify-center rounded-full font-bold text-sm',
                            styles.badge,
                          ].join(' ')}
                        >
                          {medal ?? rank}
                        </span>
                        <span className="font-bold text-white truncate">
                          {displayName(entry.address, undefined)}
                        </span>
                        <a
                          href={`${EXPLORER_ADDR_URL}${entry.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={entry.address}
                          className="hidden sm:inline font-mono text-[10px] text-white/40 hover:text-white transition-colors underline-offset-2 hover:underline"
                        >
                          {shortAddr(entry.address)}
                        </a>
                      </span>
                      <span className={[
                        'font-mono text-xl font-bold tabular-nums tracking-wider',
                        styles.score
                      ].join(' ')}>
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
              'w-full rounded-lg border border-white/20 bg-white/5 px-4 py-3',
              'text-sm font-bold uppercase tracking-widest text-white backdrop-blur-sm',
              'transition-all duration-200 hover:bg-white/10 hover:border-[#00FF66]',
              'focus:outline-none',
            ].join(' ')}
          >
            ← Back home
          </button>
        </section>
      </div>
    </main>
  );
}
