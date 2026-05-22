/**
 * Join Room page (Requirement 3).
 *
 * Submit flow:
 *   1. `joinRoom(roomCode, playerName)` — caller signs the tx.
 *   2. On success, render the tx hash and navigate to `/lobby/${roomCode}`.
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';

import { joinRoom as joinRoomTx } from '../lib/contract';
import { useWriteClient } from '../lib/useWriteClient';
import {
  validateJoinRoom,
  isJoinRoomValid,
  normalizeRoomCode,
  PLAYER_NAME_MIN,
  PLAYER_NAME_MAX,
  type JoinRoomFormValues,
} from '../lib/formValidation';
import { useGameStore } from '../store/gameStore';
import SiteWordmark from '../components/SiteWordmark';

const inputClasses =
  'w-full rounded-xl bg-white/10 border-2 border-white/15 px-4 py-3 text-white placeholder-white/40 font-semibold focus:outline-none focus:border-yellow focus:bg-white/15 disabled:opacity-50 transition-colors';
const labelClasses = 'block text-sm font-bold uppercase tracking-wide text-white/80 mb-1.5';
const errorClasses = 'mt-1 text-sm font-semibold text-pink';

const DEFAULT_VALUES: JoinRoomFormValues = {
  roomCode: '',
  playerName: '',
};

export default function JoinRoom(): JSX.Element {
  const navigate = useNavigate();
  const { isConnected } = useAccount();
  const writeClient = useWriteClient();
  const setPendingTx = useGameStore((s) => s.setPendingTx);
  const setLastTxHash = useGameStore((s) => s.setLastTxHash);
  const setIdentity = useGameStore((s) => s.setIdentity);
  const setRoom = useGameStore((s) => s.setRoom);
  const pendingTx = useGameStore((s) => s.pendingTx);

  const [values, setValues] = useState<JoinRoomFormValues>(DEFAULT_VALUES);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const errors = useMemo(() => validateJoinRoom(values), [values]);
  const formValid = isJoinRoomValid(values);
  const submitting = pendingTx !== null;
  const submitDisabled = !formValid || submitting || writeClient === null;

  function update<K extends keyof JoinRoomFormValues>(
    key: K,
    value: JoinRoomFormValues[K],
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

    const roomCode = normalizeRoomCode(values.roomCode);
    const playerName = values.playerName.trim();
    const { client, address, connectChain } = writeClient;

    setPendingTx({ kind: 'join_room', startedAt: Date.now() });
    try {
      await connectChain();
      const joined = await joinRoomTx(client, roomCode, playerName);
      setLastTxHash(joined.hash);
      setTxHash(joined.hash);
    } catch (err) {
      setPendingTx(null);
      setSubmitError(messageFromJoinError(err));
      return;
    } finally {
      setPendingTx(null);
    }

    setIdentity({ walletAddress: address, playerName });
    setRoom({
      roomId: roomCode,
      isHost: false,
      totalRounds: 0,
    });

    navigate(`/lobby/${roomCode}`);
  }

  return (
    <main className="relative min-h-full flex items-center justify-center p-6 overflow-hidden">
      <form
        className="blobs glass relative w-full max-w-md space-y-5 rounded-3xl p-7 shadow-chunky"
        onSubmit={handleSubmit}
        noValidate
      >
        <header className="space-y-1 text-center">
          <h1 className="font-display text-3xl font-bold text-pink drop-shadow-[0_3px_0_rgba(0,0,0,0.4)]">
            Join Room
          </h1>
          <p className="text-sm text-white/60">
            Enter the room code your friend shared with you.
          </p>
        </header>

        <div>
          <label className={labelClasses} htmlFor="roomCode">
            Room code
          </label>
          <input
            id="roomCode"
            className={inputClasses}
            type="text"
            autoComplete="off"
            value={values.roomCode}
            onChange={(e) => update('roomCode', e.target.value)}
            disabled={submitting}
            placeholder="e.g. room-0"
            aria-invalid={errors.roomCode !== undefined}
            aria-describedby={errors.roomCode ? 'roomCode-error' : undefined}
          />
          {errors.roomCode && (
            <p id="roomCode-error" className={errorClasses}>
              {errors.roomCode}
            </p>
          )}
        </div>

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

        <button
          type="submit"
          className="btn-chunky secondary w-full text-lg"
          disabled={submitDisabled}
        >
          {submitting ? 'Joining…' : 'Join Room'}
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
            Joined room. Tx hash: <span className="font-mono text-xs">{txHash}</span>
          </div>
        )}
      </form>
    </main>
  );
}

function messageFromJoinError(err: unknown): string {
  const raw = rawMessage(err).trim();
  const lower = raw.toLowerCase();
  if (
    lower.includes('not found') ||
    lower.includes("doesn't exist") ||
    lower.includes('does not exist')
  ) {
    return 'Room not found. Check the code and try again.';
  }
  if (lower.includes('room is full') || lower.includes('room full')) {
    return 'Room is full.';
  }
  if (
    lower.includes('already started') ||
    lower.includes('not waiting') ||
    lower.includes('in progress')
  ) {
    return 'Game has already started.';
  }
  return raw.length > 0 ? raw : 'Transaction failed. Please try again.';
}

function rawMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string') return err;
  return '';
}
