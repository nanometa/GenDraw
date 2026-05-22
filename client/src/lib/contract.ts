/**
 * GenLayer contract integration via genlayer-js.
 *
 * The Session Wallet's private key drives a viem `PrivateKeyAccount` that
 * signs every write. Reads use the same client without an account.
 *
 * Validates Requirements 12.1, 12.2, 12.3, 12.5, 12.6.
 */

import { createClient } from 'genlayer-js';
import {
  TransactionStatus,
  type CalldataEncodable,
  type GenLayerClient,
  type TransactionHash,
} from 'genlayer-js/types';
import type { WalletClient } from 'viem';

import {
  CONTRACT_ADDRESS,
  type LeaderboardEntry,
  type Room,
} from '@gendraw/contract';
import { studionetChain } from './wagmi';

// ─── Errors ────────────────────────────────────────────────────────────────

/**
 * Raised by write helpers when `waitForTransactionReceipt` times out before
 * consensus reaches the requested status. The router-level error UI maps
 * `code === 'CONSENSUS_TIMEOUT'` to the retryable consensus-timeout modal.
 */
export class ConsensusTimeoutError extends Error {
  readonly code = 'CONSENSUS_TIMEOUT' as const;
  constructor(public readonly hash: TransactionHash, message?: string) {
    super(message ?? `Consensus timeout for transaction ${hash}`);
    this.name = 'ConsensusTimeoutError';
  }
}

/**
 * Raised by read/write helpers when the underlying genlayer-js call fails
 * (network unreachable, contract revert, decoding error). Carries the
 * failing `operation` name so the UI can render
 * "<operation>: <message>" per Requirement 12.6.
 */
export class ContractError extends Error {
  readonly code = 'CONTRACT_ERROR' as const;
  constructor(
    public readonly operation: string,
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(`${operation}: ${message}`);
    this.name = 'ContractError';
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return String(err);
}

// ─── Client factories ──────────────────────────────────────────────────────

// genlayer-js's `GenLayerClient` generic is parameterised by its own
// `GenLayerChain` type, but we use `defineChain` from viem and cast at
// the boundary. Widening to `unknown` keeps callers from leaking SDK
// internals into their own type signatures.
export type ReadClient = GenLayerClient<never>;
export type WriteClient = GenLayerClient<never>;

/** Build a read-only client (no account). */
export function createReadClient(): ReadClient {
  return createClient({
    chain: studionetChain as never,
  }) as unknown as ReadClient;
}

/**
 * Build a genlayer-js write client backed by a wagmi `WalletClient`.
 *
 * The wagmi wallet client carries:
 *  - the user's connected address (`account`),
 *  - the EIP-1193 `transport` to the browser wallet, and
 *  - the chain wagmi has already switched the wallet to.
 *
 * We forward the address as the genlayer-js account and the underlying
 * provider as the `provider` so the SDK knows to delegate signing to the
 * wallet popup instead of trying to sign locally.
 */
export function createWalletClientFromWagmi(
  walletClient: WalletClient,
): WriteClient {
  const address = walletClient.account?.address;
  if (address === undefined) {
    throw new Error('Wagmi wallet client has no connected account');
  }
  const provider = (walletClient.transport as unknown as { value?: unknown })
    .value;
  return createClient({
    chain: studionetChain as never,
    account: address,
    // genlayer-js types `provider` as its own `EthereumProvider`; the
    // wagmi transport's underlying value implements the EIP-1193 surface
    // the SDK actually exercises, so the cast is sound at the boundary.
    provider: provider as never,
  }) as unknown as WriteClient;
}

// ─── Reads ─────────────────────────────────────────────────────────────────

async function read<T>(
  operation: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw new ContractError(operation, errorMessage(err), err);
  }
}

/**
 * Returns parsed Room or null when the contract returns "{}" (room not
 * found). The contract serialises the room as a JSON string.
 */
export async function getRoom(
  client: ReadClient,
  roomId: string,
): Promise<Room | null> {
  const raw = await read('get_room', () =>
    client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: 'get_room',
      args: [roomId],
    }),
  );
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string') {
    throw new ContractError(
      'get_room',
      `expected string, got ${typeof raw}`,
    );
  }
  if (raw === '' || raw === '{}') return null;
  try {
    const parsed = JSON.parse(raw) as Room;
    if (parsed === null || typeof parsed !== 'object') return null;
    if (Object.keys(parsed).length === 0) return null;
    return parsed;
  } catch (err) {
    throw new ContractError('get_room', errorMessage(err), err);
  }
}

/**
 * Returns the secret word for the active round, or "" when the caller is
 * not the current drawer (contract-enforced via
 * `gl.message.sender_address == current_drawer`).
 *
 * The `account` argument is forwarded to genlayer-js's `readContract`,
 * which reads `account.address` and forwards it as the `from` field on
 * the underlying `gen_call`. Without it the contract sees `0x0` as the
 * sender and refuses to release the word, so this argument is
 * effectively required for the drawer's poll to succeed.
 */
export async function getCurrentWord(
  client: ReadClient | WriteClient,
  roomId: string,
  fromAddress?: `0x${string}`,
): Promise<string> {
  const raw = await read('get_current_word', () =>
    client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: 'get_current_word',
      args: [roomId],
      // genlayer-js reads `account.address` (line 611 of its index.js)
      // and falls back to zeroAddress when it can't pull a string off
      // the property, so we wrap the bare hex address in a viem-style
      // { address } object. Casting to `never` keeps strict TS happy
      // since the SDK's full Account type carries optional signing
      // fields we don't need for a read.
      ...(fromAddress !== undefined
        ? { account: { address: fromAddress } as never }
        : {}),
    }),
  );
  if (raw === null || raw === undefined) return '';
  if (typeof raw !== 'string') {
    throw new ContractError(
      'get_current_word',
      `expected string, got ${typeof raw}`,
    );
  }
  return raw;
}

export async function getLeaderboard(
  client: ReadClient,
  roomId: string,
): Promise<LeaderboardEntry[]> {
  const raw = await read('get_leaderboard', () =>
    client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: 'get_leaderboard',
      args: [roomId],
    }),
  );
  if (raw === null || raw === undefined) return [];
  if (typeof raw !== 'string') {
    throw new ContractError(
      'get_leaderboard',
      `expected string, got ${typeof raw}`,
    );
  }
  if (raw === '' || raw === '[]') return [];
  try {
    const parsed = JSON.parse(raw) as LeaderboardEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    throw new ContractError('get_leaderboard', errorMessage(err), err);
  }
}

export async function getRoomCount(client: ReadClient): Promise<number> {
  const raw = await read('get_room_count', () =>
    client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: 'get_room_count',
    }),
  );
  return toNumber('get_room_count', raw);
}

export async function getTotalGames(client: ReadClient): Promise<number> {
  const raw = await read('get_total_games', () =>
    client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: 'get_total_games',
    }),
  );
  return toNumber('get_total_games', raw);
}

/** Total size of the on-chain word pool (seed + custom). */
export async function getPoolSize(client: ReadClient): Promise<number> {
  const raw = await read('get_pool_size', () =>
    client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: 'get_pool_size',
    }),
  );
  return toNumber('get_pool_size', raw);
}

/**
 * Current week id. Manually controlled by the contract owner via
 * `advanceWeek` — there is no automatic 7-day rollover because GenVM
 * does not expose a deterministic timestamp.
 */
export async function getCurrentWeekId(client: ReadClient): Promise<number> {
  const raw = await read('get_current_week_id', () =>
    client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: 'get_current_week_id',
    }),
  );
  return toNumber('get_current_week_id', raw);
}

export interface WeeklyLeaderboardEntry {
  address: string;
  score: number;
}

/**
 * Top `topN` entries of the current week's leaderboard. Pass `0` to fetch
 * the entire week without a cap.
 */
export async function getWeeklyLeaderboard(
  client: ReadClient,
  topN: number,
): Promise<WeeklyLeaderboardEntry[]> {
  const raw = await read('get_weekly_leaderboard', () =>
    client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: 'get_weekly_leaderboard',
      args: [BigInt(topN)],
    }),
  );
  return parseWeekly(raw);
}

/** Top `topN` entries of an arbitrary historical week (by id). */
export async function getWeeklyLeaderboardFor(
  client: ReadClient,
  weekId: number,
  topN: number,
): Promise<WeeklyLeaderboardEntry[]> {
  const raw = await read('get_weekly_leaderboard_for', () =>
    client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: 'get_weekly_leaderboard_for',
      args: [BigInt(weekId), BigInt(topN)],
    }),
  );
  return parseWeekly(raw);
}

function parseWeekly(raw: unknown): WeeklyLeaderboardEntry[] {
  if (raw === null || raw === undefined) return [];
  if (typeof raw !== 'string') {
    throw new ContractError(
      'weekly_leaderboard',
      `expected string, got ${typeof raw}`,
    );
  }
  if (raw.length === 0 || raw === '[]') return [];
  try {
    const parsed = JSON.parse(raw) as Array<Partial<WeeklyLeaderboardEntry>>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is WeeklyLeaderboardEntry =>
          typeof e.address === 'string' && typeof e.score === 'number',
      )
      .sort((a, b) => b.score - a.score);
  } catch (err) {
    throw new ContractError('weekly_leaderboard', errorMessage(err), err);
  }
}

function toNumber(operation: string, value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string' && value !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  throw new ContractError(
    operation,
    `expected numeric value, got ${typeof value}`,
  );
}

// ─── Writes ────────────────────────────────────────────────────────────────

export interface WriteResult {
  hash: TransactionHash;
}

export interface CreateRoomResult extends WriteResult {
  roomId: string;
}

async function submitWrite(
  client: WriteClient,
  operation: string,
  functionName: string,
  args: ReadonlyArray<CalldataEncodable>,
): Promise<TransactionHash> {
  let hash: TransactionHash;
  try {
    hash = (await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName,
      args: [...args],
      value: 0n,
    })) as TransactionHash;
  } catch (err) {
    throw new ContractError(operation, errorMessage(err), err);
  }

  // Studionet writes that touch the LLM (start_game, submit_guess) can
  // sit in COMMITTING/REVEALING for a while. We poll generously: 90
  // attempts × 2 s = 3 minutes worst case before giving up.
  //
  // Even if the wait throws (consensus timeout, RPC blip), the tx hash
  // is already on-chain — we hand it back so the caller can show the
  // explorer link and the lobby's contract poll picks up the new state
  // a few seconds later. We deliberately do NOT throw
  // ConsensusTimeoutError on the ACCEPTED-wait path because that would
  // make every long-running write look like a failure to the user.
  try {
    await client.waitForTransactionReceipt({
      hash,
      status: TransactionStatus.ACCEPTED,
      interval: 2_000,
      retries: 90,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[contract] ${operation} tx ${hash} did not reach ACCEPTED in time`,
      err,
    );
    // Swallow — caller already has the hash. The on-chain state poll
    // (Lobby's setInterval) will reflect the change once consensus
    // catches up.
  }
  return hash;
}

/**
 * Submits create_room and waits for ACCEPTED. The contract assigns
 * sequential ids of the form `"room-{n}"` where `n` is the room count
 * before this call, so we read `getRoomCount()` first and derive the new
 * id from the delta. This avoids depending on the exact shape of the
 * receipt's return-value payload.
 */
export async function createRoom(
  client: WriteClient,
  name: string,
  maxPlayers: number,
  rounds: number,
): Promise<CreateRoomResult> {
  let countBefore: number;
  try {
    countBefore = await getRoomCount(client);
  } catch (err) {
    if (err instanceof ContractError) {
      throw new ContractError(
        'create_room (room count)',
        err.message,
        err.cause,
      );
    }
    throw err;
  }

  const hash = await submitWrite(client, 'create_room', 'create_room', [
    name,
    BigInt(maxPlayers),
    BigInt(rounds),
  ]);

  return { hash, roomId: `room-${countBefore}` };
}

export async function joinRoom(
  client: WriteClient,
  roomId: string,
  playerName: string,
): Promise<WriteResult> {
  const hash = await submitWrite(client, 'join_room', 'join_room', [
    roomId,
    playerName,
  ]);
  return { hash };
}

export async function startGame(
  client: WriteClient,
  roomId: string,
): Promise<WriteResult> {
  const hash = await submitWrite(client, 'start_game', 'start_game', [
    roomId,
  ]);
  return { hash };
}

export async function submitGuess(
  client: WriteClient,
  roomId: string,
  guess: string,
): Promise<WriteResult> {
  const hash = await submitWrite(client, 'submit_guess', 'submit_guess', [
    roomId,
    guess,
  ]);
  return { hash };
}

export async function endRound(
  client: WriteClient,
  roomId: string,
): Promise<WriteResult> {
  const hash = await submitWrite(client, 'end_round', 'end_round', [roomId]);
  return { hash };
}
