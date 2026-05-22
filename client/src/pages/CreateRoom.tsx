/**
 * Create Room page (Requirement 2).
 *
 * Submit flow against the GenLayer contract via genlayer-js:
 *   1. `createRoom(name, max_players, rounds)` — host signs.
 *   2. `joinRoom(roomId, playerName)` — same wallet, so the creator becomes
 *      a member of the room.
 *   3. Navigate to `/lobby/${roomId}`.
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';

import {
  createRoom as createRoomTx,
  joinRoom as joinRoomTx,
} from '../lib/contract';
import { useWriteClient } from '../lib/useWriteClient';
import {
  validateCreateRoom,
  isCreateRoomValid,
  PLAYER_NAME_MIN,
  PLAYER_NAME_MAX,
  ROOM_NAME_MIN,
  ROOM_NAME_MAX,
  MAX_PLAYERS_MIN,
  MAX_PLAYERS_MAX,
  ROUNDS_MIN,
  ROUNDS_MAX,
  type CreateRoomFormValues,
} from '../lib/formValidation';
import { useGameStore } from '../store/gameStore';
import SiteWordmark from '../components/SiteWordmark';

const inputClasses =
  'w-full rounded-xl bg-white/10 border-2 border-white/15 px-4 py-3 text-white placeholder-white/40 font-semibold focus:outline-none focus:border-yellow focus:bg-white/15 disabled:opacity-50 transition-colors';
const labelClasses = 'block text-sm font-bold uppercase tracking-wide text-white/80 mb-1.5';
const errorClasses = 'mt-1 text-sm font-semibold text-pink';

const DEFAULT_VALUES: CreateRoomFormValues = {
  playerName: '',
  roomName: '',
  maxPlayers: 4,
  rounds: 3,
};

export default function CreateRoom(): JSX.Element {
  const navigate = useNavigate();
  const { isConnected } = useAccount();
  const writeClient = useWriteClient();
  const setPendingTx = useGameStore((s) => s.setPendingTx);
  const setLastTxHash = useGameStore((s) => s.setLastTxHash);
  const setIdentity = useGameStore((s) => s.setIdentity);
  const setRoom = useGameStore((s) => s.setRoom);
  const pendingTx = useGameStore((s) => s.pendingTx);

  const [values, setValues] = useState<CreateRoomFormValues>(DEFAULT_VALUES);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const errors = useMemo(() => validateCreateRoom(values), [values]);
  const formValid = isCreateRoomValid(values);
  const submitting = pendingTx !== null;
  const submitDisabled = !formValid || submitting || writeClient === null;

  function update<K extends keyof CreateRoomFormValues>(
    key: K,
    value: CreateRoomFormValues[K],
  ): void {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitDisabled || writeClient === null) {
      return;
    }
    setSubmitError(null);
    setTxHash(null);

    const playerName = values.playerName.trim();
    const roomName = values.roomName.trim();
    const { client, address, connectChain } = writeClient;

    setPendingTx({ kind: 'create_room', startedAt: Date.now() });
    let roomId: string;
    try {
      // For extension mode, ensure the wallet is on Studionet before
      // signing. No-op for session mode.
      await connectChain();
      const created = await createRoomTx(
        client,
        roomName,
        values.maxPlayers,
        values.rounds,
      );
      roomId = created.roomId;
      setLastTxHash(created.hash);
    } catch (err) {
      setPendingTx(null);
      setSubmitError(messageFromError(err));
      return;
    }

    setPendingTx({ kind: 'join_room', startedAt: Date.now() });
    try {
      const joined = await joinRoomTx(client, roomId, playerName);
      setLastTxHash(joined.hash);
      setTxHash(joined.hash);
    } catch (err) {
      setPendingTx(null);
      setSubmitError(messageFromError(err));
      return;
    } finally {
      setPendingTx(null);
    }

    setIdentity({ walletAddress: address, playerName });
    setRoom({
      roomId,
      isHost: true,
      totalRounds: values.rounds,
    });

    navigate(`/lobby/${roomId}`);
  }

  return (
    <main className="relative min-h-full flex items-center justify-center p-6 overflow-hidden">
      <form
        className="blobs glass relative w-full max-w-md space-y-5 rounded-3xl p-7 shadow-chunky"
        onSubmit={handleSubmit}
        noValidate
      >
        <header className="space-y-1 text-center">
          <h1 className="font-display text-3xl font-bold text-yellow drop-shadow-[0_3px_0_rgba(0,0,0,0.4)]">
            Create Room
          </h1>
          <p className="text-sm text-white/60">
            Set up your game and invite friends.
          </p>
        </header>

        <div>
          <label className={labelClasses} htmlFor="playerName">
            Your name <span className="text-white/40 font-normal">(optional)</span>
          </label>
          <input
            id="playerName"
            className={inputClasses}
            type="text"
            value={values.playerName}
            onChange={(e) => update('playerName', e.target.value)}
            disabled={submitting}
            maxLength={PLAYER_NAME_MAX + 5}
            placeholder={`Leave empty to use your wallet address`}
            aria-invalid={errors.playerName !== undefined}
            aria-describedby={errors.playerName ? 'playerName-error' : undefined}
          />
          {errors.playerName && (
            <p id="playerName-error" className={errorClasses}>
              {errors.playerName}
            </p>
          )}
        </div>

        <div>
          <label className={labelClasses} htmlFor="roomName">
            Room name
          </label>
          <input
            id="roomName"
            className={inputClasses}
            type="text"
            value={values.roomName}
            onChange={(e) => update('roomName', e.target.value)}
            disabled={submitting}
            maxLength={ROOM_NAME_MAX + 5}
            placeholder={`${ROOM_NAME_MIN}-${ROOM_NAME_MAX} characters`}
            aria-invalid={errors.roomName !== undefined}
            aria-describedby={errors.roomName ? 'roomName-error' : undefined}
          />
          {errors.roomName && (
            <p id="roomName-error" className={errorClasses}>
              {errors.roomName}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClasses} htmlFor="maxPlayers">
              Max players
            </label>
            <input
              id="maxPlayers"
              className={inputClasses}
              type="number"
              min={MAX_PLAYERS_MIN}
              max={MAX_PLAYERS_MAX}
              step={1}
              value={values.maxPlayers}
              onChange={(e) =>
                update('maxPlayers', toIntOrNaN(e.target.value))
              }
              disabled={submitting}
              aria-invalid={errors.maxPlayers !== undefined}
              aria-describedby={
                errors.maxPlayers ? 'maxPlayers-error' : undefined
              }
            />
            {errors.maxPlayers && (
              <p id="maxPlayers-error" className={errorClasses}>
                {errors.maxPlayers}
              </p>
            )}
          </div>

          <div>
            <label className={labelClasses} htmlFor="rounds">
              Rounds
            </label>
            <input
              id="rounds"
              className={inputClasses}
              type="number"
              min={ROUNDS_MIN}
              max={ROUNDS_MAX}
              step={1}
              value={values.rounds}
              onChange={(e) => update('rounds', toIntOrNaN(e.target.value))}
              disabled={submitting}
              aria-invalid={errors.rounds !== undefined}
              aria-describedby={errors.rounds ? 'rounds-error' : undefined}
            />
            {errors.rounds && (
              <p id="rounds-error" className={errorClasses}>
                {errors.rounds}
              </p>
            )}
          </div>
        </div>

        <button
          type="submit"
          className="btn-chunky w-full text-lg"
          disabled={submitDisabled}
        >
          {submitting ? 'Submitting…' : 'Create Room'}
        </button>

        {submitError && (
          <div
            role="alert"
            className="rounded-xl border-2 border-pink/40 bg-pink/10 px-3 py-2 text-sm font-semibold text-pink"
          >
            {submitError}
          </div>
        )}

        {txHash && (
          <div className="rounded-xl border-2 border-green/40 bg-green/10 px-3 py-2 text-sm font-semibold text-green-bright break-all">
            Room created. Tx hash: <span className="font-mono text-xs">{txHash}</span>
          </div>
        )}
      </form>
    </main>
  );
}

function toIntOrNaN(value: string): number {
  const trimmed = value.trim();
  if (trimmed.length === 0) return Number.NaN;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : Number.NaN;
}

function messageFromError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.length > 0) return err;
  return 'Transaction failed. Please try again.';
}
