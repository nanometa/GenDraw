/**
 * Chat component — guess chat panel for the Game page.
 *
 * Validates Requirements 8.1, 8.2, 8.10, 8.12:
 *  - The input applies {@link sanitizeGuess} before invoking `onSubmit`,
 *    dropping empty / whitespace-only entries (Req 8.2) and clamping the
 *    submitted text to 50 characters (Req 8.1).
 *  - The chat input is disabled when the local player is the Drawer
 *    (Req 8.12) — the parent passes `disabled={isLocalDrawer}`.
 *  - Each `'correct'` and `'guess'` entry that carries a `txHash` renders a
 *    {@link TxHashLink}, surfacing the on-chain proof inline next to the
 *    message (Req 8.10).
 *
 * The component is fully controlled — it owns only the input field's local
 * draft text. Message-list scrolling pins to the bottom on each new
 * message so chat behaves like every other in-game chat the player has
 * used.
 */

import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';

import { sanitizeGuess, MAX_GUESS_LENGTH } from '../../lib/guess';
import TxHashLink from '../TxHashLink';

/**
 * A single chat message rendered in the list. The shape is intentionally
 * narrow — sender display info plus the message body and metadata — so
 * the parent can derive it from the various server events
 * (`guess:correct`, `guess:wrong`, `system:*`) without leaking transport
 * specifics into the UI.
 */
export type ChatMessage = {
  id: string;
  address: string;
  name: string;
  text: string;
  kind: 'guess' | 'correct' | 'system';
  /** Optional transaction hash from a validated guess (Req 8.10). */
  txHash?: string;
};

export type ChatProps = {
  messages: ChatMessage[];
  onSubmit: (text: string) => void;
  /** True when the local player is the Drawer (Req 8.12). */
  disabled: boolean;
  /** Per-input character limit (Req 8.1). Defaults to {@link MAX_GUESS_LENGTH}. */
  maxLength?: number;
  className?: string;
};

/**
 * Compose Tailwind classes for a message row based on its kind. Centralized
 * so the styling stays consistent across renders and is easy to tweak.
 */
function rowClassesFor(kind: ChatMessage['kind']): string {
  switch (kind) {
    case 'correct':
      // Correct guesses get a green tint and bold name to make them pop.
      return 'rounded-xl bg-green/15 border border-green/40 px-3 py-1.5 text-green-bright font-semibold';
    case 'system':
      // System messages (joins / round changes) are de-emphasized.
      return 'px-2 py-0.5 text-xs italic text-white/55 text-center';
    case 'guess':
    default:
      return 'px-3 py-1 text-sm text-white/95';
  }
}

export function Chat({
  messages,
  onSubmit,
  disabled,
  maxLength = MAX_GUESS_LENGTH,
  className,
}: ChatProps) {
  const [draft, setDraft] = useState<string>('');
  const listRef = useRef<HTMLUListElement | null>(null);

  // Auto-scroll the message list to the bottom whenever a new message is
  // appended. Using scrollTop rather than scrollIntoView keeps the page
  // scroll position stable when the chat panel is offscreen on mobile.
  useEffect(() => {
    const node = listRef.current;
    if (node === null) return;
    node.scrollTop = node.scrollHeight;
  }, [messages.length]);

  /**
   * Submit the current draft. Returns the sanitized text emitted (or
   * `null` if nothing was sent) for tests that want to assert behavior
   * without going through the DOM event path.
   */
  const handleSubmit = (): string | null => {
    if (disabled) return null;
    const sanitized = sanitizeGuess(draft);
    // Clear the input regardless of whether anything was emitted, so the
    // user doesn't have to delete leftover whitespace before typing again.
    setDraft('');
    if (sanitized === null) return null;
    onSubmit(sanitized);
    return sanitized;
  };

  const onFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleSubmit();
  };

  // Catch bare Enter on the input element so we still submit even when the
  // form is wrapped in a parent that suppresses submit events (some testing
  // harnesses do this).
  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <section
      aria-label="Chat"
      className={[
        'flex h-full min-h-0 flex-col rounded-2xl glass text-white',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <ul
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        className="flex-1 min-h-0 space-y-1 overflow-y-auto px-2 py-2"
      >
        {messages.map((m) => (
          <li key={m.id} className={rowClassesFor(m.kind)}>
            {m.kind === 'system' ? (
              <span>{m.text}</span>
            ) : (
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span
                  className={[
                    'font-semibold',
                    m.kind === 'correct' ? 'text-green' : 'text-white',
                  ].join(' ')}
                >
                  {m.name}
                </span>
                <span>{m.text}</span>
                {typeof m.txHash === 'string' && m.txHash.length > 0 ? (
                  <TxHashLink txHash={m.txHash} />
                ) : null}
              </span>
            )}
          </li>
        ))}
      </ul>

      <form
        onSubmit={onFormSubmit}
        className="flex items-stretch gap-2 border-t-2 border-white/15 px-3 py-3"
      >
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onInputKeyDown}
          maxLength={maxLength}
          disabled={disabled}
          // The placeholder doubles as a hint that explains *why* the
          // input is disabled when the local player is the Drawer.
          placeholder={
            disabled ? 'You are drawing — chat disabled' : 'Type your guess…'
          }
          aria-label="Guess input"
          className={[
            'flex-1 rounded-xl bg-white/10 border-2 border-white/15 px-3 py-2 text-sm font-semibold text-white',
            'placeholder:text-white/40 placeholder:font-normal',
            'focus:outline-none focus:border-yellow focus:bg-white/15',
            'disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/40 disabled:border-white/10',
          ].join(' ')}
        />
        <button
          type="submit"
          disabled={disabled}
          className={[
            'rounded-lg px-4 py-2 text-sm font-semibold tracking-tight transition',
            'border border-yellow/50 bg-yellow/20 text-yellow backdrop-blur',
            'hover:bg-yellow/30 hover:border-yellow/70 hover:text-bg-deep',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow',
            'disabled:cursor-not-allowed disabled:opacity-40',
          ].join(' ')}
        >
          Send
        </button>
      </form>
    </section>
  );
}

export default Chat;
