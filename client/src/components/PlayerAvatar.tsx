/**
 * PlayerAvatar component.
 *
 * Validates Requirement 14.3 — renders a colored circle showing the first
 * letter of the player's name where the circle color is a deterministic
 * function of the player's index in the Room player list. Color allocation
 * is delegated to {@link avatarFor} so Property 20 (palette determinism) is
 * tested at the library level, not here.
 *
 * The component is intentionally tiny: it accepts the player tuple and the
 * caller-supplied index, derives the initial, and assigns the background
 * color. It does not own any state.
 */

import { avatarFor } from '../lib/colors';
import { displayName } from '../lib/addr';

export type PlayerAvatarProps = {
  player: { address: string; name: string };
  /** 0-based index of the player in the Room player list (Req 14.3). */
  index: number;
  /** Optional Tailwind size classes. Defaults to a 32×32 px circle. */
  className?: string;
};

/**
 * Extract the first character of `display`, uppercased. Empty values fall
 * back to `?` so the avatar is never blank.
 */
function initial(display: string): string {
  if (display.length === 0) return '?';
  // Skip the "0x" prefix on a shortened address so we get a meaningful
  // letter (e.g. "5" for "0x5964…9037") instead of always rendering "0".
  const cleaned = display.startsWith('0x') ? display.slice(2) : display;
  if (cleaned.length === 0) return '?';
  const first = [...cleaned][0] ?? '?';
  return first.toUpperCase();
}

export function PlayerAvatar({ player, index, className }: PlayerAvatarProps) {
  const bg = avatarFor(index);
  const display = displayName(player.address, player.name);
  const letter = initial(display);

  return (
    <span
      role="img"
      aria-label={`${display} avatar`}
      title={display}
      style={{ backgroundColor: bg }}
      className={[
        'inline-flex items-center justify-center rounded-full',
        'h-8 w-8 text-sm font-bold text-white',
        'select-none',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {letter}
    </span>
  );
}

export default PlayerAvatar;
