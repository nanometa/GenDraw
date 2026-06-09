import { useEffect, useMemo, useState, type FormEvent } from 'react';

import {
  addWords,
  createReadClient,
  getPoolSize,
  getRecentWords,
} from '../../lib/contract';
import TxHashLink from '../../components/TxHashLink';
import { useWriteClient } from '../../lib/useWriteClient';

const inputClasses =
  'w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-white/40 font-medium focus:outline-none focus:border-white/40 focus:bg-white/15 disabled:opacity-50 transition-colors backdrop-blur';

interface PoolState {
  poolSize: number | null;
  recentWords: string[];
}

function parseWords(value: string): string[] {
  const seen = new Set<string>();
  const words: string[] = [];
  for (const raw of value.split(/[\n,]+/)) {
    const word = raw.trim().toUpperCase();
    if (!/^[A-Z]{2,20}$/.test(word)) continue;
    if (seen.has(word)) continue;
    seen.add(word);
    words.push(word);
    if (words.length >= 20) break;
  }
  return words;
}

function messageFromError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.length > 0) return err;
  return 'Transaction failed. Please try again.';
}

export default function InlineWordPoolPanel(): JSX.Element {
  const writeClient = useWriteClient();

  const [pool, setPool] = useState<PoolState>({
    poolSize: null,
    recentWords: [],
  });
  const [draft, setDraft] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const parsedWords = useMemo(() => parseWords(draft), [draft]);
  const submitDisabled =
    submitting || writeClient === null || parsedWords.length === 0;

  async function refresh(): Promise<void> {
    const client = createReadClient();
    const [poolSize, recentWords] = await Promise.all([
      getPoolSize(client),
      getRecentWords(client),
    ]);
    setPool({ poolSize, recentWords });
  }

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      try {
        const client = createReadClient();
        const [poolSize, recentWords] = await Promise.all([
          getPoolSize(client),
          getRecentWords(client),
        ]);
        if (!cancelled) setPool({ poolSize, recentWords });
      } catch {
        if (!cancelled) setPool({ poolSize: null, recentWords: [] });
      }
    };
    void load();
    const handle = window.setInterval(() => void load(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitDisabled || writeClient === null) return;

    setSubmitting(true);
    setSubmitError(null);
    setTxHash(null);
    try {
      await writeClient.connectChain();
      const { hash } = await addWords(writeClient.client, parsedWords);
      setTxHash(hash);
      setDraft('');
      await refresh();
    } catch (err) {
      setSubmitError(messageFromError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/55">
            Word pool
          </p>
          <p className="mt-1 font-mono text-3xl font-bold text-white">
            {pool.poolSize ?? '...'}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/55">
            Batch
          </p>
          <p className="mt-1 font-mono text-3xl font-bold text-white">
            {parsedWords.length}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={submitting}
          rows={4}
          placeholder="DOG, PIZZA, CASTLE"
          className={`${inputClasses} resize-none`}
        />
        <button
          type="submit"
          disabled={submitDisabled}
          className={[
            'w-full rounded-xl border border-white/20 bg-white/15 px-4 py-3',
            'text-sm font-semibold tracking-wide text-white backdrop-blur',
            'transition-all duration-200 hover:bg-white/25 hover:border-white/30',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
            'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/15',
          ].join(' ')}
        >
          {submitting ? 'Submitting...' : 'Add Words'}
        </button>
      </form>

      {submitError !== null ? (
        <p
          role="alert"
          className="rounded-xl border border-red/40 bg-red/10 px-3 py-2 text-xs font-medium text-red"
        >
          {submitError}
        </p>
      ) : null}

      {txHash !== null ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-green/30 bg-green/10 px-3 py-2 text-xs backdrop-blur">
          <span className="font-semibold text-green-bright">Words submitted</span>
          <TxHashLink txHash={txHash} />
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/55">
          Recent words
        </p>
        {pool.recentWords.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-center text-sm text-white/55 backdrop-blur">
            No recent words yet.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {pool.recentWords.slice(-12).map((word) => (
              <span
                key={word}
                className="rounded-full border border-white/15 bg-white/10 px-3 py-1 font-mono text-xs font-semibold text-white/80 backdrop-blur"
              >
                {word}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
