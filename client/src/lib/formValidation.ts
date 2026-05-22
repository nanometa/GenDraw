/**
 * Pure form-validation helpers shared by the Create Room and Join Room
 * pages. Exists so that the same length / range bounds are applied in the
 * UI (inline error messages, submit-button gating) and in the property
 * tests that exercise the bounds directly.
 *
 * Anchors Property 4 from the design document:
 *   "submit button is enabled iff
 *      1 ≤ len(playerName) ≤ 20
 *      ∧ 1 ≤ len(roomName) ≤ 30
 *      ∧ 2 ≤ maxPlayers ≤ 8
 *      ∧ 1 ≤ rounds ≤ 5"
 *
 * Length checks are performed on the trimmed string so leading/trailing
 * whitespace cannot satisfy a bound by itself (Requirement 2.7 / 3.1).
 */

// ---------------------------------------------------------------------------
// Bounds (Requirements 2.1, 3.1)
// ---------------------------------------------------------------------------

export const PLAYER_NAME_MIN = 0;
export const PLAYER_NAME_MAX = 20;
export const ROOM_NAME_MIN = 1;
export const ROOM_NAME_MAX = 30;
export const MAX_PLAYERS_MIN = 2;
export const MAX_PLAYERS_MAX = 8;
export const ROUNDS_MIN = 1;
export const ROUNDS_MAX = 10;

// ---------------------------------------------------------------------------
// Create Room
// ---------------------------------------------------------------------------

export interface CreateRoomFormValues {
  playerName: string;
  roomName: string;
  maxPlayers: number;
  rounds: number;
}

export interface CreateRoomFormErrors {
  playerName?: string;
  roomName?: string;
  maxPlayers?: string;
  rounds?: string;
}

function nameLengthError(
  value: string,
  field: string,
  min: number,
  max: number,
): string | undefined {
  const trimmed = value.trim();
  // PLAYER_NAME_MIN is 0 — empty names are valid (the contract stores the
  // wallet address as the display value when the name is omitted).
  if (min > 0 && trimmed.length < min) {
    return `${field} is required`;
  }
  if (trimmed.length > max) {
    return `${field} must be at most ${max} characters`;
  }
  return undefined;
}

function integerRangeError(
  value: number,
  field: string,
  min: number,
  max: number,
): string | undefined {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value)
  ) {
    return `${field} must be a whole number`;
  }
  if (value < min || value > max) {
    return `${field} must be between ${min} and ${max}`;
  }
  return undefined;
}

/**
 * Compute inline validation errors for the Create Room form. Returns an
 * empty object when every field satisfies its bounds.
 */
export function validateCreateRoom(
  values: CreateRoomFormValues,
): CreateRoomFormErrors {
  const errors: CreateRoomFormErrors = {};
  const playerNameErr = nameLengthError(
    values.playerName,
    'Player name',
    PLAYER_NAME_MIN,
    PLAYER_NAME_MAX,
  );
  if (playerNameErr) errors.playerName = playerNameErr;
  const roomNameErr = nameLengthError(
    values.roomName,
    'Room name',
    ROOM_NAME_MIN,
    ROOM_NAME_MAX,
  );
  if (roomNameErr) errors.roomName = roomNameErr;
  const maxPlayersErr = integerRangeError(
    values.maxPlayers,
    'Max players',
    MAX_PLAYERS_MIN,
    MAX_PLAYERS_MAX,
  );
  if (maxPlayersErr) errors.maxPlayers = maxPlayersErr;
  const roundsErr = integerRangeError(
    values.rounds,
    'Rounds',
    ROUNDS_MIN,
    ROUNDS_MAX,
  );
  if (roundsErr) errors.rounds = roundsErr;
  return errors;
}

/**
 * Convenience predicate: `true` iff every field passes validation. The
 * submit button binds its `disabled` prop to the negation of this value.
 */
export function isCreateRoomValid(values: CreateRoomFormValues): boolean {
  return Object.keys(validateCreateRoom(values)).length === 0;
}

// ---------------------------------------------------------------------------
// Join Room
// ---------------------------------------------------------------------------

export interface JoinRoomFormValues {
  roomCode: string;
  playerName: string;
}

export interface JoinRoomFormErrors {
  roomCode?: string;
  playerName?: string;
}

/**
 * Validate a room code. Accepts either the canonical contract form
 * `room-N` (what `Lobby.tsx` displays and the user copies) or a bare
 * non-negative integer that the submit handler will prefix with
 * `room-`. Anything else is rejected so a typo doesn't reach the
 * contract.
 */
function roomCodeError(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return 'Room code is required';
  }
  if (!/^(?:room-)?\d+$/i.test(trimmed)) {
    return 'Room code looks like "room-0" or just a number.';
  }
  return undefined;
}

/**
 * Normalize whatever the user typed into the canonical `room-N` form
 * the contract expects. Pure / case-insensitive.
 */
export function normalizeRoomCode(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.startsWith('room-')) return trimmed;
  return `room-${trimmed}`;
}

/**
 * Compute inline validation errors for the Join Room form. Returns an
 * empty object when every field satisfies its bounds.
 */
export function validateJoinRoom(
  values: JoinRoomFormValues,
): JoinRoomFormErrors {
  const errors: JoinRoomFormErrors = {};
  const roomCodeErr = roomCodeError(values.roomCode);
  if (roomCodeErr) errors.roomCode = roomCodeErr;
  const playerNameErr = nameLengthError(
    values.playerName,
    'Player name',
    PLAYER_NAME_MIN,
    PLAYER_NAME_MAX,
  );
  if (playerNameErr) errors.playerName = playerNameErr;
  return errors;
}

/** Convenience predicate; submit button binds to its negation. */
export function isJoinRoomValid(values: JoinRoomFormValues): boolean {
  return Object.keys(validateJoinRoom(values)).length === 0;
}
