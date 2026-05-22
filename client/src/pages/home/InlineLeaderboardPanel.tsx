/**
 * Inline weekly leaderboard preview for the Home SPA. Renders top-5 of
 * the current week without a wrapping card.
 *
 * v5 contract: the week id is owner-controlled (no automatic rollover),
 * so the panel just shows "Week #N" instead of a countdown.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  createReadClient,
  getCurrentWeekId,
  getWeeklyLeaderboard,
  type WeeklyLeaderboardEntry,
} from '../../lib/contract';
import { displayName, shortAddr } from '../../lib/addr';
import { EXPLORER_ADDR_URL } from '../../components/TxHashLink';

interface WeekState {
  entries: WeeklyLeaderboardEntry[];
  weekId: number;
}

export default function InlineLeaderboardPanel(): JSX.Element {
  const navigate = useNavigate();
  const [week, setWeek] = useState<WeekState | null>(null);

  useEffect(() => {
    let cancelled = false;
    const client = createReadClient();
    const refresh = async (): Promise<void> => {
      try {
        const [entries, weekId] = await Promise.all([
          getWeeklyLeaderboard(client, 5),
          getCurrentWeekId(client),
        ]);
        if (!cancelled) setWeek({ entries, weekId });
      } catch {
        if (!cancelled) setWeek(null);
      }
    };
    void refresh();
    const handle = window.setInterval(() => void refresh(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, []);

  return (
    <div className="w-full max-w-md mx-auto space-y-3">
      <div className="flex items-baseline justify-between text-xs uppercase tracking-widest">
        <span className="font-semibold text-white/70">This week's top</span>
        {week !== null && (
          <span className="text-white/45">Week #{week.weekId}</span>
        )}
      </div>

      {week === null ? (
        <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-center text-sm text-white/55 backdrop-blur">
          Loading scores…
        </p>
      ) : week.entries.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-center text-sm text-white/55 backdrop-blur">
          No points scored yet — be the first.
        </p>
      ) : (
        <ol className="space-y-1.5">
          {week.entries.map((entry, idx) => {
            const rank = idx + 1;
            return (
              <li
                key={entry.address}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm backdrop-blur"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 font-semibold text-white/85 text-xs">
                    {rank}
                  </span>
                  <span className="font-semibold text-white truncate">
                    {displayName(entry.address, undefined)}
                  </span>
                  <a
                    href={`${EXPLORER_ADDR_URL}${entry.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={entry.address}
                    className="hidden sm:inline font-mono text-[10px] text-white/40 hover:text-yellow underline-offset-2 hover:underline"
                  >
                    {shortAddr(entry.address)}
                  </a>
                </span>
                <span className="font-semibold tabular-nums text-white">
                  {entry.score}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <button
        type="button"
        onClick={() => navigate('/leaderboard')}
        className={[
          'w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5',
          'text-xs font-semibold uppercase tracking-widest text-white/75 backdrop-blur',
          'transition-all duration-200 hover:bg-white/10 hover:text-white hover:border-white/25',
        ].join(' ')}
      >
        View full leaderboard →
      </button>
    </div>
  );
}
