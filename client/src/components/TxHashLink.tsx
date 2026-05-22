/**
 * TxHashLink component.
 *
 * Validates Requirement 12.2 (display the returned Transaction_Hash as a
 * clickable link) and Requirement 8.10 (render the tx hash next to a
 * validated guess). The truncated hash format `0x1234…abcd` keeps chat
 * messages compact while still allowing users to click through to the
 * GenLayer block explorer.
 *
 * NOTE: GenLayer does not (at time of writing) publish a stable canonical
 * explorer URL for testnet transactions, so we link to the GenLayer Studio
 * transaction route. If the explorer URL pattern changes, update the
 * {@link EXPLORER_TX_URL} constant in one place rather than chasing
 * call sites.
 */

/**
 * Base URL pattern for transaction lookups. Must end with `/` so we can
 * append the hash directly. Points at the GenLayer Studionet explorer.
 */
export const EXPLORER_TX_URL = 'https://explorer-studio.genlayer.com/tx/';
export const EXPLORER_ADDR_URL = 'https://explorer-studio.genlayer.com/address/';

export type TxHashLinkProps = {
  /** Full 0x-prefixed transaction hash. */
  txHash: string;
  /** Optional className passthrough for layout / typography. */
  className?: string;
};

/**
 * Truncate an `0x...`-prefixed hash to `0x1234…abcd`. Hashes shorter than
 * the truncation budget are returned as-is so we never render an ellipsis
 * with nothing on the right side.
 */
export function truncateHash(hash: string): string {
  // Show the first 6 chars (0x + 4 hex) and the last 4 hex chars.
  const HEAD = 6;
  const TAIL = 4;
  if (hash.length <= HEAD + TAIL) return hash;
  return `${hash.slice(0, HEAD)}…${hash.slice(-TAIL)}`;
}

export function TxHashLink({ txHash, className }: TxHashLinkProps) {
  const display = truncateHash(txHash);

  return (
    <a
      href={`${EXPLORER_TX_URL}${txHash}`}
      target="_blank"
      // `noopener` prevents the new tab from getting access to our
      // window.opener; `noreferrer` strips the Referer header.
      rel="noopener noreferrer"
      title={txHash}
      aria-label={`View transaction ${txHash} on GenLayer explorer`}
      className={[
        'font-mono text-xs text-blue underline-offset-2 hover:underline',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {display}
    </a>
  );
}

export default TxHashLink;
