/**
 * Pure leaderboard helpers — sorting and podium selection.
 *
 * Validates Requirements 10.1, 10.2, 10.3 and anchors Property 18
 * (leaderboard ordering and podium):
 *  - {@link sortLeaderboard} sorts entries non-increasing by `score` with a
 *    deterministic tiebreaker on `address` (lowercase ascending). Two
 *    distinct addresses can never sort identically, so the resulting order
 *    is total and stable across calls.
 *  - {@link selectPodium} returns the first `min(3, |L|)` entries of an
 *    already-sorted leaderboard. For rooms with fewer than three players
 *    the podium degrades gracefully to the available slots (Req 10.3).
 *
 * The helpers are split out from `Results.tsx` so the property test can
 * exercise them directly without rendering React components.
 */

import type { LeaderboardEntry } from '@gendraw/contract';

/** Maximum number of slots displayed on the podium (Req 10.2). */
export const PODIUM_MAX_SLOTS = 3;

/**
 * Compare two `LeaderboardEntry` rows for the leaderboard total order.
 *
 * Primary key: `score` descending (higher score sorts first).
 * Tiebreaker: `address` ascending under a lowercase comparison so the
 * result is independent of whether the Contract returns checksummed or
 * lowercase addresses.
 *
 * Returns a negative number when `a` should sort before `b`, positive
 * when after, and zero only when both `score` and `address` (lowercased)
 * are identical — which would imply the same player appearing twice and
 * is treated as equal for sorting purposes.
 */
function compareEntries(a: LeaderboardEntry, b: LeaderboardEntry): number {
  if (a.score !== b.score) {
    // Descending: larger score first.
    return b.score - a.score;
  }
  const aAddr = a.address.toLowerCase();
  const bAddr = b.address.toLowerCase();
  if (aAddr < bAddr) return -1;
  if (aAddr > bAddr) return 1;
  return 0;
}

/**
 * Return a new array containing `entries` sorted by the leaderboard total
 * order. The input array is not mutated so callers (including React state
 * holders) can safely pass the raw `getLeaderboard` result.
 */
export function sortLeaderboard(
  entries: ReadonlyArray<LeaderboardEntry>,
): LeaderboardEntry[] {
  // Array.prototype.sort is in-place and is required by V8 to be stable
  // since 2018. Copy first so the input is preserved.
  return [...entries].sort(compareEntries);
}

/**
 * Return the first `min(3, sorted.length)` entries of an already-sorted
 * leaderboard. Used by the Results page to populate the podium slots.
 *
 * The function is intentionally permissive about its input shape: it
 * trusts that the caller has already invoked {@link sortLeaderboard}.
 * Re-sorting here would mask a programming error elsewhere.
 */
export function selectPodium(
  sortedEntries: ReadonlyArray<LeaderboardEntry>,
): LeaderboardEntry[] {
  const slots = Math.min(PODIUM_MAX_SLOTS, sortedEntries.length);
  return sortedEntries.slice(0, slots);
}
