/**
 * ConnectionStatus component.
 *
 * Validates Requirements 16.4, 16.5:
 *  - Renders the current Socket connection state as a small colored dot
 *    with a label (`Connected` / `Reconnecting…` / `Disconnected`) so the
 *    player always sees the live status (Req 16.4).
 *  - When the connection is `disconnected` and the parent supplies an
 *    `onManualReconnect` callback (i.e. automatic retries are exhausted),
 *    a manual reconnect button is rendered (Req 16.5).
 *
 * The component is a pure projection of its props; the actual reconnect
 * machinery lives in `lib/socket.ts` and the global `gameStore`.
 */

export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';

export type ConnectionStatusProps = {
  status: ConnectionState;
  /**
   * Optional manual reconnect handler. When `status === 'disconnected'`
   * and this callback is provided, a "Reconnect" button is rendered next
   * to the status label (Req 16.5).
   */
  onManualReconnect?: () => void;
  /** Optional className passthrough for layout (e.g. positioning). */
  className?: string;
};

type StatusVisuals = {
  /** Tailwind background color for the dot. */
  dotClass: string;
  /** Human-readable label shown next to the dot. */
  label: string;
};

/**
 * Map connection state → dot color + label. Keeping this as a small lookup
 * table makes adding new states (e.g. `'connecting'`) a one-line change.
 */
const VISUALS: Record<ConnectionState, StatusVisuals> = {
  connected: { dotClass: 'bg-green', label: 'Connected' },
  reconnecting: { dotClass: 'bg-yellow', label: 'Reconnecting…' },
  disconnected: { dotClass: 'bg-pink', label: 'Disconnected' },
};

export function ConnectionStatus({
  status,
  onManualReconnect,
  className,
}: ConnectionStatusProps) {
  const visuals = VISUALS[status];
  const showReconnectButton =
    status === 'disconnected' && typeof onManualReconnect === 'function';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Connection status: ${visuals.label}`}
      className={[
        'inline-flex items-center gap-2 rounded-xl border border-white/10 bg-bg-deep/60 backdrop-blur-md px-3 py-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.5)]',
        'text-sm font-sans font-medium text-white/90',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'inline-block h-2 w-2 rounded-full',
          visuals.dotClass,
          // Pulse on `reconnecting` to give a hint of activity.
          status === 'reconnecting' ? 'animate-pulse' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      />
      <span className="font-medium">{visuals.label}</span>
      {showReconnectButton ? (
        <button
          type="button"
          onClick={onManualReconnect}
          className={[
            'ml-1 rounded-md px-2 py-0.5 text-xs font-semibold',
            'bg-purple text-white transition hover:bg-purple/90',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-purple',
          ].join(' ')}
        >
          Reconnect
        </button>
      ) : null}
    </div>
  );
}

export default ConnectionStatus;
