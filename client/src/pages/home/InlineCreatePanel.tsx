/**
 * Inline Create Room form for the Home SPA.
 *
 * Renders without a wrapper card so the panel blends with the hero
 * background. Mirrors the submit flow of `pages/CreateRoom.tsx`:
 *   1. createRoom(name, max_players, rounds)
 *   2. joinRoom(roomId, playerName)
 *   3. navigate to `/lobby/{roomId}`
 */

import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  createRoom as createRoomTx,
  joinRoom as joinRoomTx,
} from '../../lib/contract';
import { useWriteClient } from '../../lib/useWriteClient';
import {
  validateCreateRoom,
  isCreateRoomValid,
  PLAYER_NAME_MAX,
  ROOM_NAME_MAX,
  MAX_PLAYERS_MIN,
  MAX_PLAYERS_MAX,
  ROUNDS_MIN,
  ROUNDS_MAX,
  type CreateRoomFormValues,
} from '../../lib/formValidation';
import { useGameStore } from '../../store/gameStore';
import TxHashLink from '../../components/TxHashLink';

const inputClasses =
  'w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-white/40 font-medium focus:outline-none focus:border-white/40 focus:bg-white/15 disabled:opacity-50 transition-colors backdrop-blur';
const labelClasses =
  'block text-xs font-semibold uppercase tracking-widest text-white/65 mb-1.5';
const errorClasses = 'mt-1 text-xs font-medium text-red';

const DEFAULT_VALUES: CreateRoomFormValues = {
  playerName: '',
  roomName: '',
  maxPlayers: 4,
  rounds: 3,
};

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

export default function InlineCreatePanel(): JSX.Element {
  const navigate = useNavigate();
  const writeClient = useWriteClient();
  const setPendingTx = useGameStore((s) => s.setPendingTx);
  const setLastTxHash = useGameStore((s) => s.setLastTxHash);
  const setIdentity = useGameStore((s) => s.setIdentity);
  const setRoom = useGameStore((s) => s.setRoom);
  const pendingTx = useGameStore((s) => s.pendingTx);

  const [values, setValues] = useState<CreateRoomFormValues>(DEFAULT_VALUES);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createHash, setCreateHash] = useState<string | null>(null);
  const [joinHash, setJoinHash] = useState<string | null>(null);

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

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (submitDisabled || writeClient === null) return;
    setSubmitError(null);
    setCreateHash(null);
    setJoinHash(null);

    const playerName = values.playerName.trim();
    const roomName = values.roomName.trim();
    const { client, address, connectChain } = writeClient;

    setPendingTx({ kind: 'create_room', startedAt: Date.now() });
    let roomId: string;
    try {
      await connectChain();
      const created = await createRoomTx(
        client,
        roomName,
        values.maxPlayers,
        values.rounds,
      );
      roomId = created.roomId;
      setLastTxHash(created.hash);
      setCreateHash(created.hash);
    } catch (err) {
      setPendingTx(null);
      setSubmitError(messageFromError(err));
      return;
    }

    setPendingTx({ kind: 'join_room', startedAt: Date.now() });
    try {
      const joined = await joinRoomTx(client, roomId, playerName);
      setLastTxHash(joined.hash);
      setJoinHash(joined.hash);
    } catch (err) {
      setPendingTx(null);
      setSubmitError(messageFromError(err));
      return;
    } finally {
      setPendingTx(null);
    }

    setIdentity({ walletAddress: address, playerName });
    setRoom({ roomId, isHost: true, totalRounds: values.rounds });
    navigate(`/lobby/${roomId}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-4 w-full max-w-md mx-auto"
    >
      <div>
        <label className={labelClasses} htmlFor="create-playerName">
          Your name <span className="text-white/35 normal-case font-normal">(optional)</span>
        </label>
        <input
          id="create-playerName"
          className={inputClasses}
          type="text"
          value={values.playerName}
          onChange={(e) => update('playerName', e.target.value)}
          disabled={submitting}
          maxLength={PLAYER_NAME_MAX + 5}
          placeholder="Leave empty to use your wallet address"
        />
      </div>

      <div>
        <label className={labelClasses} htmlFor="create-roomName">
          Room name
        </label>
        <input
          id="create-roomName"
          className={inputClasses}
          type="text"
          value={values.roomName}
          onChange={(e) => update('roomName', e.target.value)}
          disabled={submitting}
          maxLength={ROOM_NAME_MAX + 5}
          placeholder="e.g. Friday Night"
          aria-invalid={errors.roomName !== undefined}
        />
        {errors.roomName && <p className={errorClasses}>{errors.roomName}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClasses} htmlFor="create-maxPlayers">
            Max players
          </label>
          <input
            id="create-maxPlayers"
            className={inputClasses}
            type="number"
            min={MAX_PLAYERS_MIN}
            max={MAX_PLAYERS_MAX}
            step={1}
            value={values.maxPlayers}
            onChange={(e) => update('maxPlayers', toIntOrNaN(e.target.value))}
            disabled={submitting}
          />
          {errors.maxPlayers && (
            <p className={errorClasses}>{errors.maxPlayers}</p>
          )}
        </div>
        <div>
          <label className={labelClasses} htmlFor="create-rounds">
            Rounds
          </label>
          <input
            id="create-rounds"
            className={inputClasses}
            type="number"
            min={ROUNDS_MIN}
            max={ROUNDS_MAX}
            step={1}
            value={values.rounds}
            onChange={(e) => update('rounds', toIntOrNaN(e.target.value))}
            disabled={submitting}
          />
          {errors.rounds && <p className={errorClasses}>{errors.rounds}</p>}
        </div>
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
        {submitting ? 'Submitting…' : 'Create Room'}
      </button>

      {submitError && (
        <p
          role="alert"
          className="rounded-xl border border-red/40 bg-red/10 px-3 py-2 text-xs font-medium text-red"
        >
          {submitError}
        </p>
      )}

      {(createHash || joinHash) && (
        <div className="space-y-1.5">
          {createHash && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-green/30 bg-green/10 px-3 py-2 text-xs backdrop-blur">
              <span className="font-semibold text-green-bright">
                Room created
              </span>
              <TxHashLink txHash={createHash} />
            </div>
          )}
          {joinHash && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-green/30 bg-green/10 px-3 py-2 text-xs backdrop-blur">
              <span className="font-semibold text-green-bright">
                Joined room
              </span>
              <TxHashLink txHash={joinHash} />
            </div>
          )}
        </div>
      )}
    </form>
  );
}
