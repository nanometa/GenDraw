/**
 * In-memory room state for the GenDraw server.
 *
 * `ServerRoomState` mirrors the design document's "gameManager" data model
 * (Components and Interfaces section). It is intentionally distinct from
 * the wire-format `RoomState` exported by `@gendraw/contract`: the wire
 * shape is what we broadcast over Socket.IO, while this server-side shape
 * additionally tracks server-only fields (the secret `currentWord`, the
 * `roundTimer`, the per-round stroke cache, etc.) that must never leak to
 * clients.
 *
 * Created by task 5.1; extended by tasks 5.3 (stroke cache + replay) and
 * 5.5 (empty-room cleanup) and consumed by the socket handlers in
 * `server/src/socket/`.
 *
 * Validates: Requirements 3.6, 4.3, 4.4, 11.2.
 */
import type { Player, RoomStatus, Stroke } from '@gendraw/contract';

import type { RoundDeadlineHandle } from './timer.js';

/**
 * Default Room configuration applied when `getOrLoad` cannot hydrate from
 * the Contract because the deployed ABI exposes no per-room view. These
 * are the upper bounds permitted by Requirement 2.1 so the capacity gate
 * stays meaningful even before authoritative data arrives.
 */
export const DEFAULT_MAX_PLAYERS = 8;
export const DEFAULT_TOTAL_ROUNDS = 5;

/**
 * Options accepted by `createRoom`. Only `roomId` is required; everything
 * else falls back to `waiting`-status defaults so a freshly created room
 * is immediately useable by the gameManager and socket handlers.
 */
export interface CreateRoomOptions {
  /** Room identifier (decimal string of the on-chain uint room_id). */
  roomId: string;
  /** Address of the player who created the room (Host). */
  hostAddress?: string;
  /** Maximum number of players (clamped to [2, 8] per Requirement 2.1). */
  maxPlayers?: number;
  /** Total rounds for the game (clamped to [1, 5] per Requirement 2.1). */
  totalRounds?: number;
}

/**
 * Server-side room state. Field names follow the design document so the
 * socket handlers (tasks 6.x) and the round timer (task 9.3) can rely on
 * a single shared shape.
 *
 * Notable invariants enforced (or to be enforced) elsewhere:
 *  - `players.size <= maxPlayers` (Property 5, gameManager.addPlayer).
 *  - `currentWord` is non-null only while `status === 'playing'` and is
 *    only ever sent to the current Drawer's socket (Property 8).
 *  - `strokes` represents the current round's strokes only; cleared on
 *    `round:end` by task 5.3.
 */
export interface ServerRoomState {
  /** Room identifier (decimal string of the on-chain uint). */
  roomId: string;
  /** Lifecycle status mirroring the on-chain enum. */
  status: RoomStatus;
  /** Address of the Host (creator of the room). */
  hostAddress: string;
  /** Players currently present, keyed by 0x-prefixed address. */
  players: Map<string, Player>;
  /** Maximum number of players permitted (Requirement 3.6 capacity gate). */
  maxPlayers: number;
  /** Addresses in turn order; populated when the game transitions to `playing`. */
  drawerOrder: string[];
  /** 0-indexed position into `drawerOrder` for the active Drawer. */
  currentDrawerIndex: number;
  /** 1-indexed round number; 0 while in `waiting`. */
  roundNumber: number;
  /** Total rounds for the game (Requirement 2.1 bounds). */
  totalRounds: number;
  /**
   * Secret word for the current round. Server-only — never broadcast.
   * Populated by `views.getCurrentWord` and unicast to the Drawer via
   * `word:assign` (task 9.1).
   */
  currentWord: string | null;
  /**
   * Cached strokes for the current round. Used by task 5.3 to replay the
   * in-progress drawing to late joiners (Requirement 6.9). Cleared on
   * `round:end` and on `draw:clear`.
   */
  strokes: Stroke[];
  /** Per-player score keyed by address. Authoritative copy lives on-chain. */
  scores: Record<string, number>;
  /** Addresses of players who have already guessed correctly this round. */
  guessedThisRound: Set<string>;
  /**
   * Active round-deadline handle, or null when no round is in progress.
   * Cleared by tasks 5.5 / 9.3 via `cancel()` (idempotent).
   */
  roundTimer: RoundDeadlineHandle | null;
  /** Epoch milliseconds at which the active round expires, or null. */
  roundDeadline: number | null;
}

/**
 * Clamp an integer into the inclusive range [min, max]. Used to keep the
 * defaulted Room configuration inside the bounds documented by the
 * Contract ABI / Requirement 2.1 even when a caller passes a stray value.
 */
function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  const intValue = Math.trunc(value);
  if (intValue < min) return min;
  if (intValue > max) return max;
  return intValue;
}

/**
 * Construct a fresh `ServerRoomState` ready for the `waiting` lifecycle.
 *
 * The factory keeps all mutable collections (`players`, `drawerOrder`,
 * `strokes`, `scores`, `guessedThisRound`) as new instances so two rooms
 * never accidentally share state. Tasks 5.3 / 5.5 / 6.x append onto these
 * collections in place; tasks 9.x advance `status`, `roundNumber`, and
 * the Drawer-related fields.
 */
export function createRoom(options: CreateRoomOptions): ServerRoomState {
  const maxPlayers = clamp(
    options.maxPlayers ?? DEFAULT_MAX_PLAYERS,
    2,
    8
  );
  const totalRounds = clamp(
    options.totalRounds ?? DEFAULT_TOTAL_ROUNDS,
    1,
    5
  );
  return {
    roomId: options.roomId,
    status: 'waiting',
    hostAddress: options.hostAddress ?? '',
    players: new Map(),
    maxPlayers,
    drawerOrder: [],
    currentDrawerIndex: 0,
    roundNumber: 0,
    totalRounds,
    currentWord: null,
    strokes: [],
    scores: {},
    guessedThisRound: new Set(),
    roundTimer: null,
    roundDeadline: null,
  };
}
