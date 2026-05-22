/**
 * Round-lifecycle handler module.
 *
 * Now a no-op stub — round orchestration via the contract is no longer
 * server-driven. All contract writes (start_game, end_round, etc.) are
 * handled client-side. The server remains a Socket.IO relay for
 * strokes/presence/game-state broadcasts.
 *
 * The exported helpers (`startRound`, `endRound`, `buildRoomStateSnapshot`)
 * are retained as stubs so existing call-sites compile without error.
 */
import type { Server, Socket } from 'socket.io';

import type { Player } from '@gendraw/contract';

import type { ServerRoomState } from '../game/room.js';

import type {
  ResolvedHandlerDeps,
  SocketHandlerModule,
} from './handlers.js';

/**
 * Wall-clock budget for a single round. Retained as a constant for
 * reference; timer scheduling is currently a no-op.
 */
export const ROUND_DURATION_MS = 90_000;

/**
 * Wire-format room state snapshot sent over `game:state` broadcasts.
 * Defined locally since the server no longer depends on a shared
 * `RoomState` type from the contract package for this shape.
 */
export interface WireRoomState {
  roomId: string;
  status: string;
  hostAddress: string;
  players: Player[];
  maxPlayers: number;
  totalRounds: number;
  currentRound: number;
  drawerAddress: string | null;
  scores: Record<string, number>;
}

/**
 * Build a wire-format room state snapshot for the `game:state` broadcast.
 */
export function buildRoomStateSnapshot(room: ServerRoomState): WireRoomState {
  const drawerAddress =
    room.drawerOrder[room.currentDrawerIndex] ?? null;

  const players: Player[] = Array.from(room.players.values()).map((p) => ({
    address: p.address,
    name: p.name,
  }));

  return {
    roomId: room.roomId,
    status: room.status,
    hostAddress: room.hostAddress,
    players,
    maxPlayers: room.maxPlayers,
    totalRounds: room.totalRounds,
    currentRound: room.roundNumber,
    drawerAddress,
    scores: { ...room.scores },
  };
}

/**
 * Dependency bag accepted by the round orchestrator (now just gameManager).
 */
export type RoundDeps = Pick<ResolvedHandlerDeps, 'gameManager'>;

/**
 * Start round — no-op stub. Round orchestration is now client-driven.
 */
export async function startRound(
  _io: Server,
  _roomId: string,
  _deps: RoundDeps,
): Promise<void> {
  // No-op: contract writes are client-driven.
}

/**
 * End round — no-op stub. Round orchestration is now client-driven.
 */
export async function endRound(
  _io: Server,
  _roomId: string,
  _deps: RoundDeps,
): Promise<void> {
  // No-op: contract writes are client-driven.
}

const roundHandler: SocketHandlerModule = {
  name: 'round',
  register(_io: Server, _socket: Socket, _deps: ResolvedHandlerDeps): void {
    // Round orchestration is now client-driven; no socket-event
    // listeners are needed.
  },
};

export default roundHandler;
