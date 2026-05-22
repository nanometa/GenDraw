/**
 * Client-side game state store backed by Zustand.
 *
 * Mirrors the design document's "Client State (Zustand)" section. The store
 * holds identity slots (wallet/name copied from `walletStore`), room slots
 * driven by `game:state` and `player:joined` / `player:left` socket events,
 * round slots populated by `word:assign`, `draw:stroke`, `draw:clear`, and
 * `strokes:replay`, and network slots updated by the socket transport.
 *
 * All mutations go through Zustand's `set()` which is synchronous, so the
 * "update local UI state within one rendering frame" guarantee from
 * Requirement 11.5 holds by construction.
 *
 * The roster reducer (`applyPlayerJoined` / `applyPlayerLeft`) implements
 * the set-semantics described in Property 6: joining is idempotent on
 * existing addresses, and leaving is a no-op on absent addresses.
 *
 * Disconnect-resilience (Requirement 16.6) is enforced by gating every
 * inbound state-mutating reducer on `connection === 'connected'`. While
 * the socket is `reconnecting` or `disconnected`, those reducers are
 * no-ops, so the local snapshot the player saw at the moment of the drop
 * is preserved verbatim and resumes when the connection is restored.
 *
 * Outgoing user input attempted while disconnected is buffered in
 * `pendingOutgoing`. The store deliberately does not own the socket — on
 * reconnect, the Game page calls `flushOutgoing()` to drain the queue and
 * re-emit each entry. On permanent disconnect (max retries exhausted) or
 * on `reset()` the queue is cleared via `discardOutgoing()`.
 */

import { create } from 'zustand';
import type {
  Player,
  RoomState,
  RoomStatus,
  Stroke,
} from '@gendraw/contract';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

export interface PendingTx {
  /** Short label describing the in-flight Contract call (e.g. "create_room"). */
  kind: string;
  /** Epoch milliseconds when the transaction was submitted. */
  startedAt: number;
}

export interface GuessCorrectPayload {
  address: string;
  name: string;
  text: string;
  txHash: string;
  scores: Record<string, number>;
}

export interface SetIdentityArgs {
  walletAddress: string;
  playerName: string;
}

export interface SetRoomArgs {
  roomId: string;
  isHost: boolean;
  totalRounds: number;
}

/**
 * Shape of an entry buffered in `pendingOutgoing`. The store stays
 * transport-agnostic, so `kind` is a free-form label (typically the
 * socket event name like `draw:stroke` or `guess:submit`) and `payload`
 * is whatever the caller would have sent had the socket been connected.
 */
export interface PendingOutgoing {
  kind: string;
  payload: unknown;
}

export interface GameStore {
  // ── identity ────────────────────────────────────────────────────────────
  walletAddress: string;
  playerName: string;

  // ── room ────────────────────────────────────────────────────────────────
  roomId: string | null;
  roomStatus: RoomStatus;
  players: Player[];
  isHost: boolean;
  drawerAddress: string | null;
  roundNumber: number;
  totalRounds: number;

  // ── round ───────────────────────────────────────────────────────────────
  /** Populated only for the current Drawer (Requirement 7.1). */
  word: string | null;
  /** Masked hint shown to Guessers (Requirement 7.2). */
  wordHint: string | null;
  /** Strokes recorded for the current round; cleared on `applyClear`. */
  strokes: Stroke[];
  scores: Record<string, number>;

  // ── network ─────────────────────────────────────────────────────────────
  connection: ConnectionStatus;
  lastTxHash: string | null;
  pendingTx: PendingTx | null;
  /**
   * Queue of user-initiated socket emissions deferred while
   * `connection !== 'connected'`. Drained by callers via `flushOutgoing`
   * on reconnect, or cleared via `discardOutgoing` on permanent failure.
   */
  pendingOutgoing: PendingOutgoing[];

  // ── actions ─────────────────────────────────────────────────────────────
  setIdentity(args: SetIdentityArgs): void;
  setRoom(args: SetRoomArgs): void;
  applyPlayerJoined(player: Player): void;
  applyPlayerLeft(address: string): void;
  applyGameState(state: RoomState): void;
  setWord(word: string | null): void;
  setWordHint(hint: string | null): void;
  applyStroke(stroke: Stroke): void;
  setStrokes(strokes: Stroke[]): void;
  applyClear(): void;
  applyGuessCorrect(payload: GuessCorrectPayload): void;
  setConnection(status: ConnectionStatus): void;
  setPendingTx(tx: PendingTx | null): void;
  setLastTxHash(hash: string | null): void;
  enqueueOutgoing(kind: string, payload: unknown): void;
  flushOutgoing(): PendingOutgoing[];
  discardOutgoing(): void;
  reset(): void;
}

/**
 * Initial values for every slot in the store. Re-used by `reset()` so the
 * store can be returned to a clean state between games without falling out
 * of sync if new fields are added later.
 */
const INITIAL_STATE: Omit<
  GameStore,
  | 'setIdentity'
  | 'setRoom'
  | 'applyPlayerJoined'
  | 'applyPlayerLeft'
  | 'applyGameState'
  | 'setWord'
  | 'setWordHint'
  | 'applyStroke'
  | 'setStrokes'
  | 'applyClear'
  | 'applyGuessCorrect'
  | 'setConnection'
  | 'setPendingTx'
  | 'setLastTxHash'
  | 'enqueueOutgoing'
  | 'flushOutgoing'
  | 'discardOutgoing'
  | 'reset'
> = {
  walletAddress: '',
  playerName: '',

  roomId: null,
  roomStatus: 'waiting',
  players: [],
  isHost: false,
  drawerAddress: null,
  roundNumber: 0,
  totalRounds: 0,

  word: null,
  wordHint: null,
  strokes: [],
  scores: {},

  connection: 'disconnected',
  lastTxHash: null,
  pendingTx: null,
  pendingOutgoing: [],
};

/**
 * Compares two Ethereum addresses for equality without case-sensitivity.
 * Ethers returns checksummed addresses while some Contract responses and
 * Socket.IO payloads may use lowercase form, so the roster reducer needs
 * a normalized comparison to avoid duplicate entries (Property 6).
 */
function sameAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...INITIAL_STATE,

  setIdentity({ walletAddress, playerName }) {
    // Identity is a local concern (sourced from walletStore) and must
    // remain settable regardless of socket state.
    set({ walletAddress, playerName });
  },

  setRoom({ roomId, isHost, totalRounds }) {
    set({ roomId, isHost, totalRounds });
  },

  applyPlayerJoined(player) {
    const { players } = get();
    if (players.some((p) => sameAddress(p.address, player.address))) {
      // Idempotent — same address joining twice is a no-op.
      return;
    }
    set({ players: [...players, player] });
  },

  applyPlayerLeft(address) {
    const { players } = get();
    const next = players.filter((p) => !sameAddress(p.address, address));
    if (next.length === players.length) return;
    set({ players: next });
  },

  applyGameState(state) {
    const { walletAddress } = get();
    set({
      roomId: state.roomId,
      roomStatus: state.status,
      players: state.players,
      drawerAddress: state.drawerAddress,
      roundNumber: state.currentRound,
      totalRounds: state.totalRounds,
      scores: state.scores,
      isHost: walletAddress
        ? sameAddress(walletAddress, state.hostAddress)
        : false,
    });
  },

  setWord(word) {
    set({ word });
  },

  setWordHint(hint) {
    set({ wordHint: hint });
  },

  applyStroke(stroke) {
    set({ strokes: [...get().strokes, stroke] });
  },

  setStrokes(strokes) {
    set({ strokes });
  },

  applyClear() {
    set({ strokes: [] });
  },

  applyGuessCorrect(payload) {
    set({
      scores: payload.scores,
      lastTxHash: payload.txHash,
    });
  },

  setConnection(status) {
    // Connection-status updates must always go through, otherwise the
    // gating above would lock the store in a permanent disconnected mode.
    set({ connection: status });
  },

  setPendingTx(tx) {
    set({ pendingTx: tx });
  },

  setLastTxHash(hash) {
    set({ lastTxHash: hash });
  },

  enqueueOutgoing(kind, payload) {
    set({ pendingOutgoing: [...get().pendingOutgoing, { kind, payload }] });
  },

  flushOutgoing() {
    const queued = get().pendingOutgoing;
    if (queued.length === 0) return [];
    set({ pendingOutgoing: [] });
    return queued;
  },

  discardOutgoing() {
    if (get().pendingOutgoing.length === 0) return;
    set({ pendingOutgoing: [] });
  },

  reset() {
    set({ ...INITIAL_STATE });
  },
}));
