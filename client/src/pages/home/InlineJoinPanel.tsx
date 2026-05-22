/**
 * Inline Join Room form for the Home SPA. Mirrors the standalone
 * `pages/JoinRoom.tsx` submit flow, but renders without a card wrapper.
 */

import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { joinRoom as joinRoomTx } from '../../lib/contract';
import { useWriteClient } from '../../lib/useWriteClient';
import {
  validateJoinRoom,
  isJoinRoomValid,
  normalizeRoomCode,
  PLAYER_NAME_MAX,
  type JoinRoomFormValues,
} from '../../lib/formValidation';
import { useGameStore } from '../../store/gameStore';
import TxHashLink from '../../components/TxHashLink';

const inputClasses =
  'w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-white/40 font-medium focus:outline-none focus:border-white/40 focus:bg-white/15 disabled:opacity-50 transition-colors backdrop-blur';
const labelClasses =
  'block text-xs font-semibold uppercase tracking-widest text-white/65 mb-1.5';
const errorClasses = 'mt-1 text-xs font-medium text-red';

const DEFAULT_VALUES: JoinRoomFormValues = {
  roomCode: '',
  playerName: '',
};

function rawMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string') return err;
  return '';
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

export default function InlineJoinPanel(): JSX.Element {
  const navigate = useNavigate();
  const writeClient = useWriteClient();
  const setPendingTx = useGameStore((s) => s.setPendingTx);
  const setLastTxHash = useGameStore((s) => s.setLastTxHash);
  const setIdentity = useGameStore((s) => s.setIdentity);
  const setRoom = useGameStore((s) => s.setRoom);
  const pendingTx = useGameStore((s) => s.pendingTx);

  const [values, setValues] = useState<JoinRoomFormValues>(DEFAULT_VALUES);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [joinHash, setJoinHash] = useState<string | null>(null);

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

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (submitDisabled || writeClient === null) return;
    setSubmitError(null);
    setJoinHash(null);

    const roomCode = normalizeRoomCode(values.roomCode);
    const playerName = values.playerName.trim();
    const { client, address, connectChain } = writeClient;

    setPendingTx({ kind: 'join_room', startedAt: Date.now() });
    try {
      await connectChain();
      const joined = await joinRoomTx(client, roomCode, playerName);
      setLastTxHash(joined.hash);
      setJoinHash(joined.hash);
    } catch (err) {
      setPendingTx(null);
      setSubmitError(messageFromJoinError(err));
      return;
    } finally {
      setPendingTx(null);
    }

    setIdentity({ walletAddress: address, playerName });
    setRoom({ roomId: roomCode, isHost: false, totalRounds: 0 });
    navigate(`/lobby/${roomCode}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-4 w-full max-w-md mx-auto"
    >
      <div>
        <label className={labelClasses} htmlFor="join-roomCode">
          Room code
        </label>
        <input
          id="join-roomCode"
          className={inputClasses}
          type="text"
          autoComplete="off"
          value={values.roomCode}
          onChange={(e) => update('roomCode', e.target.value)}
          disabled={submitting}
          placeholder="e.g. room-0"
          aria-invalid={errors.roomCode !== undefined}
        />
        {errors.roomCode && <p className={errorClasses}>{errors.roomCode}</p>}
      </div>

      <div>
        <label className={labelClasses} htmlFor="join-playerName">
          Your name <span className="text-white/35 normal-case font-normal">(optional)</span>
        </label>
        <input
          id="join-playerName"
          className={inputClasses}
          type="text"
          value={values.playerName}
          onChange={(e) => update('playerName', e.target.value)}
          disabled={submitting}
          maxLength={PLAYER_NAME_MAX + 5}
          placeholder="Leave empty to use your wallet address"
        />
      </div>

      <button
        type="submit"
        disabled={submitDisabled}
        className={[
          'w-full rounded-xl border border-white/20 bg-white/15 px-4 py-3',
          'text-sm font-semibold tracking-wide text-white backdrop-blur',
          'transition-all duration-200 hover:bg-white/25 hover:border-white/30',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
          'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/15',
        ].join(' ')}
      >
        {submitting ? 'Joining…' : 'Join Room'}
      </button>

      {submitError && (
        <p
          role="alert"
          className="rounded-xl border border-red/40 bg-red/10 px-3 py-2 text-xs font-medium text-red"
        >
          {submitError}
        </p>
      )}

      {joinHash && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-green/30 bg-green/10 px-3 py-2 text-xs backdrop-blur">
          <span className="font-semibold text-green-bright">Joined room</span>
          <TxHashLink txHash={joinHash} />
        </div>
      )}
    </form>
  );
}
