/**
 * In-memory registry of active rooms and lifecycle helpers.
 *
 * `GameManager` owns the per-room map referenced throughout the server's
 * socket handlers (tasks 6.x) and round orchestration (tasks 9.x). It is
 * deliberately decoupled from the Contract relay: hydration from
 * Contract views is injected through the constructor so unit and
 * property tests (task 5.2) can substitute a stub without making real
 * RPC calls.
 *
 * Tasks 5.3 (stroke cache + replay) and 5.5 (empty-room cleanup) extend
 * this class with `appendStroke`, `clearStrokes`, replay helpers, and
 * the `disconnect`-driven destroy path.
 *
 * Validates: Requirements 3.6, 4.3, 4.4, 11.2.
 */
import type { Player, Stroke } from '@gendraw/contract';

import {
  DEFAULT_MAX_PLAYERS,
  DEFAULT_TOTAL_ROUNDS,
  createRoom,
  type ServerRoomState,
} from './room.js';

/**
 * Minimal contract-views surface — removed.
 * The server no longer hydrates rooms from contract views.
 */

/**
 * Constructor options for `GameManager`. Views module has been removed
 * since the server no longer calls the contract.
 */
export type GameManagerOptions = Record<string, never>;

/**
 * Reasons `addPlayer` can refuse a join, surfaced back to the socket
 * handler so it can emit a structured `error` event (Requirement 11.3).
 */
export type AddPlayerFailureReason =
  | 'room_not_found'
  | 'room_full'
  | 'already_joined';

/** Discriminated result of `addPlayer`. */
export type AddPlayerResult =
  | { ok: true }
  | { ok: false; reason: AddPlayerFailureReason };

/**
 * Manages the lifetime of every active room on the server.
 *
 * Public API surface for task 5.1:
 *  - `get(roomId)` — synchronous lookup (returns undefined when missing).
 *  - `getOrLoad(roomId)` — async lazy hydration via the views module.
 *  - `addPlayer` — capacity-gated insert (Property 5).
 *  - `removePlayer` — symmetric removal that also keeps `drawerOrder`
 *    consistent so the round orchestrator never picks a stale Drawer.
 *  - `destroy` — clear timers and drop the room from the map.
 *  - `cleanupIfEmpty` — destroy the room only when its last player has
 *    left; called from the socket disconnect handler (task 6.2).
 *
 * Task 5.3 adds `appendStroke` / `clearStrokes` / `getReplay` for the
 * per-round stroke cache that backs `strokes:replay` to late joiners
 * (Requirement 6.9, Property 11). Task 5.5 hooks `destroy` into the
 * socket disconnect path.
 */
export class GameManager {
  /** Active rooms keyed by roomId (decimal string). */
  private readonly rooms: Map<string, ServerRoomState> = new Map();

  constructor(_options: GameManagerOptions = {}) {
    // No-op: views module has been removed.
  }

  /**
   * Synchronous accessor used on hot paths (e.g. `draw:stroke`) where
   * the room is guaranteed to be loaded already.
   */
  get(roomId: string): ServerRoomState | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Lazily create a room. Subsequent calls for the same roomId return the
   * cached instance.
   */
  async getOrLoad(roomId: string): Promise<ServerRoomState> {
    const existing = this.rooms.get(roomId);
    if (existing) return existing;

    const room = createRoom({
      roomId,
      maxPlayers: DEFAULT_MAX_PLAYERS,
      totalRounds: DEFAULT_TOTAL_ROUNDS,
    });
    this.rooms.set(roomId, room);
    return room;
  }

  /**
   * Capacity-gated player insert. The room must already have been
   * hydrated via `getOrLoad`; passing an unknown `roomId` is treated as
   * a hard error so callers cannot silently create rooms by mis-typing.
   *
   * Rejects with `room_full` when `players.size >= maxPlayers` and with
   * `already_joined` when the address is already present so re-emitted
   * `join:room` events (e.g. from a flaky client) are idempotent.
   *
   * Validates: Property 5 (Requirement 3.6).
   */
  addPlayer(roomId: string, player: Player): AddPlayerResult {
    const room = this.rooms.get(roomId);
    if (!room) return { ok: false, reason: 'room_not_found' };

    if (room.players.has(player.address)) {
      return { ok: false, reason: 'already_joined' };
    }
    if (room.players.size >= room.maxPlayers) {
      return { ok: false, reason: 'room_full' };
    }

    room.players.set(player.address, player);
    // Initialize the per-player score slot so reducers and the
    // `game:state` broadcast (task 6.x) always have a numeric value.
    if (!(player.address in room.scores)) {
      room.scores[player.address] = 0;
    }
    return { ok: true };
  }

  /**
   * Remove a player from a room. Also drops the address from
   * `drawerOrder` so the round orchestrator never picks a Drawer that
   * has already left, and adjusts `currentDrawerIndex` to stay in
   * bounds.
   *
   * No-op when the room or address is unknown so disconnect handlers
   * can call this unconditionally.
   */
  removePlayer(roomId: string, address: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.players.delete(address);
    room.guessedThisRound.delete(address);

    const drawerIdx = room.drawerOrder.indexOf(address);
    if (drawerIdx !== -1) {
      room.drawerOrder.splice(drawerIdx, 1);
      // Keep currentDrawerIndex pointing at the same Drawer (or the
      // next one if the removed player came earlier in the order).
      if (drawerIdx < room.currentDrawerIndex) {
        room.currentDrawerIndex = Math.max(0, room.currentDrawerIndex - 1);
      }
      if (
        room.drawerOrder.length === 0 ||
        room.currentDrawerIndex >= room.drawerOrder.length
      ) {
        room.currentDrawerIndex = 0;
      }
    }
  }

  /**
   * Tear down a room: clear its round timer (if any) and remove it from
   * the registry. Task 5.5 calls this from the socket `disconnect`
   * handler when the last player leaves, satisfying Requirement 11.7.
   */
  destroy(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    if (room.roundTimer) {
      room.roundTimer.cancel();
      room.roundTimer = null;
    }
    this.rooms.delete(roomId);
  }

  /**
   * Drop the room from the registry when it has no players left.
   *
   * Intended call site is the socket `disconnect` handler (task 6.2):
   * after `removePlayer(roomId, address)` runs and `player:left` is
   * broadcast, the handler calls `cleanupIfEmpty(roomId)` so the very
   * last disconnect tears the room down without leaking memory or a
   * dangling round timer.
   *
   * Returns `true` only when this call performed the cleanup. Unknown
   * rooms and rooms that still have at least one player return `false`,
   * which lets the disconnect handler stay defensive about ordering and
   * call this unconditionally.
   *
   * Validates: Requirement 11.7, Property 24.
   */
  cleanupIfEmpty(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    if (room.players.size > 0) return false;
    this.destroy(roomId);
    return true;
  }

  /**
   * Append a stroke to the active round's stroke cache.
   *
   * The socket `draw:stroke` handler (task 6.3) calls this after
   * validating that the sender is the current Drawer. The cached strokes
   * are later replayed to late joiners via `getReplay` so the round's
   * in-progress drawing reproduces correctly (Property 11).
   *
   * No-op when the room is unknown so callers can stay defensive about
   * race conditions with `destroy`.
   *
   * Validates: Requirement 6.9, Property 11.
   */
  appendStroke(roomId: string, stroke: Stroke): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.strokes.push(stroke);
  }

  /**
   * Clear the active round's stroke cache.
   *
   * Called in two places per task 5.3:
   *  - The socket `draw:clear` handler (task 6.3) when the Drawer hits
   *    the toolbar's clear button.
   *  - The round orchestrator (task 9.3) on `round:end`, so the next
   *    round starts with an empty replay buffer for any late joiners.
   *
   * No-op when the room is unknown.
   *
   * Validates: Requirement 6.9, Property 11.
   */
  clearStrokes(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.strokes = [];
  }

  /**
   * Return a shallow copy of the active round's stroke cache, suitable
   * for emission as a `strokes:replay` payload to a late joiner.
   *
   * A copy is returned (rather than the live array) so subsequent
   * `appendStroke` / `clearStrokes` calls cannot mutate a payload that
   * has already been handed off to Socket.IO. The `Stroke` objects
   * themselves are shared by reference; the wire serializer treats them
   * as immutable so this is safe.
   *
   * Returns an empty array when the room is unknown so the socket join
   * handler (task 6.2) can call this unconditionally.
   *
   * Validates: Requirement 6.9, Property 11.
   */
  getReplay(roomId: string): Stroke[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return room.strokes.slice();
  }

  /**
   * Record a correct guess by the supplied non-Drawer address and report
   * whether every Guesser in the room has now guessed correctly.
   *
   * The room's Drawer is excluded from the count: a non-final round ends
   * as soon as `players.size - 1` Guessers have guessed (Requirement
   * 9.1). The set is round-scoped — `endRound` clears it before the
   * next round starts so a player who guessed correctly in round N can
   * guess again in round N+1.
   *
   * No-op (returns `false`) when the room is unknown so the guess
   * handler can call this defensively.
   *
   * Validates: Requirement 9.1.
   */
  recordGuess(roomId: string, address: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    room.guessedThisRound.add(address);
    // Drawer never guesses, so the threshold is `players.size - 1`. If
    // the player count somehow drops to 1 mid-round (e.g. every Guesser
    // disconnected) this still terminates the round so the orchestrator
    // can move on rather than waiting for the deadline.
    const guesserCount = Math.max(0, room.players.size - 1);
    return room.guessedThisRound.size >= guesserCount;
  }

  /**
   * Advance the round counter and Drawer pointer.
   *
   * Returns whether the just-completed round was the last in the game,
   * along with the address of the next Drawer (or `null` when the game
   * is finished or the room has no Drawers configured).
   *
   * The round handler (task 9.3) calls this *after* a successful
   * `Contract.end_round` so the broadcast `round:end` payload reflects
   * the correct `nextDrawer`. When the game finishes the room status is
   * flipped to `'finished'` so subsequent socket events can be rejected.
   *
   * No-op when the room is unknown; returns `{ isLast: true, nextDrawer:
   * null }` so the caller still emits a sensible terminal event.
   *
   * Validates: Requirements 9.3, 9.5.
   */
  advanceRound(roomId: string): { isLast: boolean; nextDrawer: string | null } {
    const room = this.rooms.get(roomId);
    if (!room) return { isLast: true, nextDrawer: null };

    // Was the round we just ended the last one?
    const wasLast = room.roundNumber >= room.totalRounds;
    if (wasLast) {
      room.status = 'finished';
      return { isLast: true, nextDrawer: null };
    }

    room.roundNumber += 1;
    if (room.drawerOrder.length > 0) {
      room.currentDrawerIndex =
        (room.currentDrawerIndex + 1) % room.drawerOrder.length;
    }
    const nextDrawer =
      room.drawerOrder.length > 0
        ? (room.drawerOrder[room.currentDrawerIndex] ?? null)
        : null;
    return { isLast: false, nextDrawer };
  }
}
