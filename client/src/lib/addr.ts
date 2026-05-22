/**
 * Address-display helpers used across the UI.
 *
 * The v3 GenDraw contract stores the wallet address as the player's
 * display value when the user joined without a name. We surface those
 * entries with a short truncated form so the chat / player list don't
 * render a 42-character hex blob.
 *
 * `shortAddr` is the canonical formatter: `0x59640D48…9037`.
 *
 * `displayName` derives the user-facing label for a `(address, name)`
 * pair. When the contract stored the address itself as the name (no
 * actual name was supplied), we render the shortened address; otherwise
 * we render the name verbatim.
 */

/** Truncate a 0x-prefixed address to `0xABCDEF12…WXYZ`. */
export function shortAddr(addr: string): string {
  if (typeof addr !== 'string') return '';
  const trimmed = addr.trim();
  if (!trimmed.startsWith('0x') || trimmed.length < 12) return trimmed;
  return `${trimmed.slice(0, 8)}…${trimmed.slice(-4)}`;
}

/** Lower-case Ethereum address comparator (case-insensitive). */
function sameAddr(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Human-readable label for a `(address, name)` pair. Falls back to a
 * shortened address whenever the contract stored the address itself as
 * the name (i.e. the user joined without supplying a name).
 */
export function displayName(address: string, name: string | undefined): string {
  if (typeof name !== 'string' || name.length === 0) return shortAddr(address);
  if (name.startsWith('0x') && sameAddr(name, address)) return shortAddr(address);
  return name;
}
