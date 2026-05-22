/**
 * Shared TypeScript types for the GenDraw GenLayer contract.
 *
 * The deployed contract is `GenDraw` (Python / GenVM) — see contract source
 * in design.md. `room_id` is a string ("room-0", "room-1", …); rooms hold
 * a JSON-encoded blob in storage and the public methods return either the
 * raw room JSON, the secret word, or the leaderboard JSON. These types
 * mirror the parsed shapes consumers receive after `JSON.parse`.
 */

export type RoomStatus = 'waiting' | 'playing' | 'finished';

/** Parsed shape of `rooms[room_id]` after JSON.parse. */
export interface Room {
  room_id: string;
  room_name: string;
  max_players: number;
  rounds: number;
  status: RoomStatus;
  host: string;                              // 0x-prefixed address
  players: Record<string, string>;           // address → display name
  scores: Record<string, number>;            // address → score
  current_round: number;                     // 0 while waiting; 1..rounds
  current_drawer: string;                    // address (empty while waiting)
  /** Global rotation counter: 0 at start_game, +1 each drawer change. */
  turn?: number;
  /** Addresses that have already guessed correctly during the current turn. */
  correct_this_turn?: string[];
  /** Per-player attempts spent on the current turn (max 5). */
  attempts?: Record<string, number>;
}

/** Parsed shape of one row of `get_leaderboard(room_id)`. */
export interface LeaderboardEntry {
  address: string;
  name: string;
  score: number;
}

/** In-memory drawing stroke (normalized coords in [0,1]). */
export interface Stroke {
  points: Array<{ x: number; y: number }>;
  color: string;
  width: number;
  isEraser: boolean;
}

/** Compact wire form sent over `draw:stroke` Socket.IO events. */
export interface WireStroke {
  pts: Array<[number, number]>;
  c: string;
  w: number;
  e: 0 | 1;
}

/** Player tuple used by the lobby/socket layer (mirrors `players` map entries). */
export interface Player {
  address: string;
  name: string;
}

/**
 * Wire-format room state broadcast over `game:state` Socket.IO events.
 *
 * Distinct from {@link Room} (which is the JSON-encoded on-chain shape with
 * snake_case keys and a `players: Record<address, name>` map). The wire
 * shape is camelCased and uses a `players: Player[]` array so the client
 * UI can render the roster directly without re-keying.
 */
export interface RoomState {
  roomId: string;
  status: RoomStatus;
  hostAddress: string;
  players: Player[];
  maxPlayers: number;
  totalRounds: number;
  currentRound: number;
  drawerAddress: string | null;
  scores: Record<string, number>;
}
