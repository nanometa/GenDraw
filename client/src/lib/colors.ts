/**
 * Avatar color assignment — deterministic mapping from a player's index in
 * the Room player list to a theme palette color.
 *
 * Validates Requirements 14.1, 14.3:
 *  - The palette uses the dark gaming theme defined in Requirement 14.1
 *    (purple #7c3aed, pink #ec4899, blue #3b82f6, green #10b981, yellow
 *    #f59e0b) extended with three derived shades to reach 8 distinct
 *    colors so the avatar palette does not run out for an 8-player Room.
 *  - `avatarFor(index)` is a pure function of `index` alone (Property 20)
 *    so two players at the same index always render with the same color
 *    regardless of name or other attributes.
 */

/**
 * Eight-color palette used by {@link avatarFor}. The first five entries are
 * the named theme colors from Requirement 14.1; the remaining three are
 * derived shades (lighter purple, deeper pink, teal) chosen for visual
 * separation from the base five.
 *
 * Exported for tests and theming utilities that want to introspect the
 * palette directly.
 */
export const AVATAR_PALETTE: readonly string[] = [
  '#7c3aed', // purple    (Requirement 14.1)
  '#ec4899', // pink      (Requirement 14.1)
  '#3b82f6', // blue      (Requirement 14.1)
  '#10b981', // green     (Requirement 14.1)
  '#f59e0b', // yellow    (Requirement 14.1)
  '#a78bfa', // light purple — derived shade
  '#f472b6', // light pink   — derived shade
  '#14b8a6', // teal         — derived shade
] as const;

/**
 * Return the avatar color assigned to the player at `index` in the Room
 * player list. The mapping wraps modulo the palette length, so an 8+ player
 * room (Requirement 2.1 caps `max_players` at 8, but the function is
 * defensive) cycles through the palette deterministically.
 *
 * The double-modulo expression `((index % len) + len) % len` normalizes
 * negative indices to a non-negative palette slot, since JavaScript's `%`
 * can return negative results for negative dividends.
 *
 * @param index - 0-based player index within the Room.
 * @returns A hex color string from {@link AVATAR_PALETTE}.
 */
export function avatarFor(index: number): string {
  const len = AVATAR_PALETTE.length;
  const slot = ((index % len) + len) % len;
  // Non-null assertion is safe: `slot` is in [0, len) and `len` is the
  // compile-time constant length of the palette tuple, so the lookup
  // always resolves to a defined string.
  return AVATAR_PALETTE[slot]!;
}
