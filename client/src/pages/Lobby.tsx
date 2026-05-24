/**
 * Lobby page (Requirement 4 + Requirement 5 host-side gate).
 *
 * Validates Requirements:
 *  - 4.1: Copyable room code pill with a 2-second visual "Copied!" confirmation.
 *  - 4.2: On mount the page connects via Socket.IO and renders the players the
 *    server reports in its initial `roster` event.
 *  - 4.3 / 4.4: `player:joined` / `player:left` socket events update the
 *    rendered roster live (delegated to `gameStore.applyPlayerJoined` /
 *    `applyPlayerLeft`, which implement Property 6's set semantics).
 *  - 4.5: Host sees a "Start Game" button that is disabled while
 *    `players.length < 2`.
 *  - 4.6: Non-host players see a waiting message.
 *  - 4.7 / 5.6: When a `game:state` event reports `status === 'playing'`,
 *    every connected client navigates to `/game/${roomId}`.
 *  - 5.1: Pressing Start Game calls `Contract.start_game(roomId)` via
 *    `createContractClient`. Disabled state prevents the call when fewer
 *    than 2 players are present, satisfying Property 7.
 *  - 5.4: The button shows a loading state and is disabled while a tx is
 *    pending.
 *  - 5.5: On `start_game` failure the error message is rendered and the
 *    button is re-enabled.
 *
 * Lifecycle:
 *  - The Session Wallet is initialised once via `walletStore.initialize()`.
 *  - The socket client is created the first time the wallet address is
 *    available; it is torn down on unmount via `disconnect()`.
 *  - All `socket.on(...)` listeners are removed on unmount alongside the
 *    socket itself, so navigation to `/game/${roomId}` does not leave dangling
 *    handlers behind.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Player, RoomState } from '@gendraw/contract';

import { PlayerAvatar } from '../components/PlayerAvatar';
import {
  createReadClient,
  getRoom,
  startGame as startGameTx,
} from '../lib/contract';
import { useWriteClient } from '../lib/useWriteClient';
import {
  createSocketClient,
  resolveSocketUrl,
  type SocketClient,
} from '../lib/socket';
import { useGameStore } from '../store/gameStore';
import { useAccount } from 'wagmi';
import { displayName } from '../lib/addr';
import SiteWordmark from '../components/SiteWordmark';

/**
 * How long the "Copied!" confirmation stays visible after the user clicks
 * the room code pill (Requirement 4.1).
 */
const COPIED_CONFIRMATION_MS = 2000;

export default function Lobby(): JSX.Element {
  const { roomId: routeRoomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  // ── stores ──────────────────────────────────────────────────────────────
  const { address: connectedAddress, isConnected } = useAccount();
  const walletAddress = connectedAddress ?? '';
  const writeClient = useWriteClient();

  const players = useGameStore((s) => s.players);
  const isHost = useGameStore((s) => s.isHost);
  const playerName = useGameStore((s) => s.playerName);
  const pendingTx = useGameStore((s) => s.pendingTx);
  const setPendingTx = useGameStore((s) => s.setPendingTx);
  const setLastTxHash = useGameStore((s) => s.setLastTxHash);
  const setConnection = useGameStore((s) => s.setConnection);
  const applyPlayerJoined = useGameStore((s) => s.applyPlayerJoined);
  const applyPlayerLeft = useGameStore((s) => s.applyPlayerLeft);
  const applyGameState = useGameStore((s) => s.applyGameState);

  // ── local UI state ──────────────────────────────────────────────────────
  const [copied, setCopied] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Keep a ref to the live socket client so cleanup can disconnect it.
  const socketRef = useRef<SocketClient | null>(null);

  // ── 1. Redirect home when the route param is missing ────────────────────
  useEffect(() => {
    if (routeRoomId === undefined || routeRoomId.length === 0) {
      navigate('/', { replace: true });
    }
  }, [routeRoomId, navigate]);

  // ── 2. Wallet must be connected via RainbowKit ─────────────────────────
  useEffect(() => {
    if (!isConnected) {
      navigate('/', { replace: true });
    }
  }, [isConnected, navigate]);

  // ── 3 + 4. Create the socket client and wire event listeners ────────────
  useEffect(() => {
    if (routeRoomId === undefined || routeRoomId.length === 0) return;
    if (walletAddress.length === 0) return;
    // Guard against StrictMode double-invocation: only create once.
    if (socketRef.current !== null) return;

    const client = createSocketClient({
      url: resolveSocketUrl(),
      roomId: routeRoomId,
      address: walletAddress,
      name: playerName,
      onStatusChange: setConnection,
    });
    socketRef.current = client;

    const { socket } = client;

    // Initial roster sent by the server's join handler in response to
    // `join:room`. The store reducer is idempotent, so we can just dispatch
    // each player through `applyPlayerJoined` instead of replacing the list.
    const handleRoster = (payload: { players: Player[] }): void => {
      for (const player of payload.players) {
        applyPlayerJoined(player);
      }
    };

    const handlePlayerJoined = (player: Player): void => {
      applyPlayerJoined(player);
    };

    const handlePlayerLeft = (payload: { address: string }): void => {
      applyPlayerLeft(payload.address);
    };

    const handleGameState = (state: RoomState): void => {
      applyGameState(state);
      if (state.status === 'playing') {
        // Req 4.7 / 5.6: every client navigates to the Game page.
        navigate(`/game/${state.roomId}`);
      }
    };

    socket.on('roster', handleRoster);
    socket.on('player:joined', handlePlayerJoined);
    socket.on('player:left', handlePlayerLeft);
    socket.on('game:state', handleGameState);

    return () => {
      socket.off('roster', handleRoster);
      socket.off('player:joined', handlePlayerJoined);
      socket.off('player:left', handlePlayerLeft);
      socket.off('game:state', handleGameState);
      client.disconnect();
      socketRef.current = null;
    };
  }, [
    routeRoomId,
    walletAddress,
    playerName,
    applyPlayerJoined,
    applyPlayerLeft,
    applyGameState,
    setConnection,
    navigate,
  ]);

  // ── 5. Poll the contract for the authoritative room state ──────────────
  // The Socket.IO server is just a real-time relay; the on-chain `room`
  // is the source of truth for who has joined and whether the game has
  // started. Polling every 2 s keeps the lobby in sync even when other
  // players join from a different machine that doesn't share the same
  // socket server, and surfaces the host's `start_game` tx for everyone.
  useEffect(() => {
    if (routeRoomId === undefined || routeRoomId.length === 0) return;
    if (walletAddress.length === 0) return;

    let cancelled = false;
    const readClient = createReadClient();

    const sync = async (): Promise<void> => {
      try {
        const room = await getRoom(readClient, routeRoomId);
        if (cancelled || room === null) return;

        // Refresh the roster from the on-chain `players` map.
        const players: Player[] = Object.entries(room.players).map(
          ([address, name]) => ({ address, name }),
        );
        for (const player of players) {
          applyPlayerJoined(player);
        }
        // Drop anyone who's no longer in the on-chain roster (rare —
        // join_room is the only way to grow it — but keeps the local
        // store consistent if the contract is reset).
        const onChain = new Set(
          players.map((p) => p.address.toLowerCase()),
        );
        for (const local of useGameStore.getState().players) {
          if (!onChain.has(local.address.toLowerCase())) {
            applyPlayerLeft(local.address);
          }
        }

        // Mirror status / drawer / scores so `applyGameState` semantics
        // match what the server-driven path would do.
        applyGameState({
          roomId: room.room_id,
          status: room.status,
          hostAddress: room.host,
          players,
          maxPlayers: room.max_players,
          totalRounds: room.rounds,
          currentRound: room.current_round,
          drawerAddress:
            room.current_drawer.length > 0 ? room.current_drawer : null,
          scores: room.scores,
        });

        if (room.status === 'playing') {
          navigate(`/game/${room.room_id}`);
        }
      } catch {
        // Transient RPC errors are ignored — the next poll retries.
      }
    };

    void sync();
    const handle = window.setInterval(() => {
      void sync();
    }, 2_000);

    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [
    routeRoomId,
    walletAddress,
    applyPlayerJoined,
    applyPlayerLeft,
    applyGameState,
    navigate,
  ]);

  // ── derived values ──────────────────────────────────────────────────────
  const startDisabled = useMemo(
    () => players.length < 2 || pendingTx !== null,
    [players.length, pendingTx],
  );

  const startSubmitting = pendingTx?.kind === 'start_game';

  // ── 5. Handlers ─────────────────────────────────────────────────────────
  async function handleCopyRoomCode(): Promise<void> {
    if (routeRoomId === undefined) return;
    try {
      // `navigator.clipboard` is async and rejects on permission denial
      // (e.g. when running over plain http on a non-localhost origin).
      await navigator.clipboard.writeText(routeRoomId);
    } catch {
      // Best-effort copy: still flash the confirmation so the user has
      // feedback even if the writeText call rejected. They can manually
      // copy the visible code as a fallback.
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), COPIED_CONFIRMATION_MS);
  }

  async function handleStartGame(): Promise<void> {
    if (startDisabled) return;
    if (writeClient === null) return;
    if (routeRoomId === undefined) return;

    setStartError(null);
    setPendingTx({ kind: 'start_game', startedAt: Date.now() });
    try {
      await writeClient.connectChain();
      const result = await startGameTx(writeClient.client, routeRoomId);
      setLastTxHash(result.hash);
    } catch (err) {
      setStartError(messageFromError(err));
    } finally {
      setPendingTx(null);
    }
  }

  // ── render ──────────────────────────────────────────────────────────────
  if (routeRoomId === undefined || routeRoomId.length === 0) {
    // Effect above will navigate; render a minimal placeholder in the
    // meantime so the page does not crash on the first paint.
    return <main className="min-h-full" />;
  }

  // Background photo for the lobby — kept consistent with the
  // "Create Room" slide on the landing page so the user gets a
  // smooth visual hand-off after submitting the form.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _LOBBY_BG =
    'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1920&q=80';

  return (
    <main className="relative min-h-screen overflow-hidden flex items-center justify-center">
      <div className="relative w-full max-w-3xl flex flex-col items-center gap-8 px-4 py-10 sm:py-16">
        <h2 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-widest uppercase text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
          LOBBY
        </h2>

        <section className="glass relative w-full max-w-lg space-y-6 rounded-3xl p-6 sm:p-7">
          <div className="space-y-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-bg-deep">
              Share this code with friends to invite them
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  void handleCopyRoomCode();
                }}
                aria-label={`Copy room code ${routeRoomId}`}
                className="inline-flex items-center gap-2 rounded-xl border border-yellow/40 bg-yellow/15 px-5 py-2 font-mono text-lg font-bold text-yellow transition-all hover:bg-yellow/25 hover:border-yellow/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow"
              >
                <span>{routeRoomId}</span>
                <span aria-hidden="true" className="text-[10px] uppercase tracking-widest">
                  Copy
                </span>
              </button>
              {copied ? (
                <span
                  role="status"
                  aria-live="polite"
                  className="text-xs font-bold uppercase tracking-widest text-green-bright"
                >
                  Copied
                </span>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-bg-deep">
              Players ({players.length})
            </h3>
            {players.length === 0 ? (
              <p className="rounded-xl border border-bg-deep/20 bg-white/40 px-3 py-3 text-center text-sm text-bg-deep/80 backdrop-blur">
                Waiting for players to join…
              </p>
            ) : (
              <ul className="space-y-2">
                {players.map((player, index) => (
                  <li
                    key={player.address}
                    className="flex items-center gap-3 rounded-xl border border-bg-deep/20 bg-white/40 px-3 py-2.5 backdrop-blur"
                  >
                    <PlayerAvatar player={player} index={index} />
                    <span className="font-semibold text-bg-deep">
                      {displayName(player.address, player.name)}
                    </span>
                    {walletAddress.length > 0 &&
                    player.address.toLowerCase() ===
                      walletAddress.toLowerCase() ? (
                      <span className="ml-auto rounded-full border border-yellow/50 bg-yellow/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-bg-deep">
                        You
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {isHost ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  void handleStartGame();
                }}
                disabled={startDisabled}
                className={[
                  'w-full rounded-xl border border-white/20 bg-white/15 px-4 py-3',
                  'text-sm font-semibold tracking-wide text-white backdrop-blur',
                  'transition-all duration-200 hover:bg-white/25 hover:border-white/30',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
                  'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/15',
                ].join(' ')}
              >
                {startSubmitting
                  ? 'Starting…'
                  : players.length < 2
                    ? 'Waiting for at least 2 players…'
                    : 'Start Game'}
              </button>
              {startError ? (
                <div
                  role="alert"
                  className="rounded-xl border border-pink/40 bg-pink/10 px-3 py-2 text-xs font-semibold text-pink"
                >
                  {startError}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="rounded-xl border border-bg-deep/20 bg-white/40 px-3 py-3 text-center text-sm font-semibold text-bg-deep/80 backdrop-blur">
              Waiting for host to start…
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

/**
 * Pull a human-readable message off any error shape the contract client
 * can throw. Falls back to a safe default so we never render
 * `[object Object]`.
 */
function messageFromError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.length > 0) return err;
  return 'Failed to start game. Please try again.';
}
