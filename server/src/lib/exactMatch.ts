/**
 * Exact-match comparator used by the `guess:submit` server handler to decide
 * whether the submitted guess is a verbatim case-insensitive match for the
 * current Word before the AI validation path runs.
 *
 * Validates Requirement 8.3:
 *  - The server first performs an exact case-insensitive string match
 *    against the Word, with both sides trimmed of leading/trailing
 *    whitespace so a guess like "  Apple " matches the word "apple".
 *
 * Anchors Property 14 (guess pipeline routing): the routing decision in
 * `guess.ts` is exactly `exactMatch(word, guess)`, so this function defines
 * the routing predicate.
 */

/**
 * Return true when `word` and `guess` are equal after trimming surrounding
 * whitespace and folding both sides to lower case.
 *
 * Locale-independent `String.prototype.toLowerCase()` is used (rather than
 * `toLocaleLowerCase`) because the Contract treats the secret Word as an
 * opaque string and we want guesses to compare identically across all
 * client locales — a Turkish player and an English player should both
 * match "I" against "i".
 *
 * @param word  - The secret word held by the server for the active round.
 * @param guess - The raw guess text received from a Guesser.
 * @returns `true` when the trimmed, lower-cased strings are equal.
 */
export function exactMatch(word: string, guess: string): boolean {
  return word.trim().toLowerCase() === guess.trim().toLowerCase();
}
