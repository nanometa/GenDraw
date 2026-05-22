/**
 * Client-side Socket.IO transport — wraps `socket.io-client` so the rest of
 * the app can reason about a small surface of `connection` state and a single
 * `join:room` handshake.
 *
 * Validates Requirements 11.1, 11.6, 16.4, 16.5:
 *  - On `connect`, emits `join:room` with `{ roomId, address, name }` (Req 11.1).
 *  - Auto-reconnects up to 5 times with exponential backoff `1000 * 2^i` for
 *    `i ∈ [0..4]` (Req 16.4). After exhaustion the caller can drive a manual
 *    reconnect via {@link SocketClient.manualReconnect} (Req 16.5).
 *  - Surfaces a tri-state `connection` value via the supplied
 *    `onStatusChange` callback so the UI can render a banner / retry button
 *    (Req 11.6, 16.4, 16.5).
 *
 * The pure {@link computeBackoffSchedule} helper anchors Property 22
 * (reconnect backoff schedule) — it is exported so a property test can
 * exercise the schedule independently of the live Socket.IO manager.
 */

import { io, type Socket } from 'socket.io-client';

/**
 * Public connection states surfaced to the UI. Matches the design's
 * `connection` field on the `gameStore`.
 */
export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

/** Initial backoff delay used by both the socket manager and Property 22. */
export const DEFAULT_BACKOFF_INITIAL_MS = 1000;

/** Maximum automatic reconnect attempts before manual reconnect is required. */
export const DEFAULT_MAX_RECONNECT_ATTEMPTS = 5;

export interface CreateSocketClientOptions {
  /** Server URL. Defaults to {@link resolveSocketUrl} when undefined. */
  url: string;
  /** Room id for the `join:room` handshake (Req 11.1). */
  roomId: string;
  /** Player Session Wallet address. */
  address: string;
  /** Display name shown to other players. */
  name: string;
  /** Invoked whenever the connection state transitions to a new value. */
  onStatusChange: (status: ConnectionStatus) => void;
  /**
   * Invoked once when automatic reconnect attempts are exhausted (Req 16.5).
   * The UI typically renders a manual-reconnect button at this point.
   */
  onMaxRetries?: () => void;
}

export interface SocketClient {
  /** The underlying `socket.io-client` Socket instance. */
  socket: Socket;
  /**
   * Manually re-attempt connection after automatic reconnects have been
   * exhausted (Req 16.5). No-op if the socket is already connected.
   */
  manualReconnect: () => void;
  /**
   * Permanently disconnect and clean up. After calling, no more status
   * transitions are reported.
   */
  disconnect: () => void;
  /** Read the current connection status without subscribing. */
  getStatus: () => ConnectionStatus;
}

/**
 * Compute the exponential-backoff delay schedule used to pace reconnect
 * attempts. The `i`-th element is the delay (in ms) before the `i`-th attempt
 * and equals `initialMs * 2^i`.
 *
 * With the defaults (`initialMs = 1000`, `maxAttempts = 5`) this returns
 * `[1000, 2000, 4000, 8000, 16000]`, matching the schedule asserted by
 * Property 22 and Requirement 16.4.
 *
 * Pure: depends only on its inputs and uses no global state.
 */
export function computeBackoffSchedule(
  initialMs: number = DEFAULT_BACKOFF_INITIAL_MS,
  maxAttempts: number = DEFAULT_MAX_RECONNECT_ATTEMPTS,
): number[] {
  if (maxAttempts <= 0) return [];
  const schedule: number[] = [];
  for (let i = 0; i < maxAttempts; i += 1) {
    schedule.push(initialMs * Math.pow(2, i));
  }
  return schedule;
}

/**
 * Resolve the Socket.IO server URL from the environment.
 *
 * Strategy:
 *   1. Prefer the Vite env var `VITE_SOCKET_URL`. In production this
 *      is the public URL of the relay (e.g. the Render Web Service);
 *      in dev it is typically `http://localhost:3001`.
 *   2. Fall back to the current page origin so a self-hosted
 *      single-process deployment (client + server on the same host)
 *      keeps working out of the box.
 *   3. As a last resort, use `http://localhost:3000` for non-browser
 *      contexts (tests, scripts).
 *
 * If `VITE_SOCKET_URL` is missing in a Vercel-style split deployment,
 * the fallback to `window.location.origin` will silently point at the
 * Vercel app itself — which can't host a Socket.IO server. We log a
 * loud warning in that case so misconfigured deploys are obvious in
 * the browser console rather than presenting as "no strokes appear".
 */
export function resolveSocketUrl(): string {
  // `import.meta.env` is typed loosely by `vite/client`, so a defensive cast
  // keeps this safe under TS strict mode without depending on env-augmentation
  // declaration files.
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const envUrl = env?.VITE_SOCKET_URL;
  if (typeof envUrl === 'string' && envUrl.length > 0) return envUrl;

  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    // eslint-disable-next-line no-console
    console.warn(
      '[gendraw] VITE_SOCKET_URL is not set. Falling back to %s, which only works ' +
        'when client and relay share an origin. Strokes and chat will not propagate ' +
        'across players in a Vercel-style split deployment until VITE_SOCKET_URL ' +
        'points at the public relay URL.',
      window.location.origin,
    );
    return window.location.origin;
  }

  return 'http://localhost:3000';
}

/**
 * Create a configured Socket.IO client wired to the GenDraw server. The
 * returned object exposes the raw `Socket` plus the handful of imperative
 * controls (`manualReconnect`, `disconnect`, `getStatus`) the UI needs.
 *
 * Status transitions:
 *  - `'disconnected'` on init.
 *  - `'connected'` on the socket's `connect` event; immediately followed by
 *    a `join:room` emit with `{ roomId, address, name }` (Req 11.1).
 *  - `'reconnecting'` on each `reconnect_attempt` from the Socket.IO manager.
 *  - `'disconnected'` on `reconnect_failed` after the 5th attempt fails;
 *    `onMaxRetries` is invoked at this point so the UI can offer a manual
 *    reconnect button (Req 16.5).
 *
 * Backoff is delegated to socket.io-client's built-in scheduler with
 * `randomizationFactor: 0` so the realised delays match
 * {@link computeBackoffSchedule} exactly (`1000, 2000, 4000, 8000, 16000`
 * ms).
 */
export function createSocketClient(opts: CreateSocketClientOptions): SocketClient {
  const { url, roomId, address, name, onStatusChange, onMaxRetries } = opts;

  // 'disconnected' on init (per task spec). We do not invoke onStatusChange
  // synchronously — the caller already knows what they constructed.
  let status: ConnectionStatus = 'disconnected';
  let disposed = false;

  const setStatus = (next: ConnectionStatus): void => {
    if (disposed) return;
    if (status === next) return;
    status = next;
    onStatusChange(next);
  };

  const schedule = computeBackoffSchedule(
    DEFAULT_BACKOFF_INITIAL_MS,
    DEFAULT_MAX_RECONNECT_ATTEMPTS,
  );
  // Schedule is non-empty because DEFAULT_MAX_RECONNECT_ATTEMPTS > 0.
  const initialDelay = schedule[0];
  const maxDelay = schedule[schedule.length - 1];

  const socket: Socket = io(url, {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: DEFAULT_MAX_RECONNECT_ATTEMPTS,
    reconnectionDelay: initialDelay,
    reconnectionDelayMax: maxDelay,
    // Eliminate jitter so the realised schedule equals computeBackoffSchedule.
    randomizationFactor: 0,
  });

  // 'connect' fires on first successful connection and on every successful
  // reconnect, so we centralize the join:room handshake here (Req 11.1).
  socket.on('connect', () => {
    setStatus('connected');
    socket.emit('join:room', { roomId, address, name });
  });

  // Transport-level disconnect — a `reconnect_attempt` will follow if
  // reconnection is enabled, taking us to 'reconnecting'.
  socket.on('disconnect', () => {
    setStatus('disconnected');
  });

  // Manager-level events drive the reconnect lifecycle.
  socket.io.on('reconnect_attempt', () => {
    setStatus('reconnecting');
  });

  socket.io.on('reconnect_failed', () => {
    setStatus('disconnected');
    if (onMaxRetries) onMaxRetries();
  });

  return {
    socket,
    manualReconnect: (): void => {
      if (disposed) return;
      if (socket.connected) return;
      // socket.connect() restarts the connection cycle. socket.io-client
      // resets the internal attempt counter, so the same exponential
      // backoff schedule applies to subsequent failures (Req 16.5).
      socket.connect();
    },
    disconnect: (): void => {
      disposed = true;
      socket.disconnect();
    },
    getStatus: (): ConnectionStatus => status,
  };
}
