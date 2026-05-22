/**
 * Client guess submission helper — sanitizes guess input and emits the
 * `guess:submit` Socket.IO event exactly once per submit action.
 *
 * Validates Requirements 8.1, 8.2:
 *  - Whitespace-only / empty inputs are dropped — no event is emitted (Req 8.2).
 *  - Non-empty inputs are trimmed and clamped to {@link MAX_GUESS_LENGTH}
 *    before being sent over the wire (Req 8.1).
 *
 * The pure {@link sanitizeGuess} function anchors Property 13 (guess input
 * sanitization): for any input string `s`, the helper either returns `null`
 * when `s.trim()` is empty, or returns `s.trim().slice(0, MAX_GUESS_LENGTH)`
 * — a value whose length is at most {@link MAX_GUESS_LENGTH} characters.
 */

import type { Socket } from 'socket.io-client';

/**
 * Maximum number of characters sent in a `guess:submit` payload. Matches
 * Requirement 8.1's "trimmed to a maximum of 50 characters".
 */
export const MAX_GUESS_LENGTH = 50;

/**
 * Sanitize raw user input before it is emitted as a guess.
 *
 * Pure: depends only on its input.
 *
 * Trims surrounding whitespace, collapses any internal whitespace runs to
 * a single space, then length-clamps. The whitespace collapse covers a
 * common pitfall on phone IMEs and copy-paste, where users accidentally
 * type "T O M A T O" instead of "TOMATO" — the contract's deterministic
 * matcher only strips leading/trailing whitespace, so without this
 * collapse the guess would silently miss.
 *
 * @param input - The raw text from the chat input.
 * @returns The sanitized guess, or `null` if the result is empty (i.e.
 *  the caller should not emit anything).
 */
export function sanitizeGuess(input: string): string | null {
  const collapsed = input.replace(/\s+/g, ' ').trim();
  if (collapsed.length === 0) return null;
  // Strip every space too: most word-pool entries are single tokens, so
  // the on-chain matcher compares against unspaced uppercase. Keeping
  // spaces here would only hurt single-word guesses while never helping
  // (the contract's pool has no multi-word entries).
  const compact = collapsed.replace(/\s+/g, '');
  return compact.slice(0, MAX_GUESS_LENGTH);
}

/**
 * Submit a guess over the supplied socket. Sanitizes the input via
 * {@link sanitizeGuess}; if the result is `null`, no event is emitted and
 * the function returns `false`. Otherwise the helper emits exactly one
 * `guess:submit` event with `{ text: sanitized }` and returns `true`.
 *
 * @param socket - The connected `socket.io-client` socket.
 * @param input - The raw text from the chat input.
 * @returns `true` if a `guess:submit` event was emitted, `false` otherwise.
 */
export function submitGuess(socket: Socket, input: string): boolean {
  const sanitized = sanitizeGuess(input);
  if (sanitized === null) return false;
  socket.emit('guess:submit', { text: sanitized });
  return true;
}
