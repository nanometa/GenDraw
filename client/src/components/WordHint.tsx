/**
 * WordHint component.
 *
 * Validates Requirements 7.1, 7.2, 7.3, 7.4:
 *  - Drawer (or after a reveal at round end / on a correct guess) sees the
 *    full Word above the canvas (Req 7.1, 7.4).
 *  - Guessers see the masked hint produced by {@link buildHint} — letters
 *    replaced by underscores while spaces and hyphens are preserved
 *    (Req 7.2).
 *  - Each character is rendered in its own `<span>` with a small horizontal
 *    margin so spaces become a visibly wider gap and underscores appear
 *    distinguishable as individual letter slots (Req 7.3).
 *
 * The component is purely presentational. The decision of *what* word to
 * pass in (the secret Word for the Drawer, `null` for guessers before a
 * reveal, etc.) is the caller's responsibility — typically derived from
 * `gameStore.word` and `gameStore.wordHint`.
 */

import { buildHint } from '../lib/wordHint';

export type WordHintProps = {
  /**
   * The full secret word, when known to the local player. May be `null`
   * if the local player is a guesser and the round has not been revealed.
   */
  word: string | null;
  /** True when the local player is the round's Drawer. */
  isDrawer: boolean;
  /**
   * True after a correct guess or round end, when the full word should be
   * revealed to all players regardless of role (Req 7.4).
   */
  revealed?: boolean;
};

/**
 * Render either the full word (Drawer or revealed) or the masked hint
 * (Guesser, pre-reveal). Each character is rendered in its own span so
 * spaces and underscores are visually distinguishable per Req 7.3.
 *
 * The space-character span gets a non-breaking space (`\u00A0`) so the
 * browser doesn't collapse it visually; we still mark it `aria-hidden`
 * because the screen-reader text is conveyed by the parent label.
 */
export function WordHint({ word, isDrawer, revealed = false }: WordHintProps) {
  // Nothing to render until the round is in progress and a word is known.
  if (word === null || word.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-white/60"
        aria-label="Word hint"
      >
        <span className="text-sm">Waiting for round to start…</span>
      </div>
    );
  }

  const showFullWord = isDrawer || revealed;
  const display = showFullWord ? word : buildHint(word);

  // For Guessers we expose the visible character slots to assistive tech as
  // the literal hint string (e.g. "_ _ _ _"). For the Drawer / reveal the
  // assistive label is the actual word.
  const ariaLabel = showFullWord ? `Word: ${word}` : `Word hint: ${display}`;

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      className={[
        'flex flex-wrap items-baseline justify-center font-mono uppercase tracking-widest',
        showFullWord
          ? 'text-4xl font-bold text-[#00FF66] drop-shadow-[0_0_10px_rgba(0,255,102,0.3)]'
          : 'text-4xl font-bold text-white',
      ].join(' ')}
    >
      {Array.from(display).map((ch, i) => {
        const isSpace = ch === ' ';
        return (
          <span
            // Index is fine here: the array is rebuilt whenever `display`
            // changes (new round / reveal), and the visual element is a
            // single character so reordering across renders is impossible.
            key={`${i}-${ch}`}
            aria-hidden={isSpace ? 'true' : undefined}
            // mx-1 gives a visible gap between underscores (Req 7.3) and a
            // wider one for spaces because the space character itself adds
            // its own width. The non-breaking space prevents the browser
            // from collapsing the slot to zero width.
            className={[
              'inline-block px-1',
              isSpace ? 'min-w-[0.75em]' : 'min-w-[0.6em]',
            ].join(' ')}
          >
            {isSpace ? '\u00A0' : ch}
          </span>
        );
      })}
    </div>
  );
}

export default WordHint;
