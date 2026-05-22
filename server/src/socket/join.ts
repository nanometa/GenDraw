/**
 * `join:room` and `disconnect` handler module.
 *
 * Owns the connection lifecycle for a single Socket.IO socket:
 *
 *   - On `join:room` the player is added to the in-memory `gameManager`
 *     room (creating it lazily via `getOrLoad`), the socket is attached
 *     to the Socket.IO room channel, the joining player is announced to
 *     the rest of the room via `player:joined`, and the joining socket
 *     receives the current roster plus a `strokes:replay` snapshot so a
 *     late joiner sees the in-progress drawing immediately.
 *
 *   - On `disconnect` the player is removed from `gameManager`, a
 *     `player:left` notification is broadcast to the rest of the room,
 *     and `cleanupIfEmpty` runs so the per-room state is not retained
 *     after the last socket leaves (Requirement 11.7).
 *
 * The handler is intentionally idempotent: re-emitting `join:room` from
 * a flaky client (already-joined) is treated as a successful join so
 * the roster and replay are still delivered. `room_full` is the only
 * capacity-class refusal and is surfaced as a structured `error` event.
 *
 * Validates: Requirements 3.3, 4.3, 4.4, 6.9, 11.4.
 */
import type { Server, Socket } from 'socket.io';

import {
  emitError,
  type ResolvedHandlerDeps,
  type SocketHandlerModule,
} from './handlers.js';

/**
 * Wire payload for `join:room`. Mirrors the design document's "Socket
 * events" table: the joining socket identifies the target room, the
 * caller's Session Wallet address (used as the durable player id), and
 * the display name validated client-side.
 */
interface JoinRoomPayload {
  roomId: string;
  address: string;
  name: string;
}

/**
 * Per-socket session state stashed on `socket.data`.
 *
 * Captured at `join:room` time so the `disconnect` listener can clean
 * up the right room without re-parsing the original payload. We attach
 * to `socket.data` rather than module-level state so multiple sockets
 * (e.g. a player who reloads in another tab) stay isolated.
 */
interface JoinSessionData {
  roomId?: string;
  address?: string;
}

/**
 * Validate the inbound payload shape. Returns the typed payload on
 * success, or `null` when any required field is missing/empty so the
 * caller can emit a structured `INVALID_PAYLOAD` error and return.
 *
 * Performs only structural validation; semantic constraints (length
 * bounds, address format) are enforced client-side per Requirement 3.1
 * and re-validated on-chain by the Contract.
 */
function parseJoinPayload(value: unknown): JoinRoomPayload | null {
  if (!value || typeof value !== 'object') return null;
  const payload = value as Partial<JoinRoomPayload>;
  if (typeof payload.roomId !== 'string' || payload.roomId.length === 0) {
    return null;
  }
  if (typeof payload.address !== 'string' || payload.address.length === 0) {
    return null;
  }
  // `name` is optional now (the contract accepts an empty string and
  // stores the address as the display value). We default to the
  // shortened address so other players still see something readable in
  // join/leave system messages.
  const rawName = typeof payload.name === 'string' ? payload.name : '';
  const trimmed = rawName.trim();
  const fallback =
    payload.address.length > 12
      ? `${payload.address.slice(0, 8)}…${payload.address.slice(-4)}`
      : payload.address;
  return {
    roomId: payload.roomId,
    address: payload.address,
    name: trimmed.length > 0 ? trimmed : fallback,
  };
}

const joinHandler: SocketHandlerModule = {
  name: 'join',
  register(io: Server, socket: Socket, deps: ResolvedHandlerDeps): void {
    socket.on('join:room', async (rawPayload: unknown) => {
      const payload = parseJoinPayload(rawPayload);
      if (!payload) {
        emitError(
          socket,
          'INVALID_PAYLOAD',
          'join:room requires { roomId, address, name }'
        );
        return;
      }

      const { roomId, address, name } = payload;

      // Attach the socket to the Socket.IO room channel *before*
      // broadcasting so the new player receives any subsequent
      // room-scoped events. The unicast `player:joined` to the joining
      // socket is intentionally suppressed (`socket.to(roomId)` excludes
      // the sender) since the joining client already knows about itself
      // via the `roster` reply.
      await socket.join(roomId);

      // Persist the session bindings for the matching `disconnect` so
      // we know which room and address to clean up. Cast through
      // `unknown` because `socket.data` is declared as `any` by the
      // socket.io typings and we want a checked write.
      const sessionData = socket.data as JoinSessionData;
      sessionData.roomId = roomId;
      sessionData.address = address;

      const room = await deps.gameManager.getOrLoad(roomId);

      const result = deps.gameManager.addPlayer(roomId, { address, name });
      if (!result.ok) {
        if (result.reason === 'room_full') {
          emitError(socket, 'ROOM_FULL', 'Room is full');
          return;
        }
        if (result.reason === 'room_not_found') {
          // `getOrLoad` should always materialize the room so this is
          // a defensive branch for impossible races.
          emitError(socket, 'ROOM_NOT_FOUND', 'Room not found');
          return;
        }
        // `already_joined` falls through: the join is idempotent so
        // the late joiner still receives the roster + replay below.
      }

      // Broadcast the new arrival to everyone in the room (Req 3.3).
      // Using `io.to(...)` rather than `socket.to(...)` would echo the
      // event back to the joining socket; the joining client learns
      // about itself from the unicast `roster` reply below.
      io.to(roomId).emit('player:joined', { address, name });

      // Unicast the current roster so the joining client can render
      // every existing player without waiting for individual
      // `player:joined` events (Req 4.3 / 4.4).
      socket.emit('roster', {
        players: Array.from(room.players.values()),
      });

      // Replay the in-progress round's strokes to the late joiner so
      // their canvas matches the current drawing (Req 6.9). The
      // returned array is a copy, safe to hand to Socket.IO.
      socket.emit('strokes:replay', deps.gameManager.getReplay(roomId));
    });

    socket.on('disconnect', () => {
      const sessionData = socket.data as JoinSessionData;
      const { roomId, address } = sessionData;
      if (!roomId || !address) return;

      // Order matters: remove from the in-memory room first so the
      // subsequent `cleanupIfEmpty` sees an accurate `players.size`,
      // then announce the departure (Req 11.4: within 2 s of detecting
      // the disconnect — emitting synchronously on the disconnect event
      // satisfies that bound).
      deps.gameManager.removePlayer(roomId, address);
      io.to(roomId).emit('player:left', { address });

      // Drop the room when the last player leaves so per-room state is
      // not retained indefinitely (Req 11.7).
      deps.gameManager.cleanupIfEmpty(roomId);
    });
  },
};

export default joinHandler;
