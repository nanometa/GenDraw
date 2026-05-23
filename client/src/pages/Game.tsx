/**
 * Game page — the active drawing-and-guessing screen.
 *
 * Validates Requirements:
 *  - 5.6: Re-renders the player list, current scores, drawer identity, and
 *    room status in response to `game:state` events emitted by the server.
 *  - 7.4: When the round ends, the modal overlay reveals the full Word to
 *    every player for 5 seconds.
 *  - 8.9: While awaiting a guess validation response, the chat input
 *    remains interactive (the `Chat` input is only disabled when the local
 *    player is the Drawer, never on a per-guess basis).
 *  - 8.12: The chat input is disabled when the local player is the Drawer,
 *    delegated to `Chat`'s `disabled` prop (Property 16).
 *  - 9.4: On `round:end` a modal overlay shows the revealed Word and
 *    scores; it auto-dismisses after 5 seconds.
 *  - 15.1 / 15.2 / 15.3 / 15.4: Single-column layout below the 768 px
 *    breakpoint hides the player list and devotes the available width to
 *    the Canvas (which is constrained to a minimum of 280 px) and chat;
 *    at 768 px and above a 3-column layout (PlayerList | Canvas+Toolbar
 *    +WordHint | Chat) is shown.
 *
 * Lifecycle:
 *  - On mount the Session Wallet is initialised (idempotent) and a Socket.IO
 *    client is created. Every relevant socket event is wired through to the
 *    `gameStore` reducers and a small set of local React-state mirrors
 *    (chat messages, the round-end modal). On unmount every listener is
 *    removed and the socket is disconnected so navigating away does not
 *    leak listeners or sockets.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type {
  LeaderboardEntry,
  Player,
  RoomState,
  Stroke,
  WireStroke,
} from '@gendraw/contract';

import Chat, { type ChatMessage } from '../components/Chat/Chat';
import DrawingCanvas, {
  type DrawingCanvasHandle,
} from '../components/Canvas/DrawingCanvas';
import PlayerAvatar from '../components/PlayerAvatar';
import ReadOnlyCanvas from '../components/Canvas/ReadOnlyCanvas';
import ScoreCounter from '../components/ScoreCounter';
import Toolbar, { TOOLBAR_PALETTE } from '../components/Canvas/Toolbar';
import WordHint from '../components/WordHint';

import { submitGuess as submitGuessTx, endRound as endRoundTx } from '../lib/contract';
import { sanitizeGuess } from '../lib/guess';
import {
  createSocketClient,
  resolveSocketUrl,
  type SocketClient,
} from '../lib/socket';
import { fromWire, toWire } from '../lib/strokes';
import { useGameStore } from '../store/gameStore';
import { useAccount } from 'wagmi';
import { displayName, shortAddr } from '../lib/addr';
import SiteWordmark from '../components/SiteWordmark';
import {
  createReadClient,
  getCurrentWord,
  getRoom,
} from '../lib/contract';
import { useWriteClient } from '../lib/useWriteClient';

/**
 * Duration of the round-end overlay (Requirement 9.4). Pulled out as a
 * constant so the test harness for task 12.6 can reference the same value
 * when validating the auto-dismiss behaviour.
 */
const ROUND_END_OVERLAY_MS = 5_000;

/**
 * Default toolbar starting state. We seed the color from `TOOLBAR_PALETTE`
 * so the active swatch ring lines up with one of the palette buttons on
 * mount, instead of starting with a color that is not in the palette.
 */
const DEFAULT_COLOR = TOOLBAR_PALETTE[2] ?? '#7c3aed';
const DEFAULT_WIDTH = 4;

/** Local view-model for the round-end modal (Requirement 9.4). */
interface RoundEndState {
  open: boolean;
  revealedWord: string;
  scores: Record<string, number>;
}

/**
 * Compose the chat message list shown to a Drawer-only chat panel. Used
 * when the local player is the Drawer so they can still see chat (their
 * input is disabled per Requirement 8.12, but they read everyone else's
 * messages).
 */
const INITIAL_ROUND_END: RoundEndState = {
  open: false,
  revealedWord: '',
  scores: {},
};

/** Lower-case Ethereum address comparator. */
function sameAddr(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Derive a sortable leaderboard array from the score map and the current
 * player list. Used for the round-end modal so the players see ranked
 * scores rather than an unordered map.
 */
function rankedScores(
  scores: Record<string, number>,
  players: Player[],
): LeaderboardEntry[] {
  const byAddr = new Map<string, Player>();
  for (const p of players) byAddr.set(p.address.toLowerCase(), p);

  const entries: LeaderboardEntry[] = Object.entries(scores).map(
    ([address, score]) => {
      const p = byAddr.get(address.toLowerCase());
      return {
        address,
        name: displayName(address, p?.name),
        score,
      };
    },
  );

  entries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.address.toLowerCase().localeCompare(b.address.toLowerCase());
  });
  return entries;
}

export default function Game(): JSX.Element {
  const { roomId: routeRoomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  // ── stores ──────────────────────────────────────────────────────────────
  const { address: connectedAddress, isConnected } = useAccount();
  const walletAddress = connectedAddress ?? '';

  const players = useGameStore((s) => s.players);
  const drawerAddress = useGameStore((s) => s.drawerAddress);
  const playerName = useGameStore((s) => s.playerName);
  const word = useGameStore((s) => s.word);
  const strokes = useGameStore((s) => s.strokes);
  const scores = useGameStore((s) => s.scores);
  const roundNumber = useGameStore((s) => s.roundNumber);
  const totalRounds = useGameStore((s) => s.totalRounds);
  const connection = useGameStore((s) => s.connection);
  const roomStatus = useGameStore((s) => s.roomStatus);
  // Local mirror of `room.host` from the contract poll. Derived in
  // effect 3 below — stored locally rather than in the gameStore so we
  // can compute `isHost` against the live wagmi address even if the
  // gameStore's `walletAddress` slot is stale (it's only set by the
  // CreateRoom / JoinRoom submit flows, not on a fresh page load).
  // Local mirror of the v3 contract turn state. Updated by the contract
  // poll (effect 3) and read by:
  //  - the canvas-wipe effect (clear on drawer rotation, not just round)
  //  - the chat input disabled flag (out of attempts / already correct)
  //  - the attempts counter shown next to the chat
  const [turnNumber, setTurnNumber] = useState<number>(0);
  const [myAttempts, setMyAttempts] = useState<number>(0);
  const [alreadyCorrect, setAlreadyCorrect] = useState<boolean>(false);
  const [attemptsByAddr, setAttemptsByAddr] = useState<Record<string, number>>(
    {},
  );
  const [correctThisTurn, setCorrectThisTurn] = useState<string[]>([]);
  const MAX_ATTEMPTS = 5;
  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - myAttempts);

  const [hostAddress, setHostAddress] = useState<string>('');
  const isHost = useMemo<boolean>(() => {
    if (walletAddress.length === 0 || hostAddress.length === 0) return false;
    return sameAddr(walletAddress, hostAddress);
  }, [walletAddress, hostAddress]);

  const setConnection = useGameStore((s) => s.setConnection);
  const applyPlayerJoined = useGameStore((s) => s.applyPlayerJoined);
  const applyPlayerLeft = useGameStore((s) => s.applyPlayerLeft);
  const applyGameState = useGameStore((s) => s.applyGameState);
  const setWord = useGameStore((s) => s.setWord);
  const applyStroke = useGameStore((s) => s.applyStroke);
  const setStrokes = useGameStore((s) => s.setStrokes);
  const applyClear = useGameStore((s) => s.applyClear);
  const applyGuessCorrect = useGameStore((s) => s.applyGuessCorrect);

  // ── local UI state ──────────────────────────────────────────────────────
  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const [width, setWidth] = useState<number>(DEFAULT_WIDTH);
  const [isEraser, setIsEraser] = useState<boolean>(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [roundEnd, setRoundEnd] = useState<RoundEndState>(INITIAL_ROUND_END);

  // Refs that need to outlive renders (transport, canvas handle).
  const socketRef = useRef<SocketClient | null>(null);
  const canvasRef = useRef<DrawingCanvasHandle | null>(null);
  // Mirror walletAddress into a ref so socket listeners (closed over once
  // at mount) can still resolve the local-drawer test against the latest
  // value if the wallet store updates during a session.
  const walletAddressRef = useRef<string>(walletAddress);
  walletAddressRef.current = walletAddress;

  // Refs that track the host's manual end-round button. Re-entrancy
  // guard so a double-click can't fire two end_round txs back-to-back.
  // (With the v2 contract `submit_guess` auto-rotates the drawer on a
  //  correct guess, so end_round is now strictly a manual "skip this
  //  round, nobody guessed" fallback, not an auto-trigger.)
  const endRoundFiredForRoundRef = useRef<number>(-1);
  const endRoundInflightRef = useRef<boolean>(false);

  // ── derived values ──────────────────────────────────────────────────────
  // Sticky drawer flag: only flip back to `false` when the on-chain
  // drawer is *known* and is *not* us. A transient `null` (poll mid-flight,
  // RPC blip, etc.) keeps the previous value so the DrawingCanvas doesn't
  // unmount and lose its in-memory stroke history every 2 s.
  const isDrawerRef = useRef<boolean>(false);
  const isDrawer = useMemo<boolean>(() => {
    if (walletAddress.length === 0) return false;
    if (drawerAddress === null || drawerAddress.length === 0) {
      // Data not ready — preserve the last known answer.
      return isDrawerRef.current;
    }
    const next = sameAddr(walletAddress, drawerAddress);
    isDrawerRef.current = next;
    return next;
  }, [walletAddress, drawerAddress]);

  // ── 0. Redirect when the route param is missing ─────────────────────────
  useEffect(() => {
    if (routeRoomId === undefined || routeRoomId.length === 0) {
      navigate('/', { replace: true });
    }
  }, [routeRoomId, navigate]);

  // ── 1. Wallet must be connected via RainbowKit before rendering ────────
  useEffect(() => {
    if (!isConnected) {
      navigate('/', { replace: true });
    }
  }, [isConnected, navigate]);

  // ── 2. Create the socket client and wire event listeners ────────────────
  useEffect(() => {
    if (routeRoomId === undefined || routeRoomId.length === 0) return;
    if (walletAddress.length === 0) return;
    // StrictMode double-invocation guard — match the Lobby pattern.
    if (socketRef.current !== null) return;

    const client = createSocketClient({
      url: resolveSocketUrl(),
      roomId: routeRoomId,
      address: walletAddress,
      name: playerName,
      onStatusChange: setConnection,
    });
    socketRef.current = client;

    const { socket } = client;

    // ── roster + lobby reducers ──────────────────────────────────────────
    const handleRoster = (payload: { players: Player[] }): void => {
      for (const p of payload.players) applyPlayerJoined(p);
    };
    const handlePlayerJoined = (p: Player): void => {
      applyPlayerJoined(p);
      const label = displayName(p.address, p.name);
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}-${p.address}`,
          address: p.address,
          name: label,
          text: `${label} joined`,
          kind: 'system',
        },
      ]);
    };
    const handlePlayerLeft = (payload: { address: string }): void => {
      applyPlayerLeft(payload.address);
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}-${payload.address}`,
          address: payload.address,
          name: payload.address,
          text: `Player left`,
          kind: 'system',
        },
      ]);
    };

    // ── game state ───────────────────────────────────────────────────────
    const handleGameState = (state: RoomState): void => {
      applyGameState(state);
      if (state.status === 'finished') {
        navigate(`/results/${state.roomId}`);
      }
    };

    // ── word secrecy ─────────────────────────────────────────────────────
    const handleWordAssign = (payload: { word: string }): void => {
      setWord(payload.word);
    };

    // ── drawing fan-out ──────────────────────────────────────────────────
    const handleDrawStroke = (wire: WireStroke): void => {
      applyStroke(fromWire(wire));
    };
    const handleDrawClear = (): void => {
      applyClear();
    };
    // The server emits `strokes:replay` as Stroke[] (already de-wired), so
    // we accept either shape defensively: when the first element looks
    // like a WireStroke (`pts`/`c`/`w`/`e`) we map through `fromWire`.
    const handleStrokesReplay = (
      payload: Stroke[] | WireStroke[] | undefined,
    ): void => {
      if (!Array.isArray(payload) || payload.length === 0) {
        setStrokes([]);
        return;
      }
      const first = payload[0] as Partial<WireStroke> & Partial<Stroke>;
      const looksWire =
        Array.isArray(first.pts) && typeof first.c === 'string';
      if (looksWire) {
        setStrokes((payload as WireStroke[]).map(fromWire));
      } else {
        setStrokes(payload as Stroke[]);
      }
    };

    // ── guess pipeline ───────────────────────────────────────────────────
    const handleGuessCorrect = (payload: {
      address: string;
      name: string;
      text: string;
      txHash: string;
      scores: Record<string, number>;
    }): void => {
      applyGuessCorrect(payload);
      setMessages((prev) => [
        ...prev,
        {
          id: `correct-${payload.txHash}-${payload.address}`,
          address: payload.address,
          name: payload.name,
          text: `guessed "${payload.text}"`,
          kind: 'correct',
          txHash: payload.txHash,
        },
      ]);
    };
    const handleGuessWrong = (payload: {
      text: string;
      txHash: string;
    }): void => {
      // Only the submitting socket receives `guess:wrong` (Req 8.8), so we
      // attribute the message to the local player.
      setMessages((prev) => [
        ...prev,
        {
          id: `wrong-${payload.txHash}`,
          address: walletAddressRef.current,
          name: 'You',
          text: payload.text,
          kind: 'guess',
          txHash: payload.txHash,
        },
      ]);
    };
    const handleGuessValidating = (_payload: { text: string }): void => {
      // Visual-indicator hook (Req 8.9). The Chat input stays interactive,
      // and the surrounding UI doesn't currently render a per-guess
      // spinner — keeping the listener in place documents the contract.
    };
    const handleGuessError = (payload: { reason: string }): void => {
      setMessages((prev) => [
        ...prev,
        {
          id: `gerr-${Date.now()}`,
          address: walletAddressRef.current,
          name: 'system',
          text: `Guess could not be validated: ${payload.reason}`,
          kind: 'system',
        },
      ]);
    };

    // Real-time chat broadcast from other players' guesses.
    const handleChatGuess = (payload: {
      text: string;
      address: string;
      name: string;
    }): void => {
      // Don't echo our own optimistic message back as a duplicate.
      if (
        payload.address.toLowerCase() ===
        walletAddressRef.current.toLowerCase()
      ) {
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `chat-${Date.now()}-${payload.address}`,
          address: payload.address,
          name: displayName(payload.address, payload.name),
          text: payload.text,
          kind: 'guess',
        },
      ]);
    };

    // ── round / game lifecycle ───────────────────────────────────────────
    const handleRoundEnd = (payload: {
      word: string;
      scores: Record<string, number>;
      nextDrawer: string | null;
    }): void => {
      // Show the modal overlay for ROUND_END_OVERLAY_MS (Req 9.4 / 7.4).
      setRoundEnd({
        open: true,
        revealedWord: payload.word,
        scores: payload.scores,
      });
      window.setTimeout(() => {
        setRoundEnd((cur) => (cur.open ? { ...cur, open: false } : cur));
      }, ROUND_END_OVERLAY_MS);

      // NOTE: we deliberately do NOT call applyClear() here. Round
      // transitions are observed via the contract poll which updates
      // drawerAddress and roundNumber; the next drawer's DrawingCanvas
      // is a fresh component instance with its own empty completedRef,
      // so wiping global strokes here would only erase the previous
      // drawing for late-joining guessers (which the server's stroke
      // cache already handles).
      setWord(null);
    };
    const handleGameEnd = (_payload: {
      scores: Record<string, number>;
      txHash: string | null;
    }): void => {
      navigate(`/results/${routeRoomId}`);
    };

    // ── error fan-out ────────────────────────────────────────────────────
    const handleError = (payload: { code: string; message: string }): void => {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          address: walletAddressRef.current,
          name: 'system',
          text: `[${payload.code}] ${payload.message}`,
          kind: 'system',
        },
      ]);
    };

    // ── attach listeners ─────────────────────────────────────────────────
    socket.on('roster', handleRoster);
    socket.on('player:joined', handlePlayerJoined);
    socket.on('player:left', handlePlayerLeft);
    socket.on('game:state', handleGameState);
    socket.on('word:assign', handleWordAssign);
    socket.on('draw:stroke', handleDrawStroke);
    socket.on('draw:clear', handleDrawClear);
    socket.on('strokes:replay', handleStrokesReplay);
    socket.on('guess:correct', handleGuessCorrect);
    socket.on('guess:wrong', handleGuessWrong);
    socket.on('guess:validating', handleGuessValidating);
    socket.on('guess:error', handleGuessError);
    socket.on('chat:guess', handleChatGuess);
    socket.on('round:end', handleRoundEnd);
    socket.on('game:end', handleGameEnd);
    socket.on('error', handleError);

    return () => {
      socket.off('roster', handleRoster);
      socket.off('player:joined', handlePlayerJoined);
      socket.off('player:left', handlePlayerLeft);
      socket.off('game:state', handleGameState);
      socket.off('word:assign', handleWordAssign);
      socket.off('draw:stroke', handleDrawStroke);
      socket.off('draw:clear', handleDrawClear);
      socket.off('strokes:replay', handleStrokesReplay);
      socket.off('guess:correct', handleGuessCorrect);
      socket.off('guess:wrong', handleGuessWrong);
      socket.off('guess:validating', handleGuessValidating);
      socket.off('guess:error', handleGuessError);
      socket.off('chat:guess', handleChatGuess);
      socket.off('round:end', handleRoundEnd);
      socket.off('game:end', handleGameEnd);
      socket.off('error', handleError);
      client.disconnect();
      socketRef.current = null;
    };
  }, [
    routeRoomId,
    walletAddress,
    playerName,
    setConnection,
    applyPlayerJoined,
    applyPlayerLeft,
    applyGameState,
    setWord,
    applyStroke,
    setStrokes,
    applyClear,
    applyGuessCorrect,
    navigate,
  ]);

  // ── 3. Poll the contract for the authoritative game state ─────────────
  // The on-chain `room` blob is the source of truth for drawer rotation,
  // scores, and round transitions. We poll every 2 s so the guesser's
  // tab stays in sync even when the Socket.IO server is unavailable, and
  // so the host's `start_game` / `end_round` writes propagate without
  // depending on a server-side event push.
  useEffect(() => {
    if (routeRoomId === undefined || routeRoomId.length === 0) return;
    if (walletAddress.length === 0) return;

    let cancelled = false;
    const readClient = createReadClient();

    const sync = async (): Promise<void> => {
      try {
        const room = await getRoom(readClient, routeRoomId);
        if (cancelled || room === null) return;
        const players: Player[] = Object.entries(room.players).map(
          ([address, name]) => ({ address, name }),
        );
        setHostAddress(room.host);
        // v3 turn-state mirrors. `turn` is undefined on a v2-shaped room
        // payload, so we fall back to the round number (no change to
        // canvas wipe behaviour for legacy rooms).
        const liveTurn = typeof room.turn === 'number'
          ? room.turn
          : room.current_round;
        setTurnNumber(liveTurn);
        const attemptsMap = room.attempts ?? {};
        const myAddr = walletAddress.toLowerCase();
        // The contract stores addresses in their wallet-checksum form,
        // so compare case-insensitively.
        let mine = 0;
        for (const [a, n] of Object.entries(attemptsMap)) {
          if (a.toLowerCase() === myAddr) {
            mine = n;
            break;
          }
        }
        setMyAttempts(mine);
        setAttemptsByAddr(attemptsMap);
        const correct = room.correct_this_turn ?? [];
        setAlreadyCorrect(
          correct.some((a) => a.toLowerCase() === myAddr),
        );
        setCorrectThisTurn(correct);
        applyGameState({
          roomId: room.room_id,
          status: room.status,
          hostAddress: room.host,
          players,
          maxPlayers: room.max_players,
          totalRounds: room.rounds,
          currentRound: room.current_round,
          drawerAddress:
            room.current_drawer.length > 0 ? room.current_drawer : null,
          scores: room.scores,
        });
        if (room.status === 'finished') {
          navigate(`/results/${room.room_id}`);
        }
      } catch {
        /* transient — next poll retries */
      }
    };

    void sync();
    const handle = window.setInterval(() => {
      void sync();
    }, 2_000);

    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [routeRoomId, walletAddress, applyGameState, navigate]);

  // ── 3b. Wipe the canvas on every drawer rotation ──────────────────────
  // The v3 contract increments `turn` on every drawer change (atomic with
  // a correct guess or with `end_round`). When `turn` bumps we mirror it
  // with a local stroke wipe + a `draw:clear` broadcast so the server's
  // per-room stroke cache also drops (otherwise late joiners and the new
  // drawer would re-fetch the previous turn's pixels via `strokes:replay`).
  // Falls back to `roundNumber` when the contract pre-dates v3 (no `turn`
  // field on the room payload).
  const lastClearedTurnRef = useRef<number>(0);
  useEffect(() => {
    if (turnNumber <= 0) return;
    if (lastClearedTurnRef.current === turnNumber) return;
    // Skip the very first transition (0 -> 1) when the game first starts:
    // there are no strokes to clear and no stale cache.
    const isFirstStart = lastClearedTurnRef.current === 0;
    lastClearedTurnRef.current = turnNumber;
    if (isFirstStart) return;

    applyClear();
    socketRef.current?.socket.emit('draw:clear');
    setMessages((prev) => [
      ...prev,
      {
        id: `turn-${turnNumber}`,
        address: walletAddressRef.current,
        name: 'system',
        text: `─── Turn ${turnNumber} ───`,
        kind: 'system',
      },
    ]);
  }, [turnNumber, applyClear]);

  // ── 4. Drawer fetches its own word from the contract ──────────────────
  // The contract gates `get_current_word` on `msg.sender == current_drawer`,
  // so the eth_call must carry the drawer's address as `from`. We forward
  // it via genlayer-js's `account` option (wrapping the bare address in
  // a viem account object that the SDK can unwrap). Polling every 2 s
  // covers the case where `start_game` finalises after we mount.
  const writeClient = useWriteClient();
  useEffect(() => {
    if (!isDrawer) {
      setWord(null);
      return;
    }
    if (writeClient === null) return;
    if (routeRoomId === undefined) return;
    if (walletAddress.length === 0) return;

    let cancelled = false;
    const readClient = createReadClient();

    const fetchWord = async (): Promise<void> => {
      try {
        const w = await getCurrentWord(
          readClient,
          routeRoomId,
          walletAddress as `0x${string}`,
        );
        if (cancelled) return;
        if (w.length > 0) setWord(w);
      } catch {
        /* transient — next tick will retry */
      }
    };

    void fetchWord();
    const handle = window.setInterval(() => {
      void fetchWord();
    }, 2_000);

    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [isDrawer, writeClient, routeRoomId, roundNumber, walletAddress, setWord]);

  // ── 4b. (removed in v2) ────────────────────────────────────────────
  // The v2 contract atomically rotates the drawer + advances the round
  // inside `submit_guess` whenever a guess matches. The contract poll
  // (effect 3) picks up the new `current_drawer` / `current_round`
  // within ~2 s, so no client-side end_round trigger is needed on the
  // happy path. The host can still manually skip a round via the "End
  // round" button (handleManualEndRound below).

  // Manual fallback the host can use to skip a round when nobody guesses.
  const handleManualEndRound = (): void => {
    if (writeClient === null) return;
    if (routeRoomId === undefined) return;
    if (endRoundInflightRef.current) return;
    endRoundInflightRef.current = true;
    endRoundFiredForRoundRef.current = roundNumber;
    void (async () => {
      try {
        const { hash } = await endRoundTx(writeClient.client, routeRoomId);
        setMessages((prev) => [
          ...prev,
          {
            id: `endround-manual-${hash}`,
            address: walletAddressRef.current,
            name: 'system',
            text: 'Round ended manually. Next round starting…',
            kind: 'system',
            txHash: hash,
          },
        ]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'end_round failed';
        endRoundFiredForRoundRef.current = -1;
        setMessages((prev) => [
          ...prev,
          {
            id: `endround-manual-err-${Date.now()}`,
            address: walletAddressRef.current,
            name: 'system',
            text: `Couldn't end round: ${msg}`,
            kind: 'system',
          },
        ]);
      } finally {
        endRoundInflightRef.current = false;
      }
    })();
  };

  // ── 5. Drawer-only emit helpers ────────────────────────────────────────
  const handleStroke = (stroke: Stroke): void => {
    const client = socketRef.current;
    if (!client) return;
    client.socket.emit('draw:stroke', toWire(stroke));
  };
  const handleClearFromCanvas = (): void => {
    const client = socketRef.current;
    if (!client) return;
    client.socket.emit('draw:clear');
  };
  const handleClearClicked = (): void => {
    canvasRef.current?.clearCanvas();
  };

  const handleChatSubmit = (text: string): void => {
    const sanitized = sanitizeGuess(text);
    if (sanitized === null) return;
    if (writeClient === null) return;
    if (routeRoomId === undefined) return;

    // Optimistic chat append so the local user sees their guess
    // immediately. Other players will see it via the same broadcast we
    // emit below (server just relays).
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        address: writeClient.address,
        name: 'You',
        text: sanitized,
        kind: 'guess',
      },
    ]);

    // Broadcast over Socket.IO so the drawer (and any other guesser)
    // sees the chat line right away — much faster than waiting for the
    // contract write to finalize.
    const sock = socketRef.current;
    if (sock !== null) {
      sock.socket.emit('chat:guess', {
        text: sanitized,
        address: writeClient.address,
        name: 'Player',
      });
    }

    // Fire-and-forget the on-chain submit_guess. The contract is the
    // source of truth for scoring; result lands in `room.scores` which
    // the Game page poll picks up within a couple seconds.
    void (async () => {
      try {
        const { hash } = await submitGuessTx(
          writeClient.client,
          routeRoomId,
          sanitized,
        );
        setMessages((prev) => [
          ...prev,
          {
            id: `tx-${hash}`,
            address: writeClient.address,
            name: 'system',
            text: `guess submitted on-chain`,
            kind: 'system',
            txHash: hash,
          },
        ]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'submit failed';
        setMessages((prev) => [
          ...prev,
          {
            id: `gerr-${Date.now()}`,
            address: writeClient.address,
            name: 'system',
            text: `guess could not be submitted: ${msg}`,
            kind: 'system',
          },
        ]);
      }
    })();
  };

  const handleManualReconnect = (): void => {
    socketRef.current?.manualReconnect();
  };

  // ── render ──────────────────────────────────────────────────────────────
  if (routeRoomId === undefined || routeRoomId.length === 0) {
    return <main className="min-h-full" />;
  }

  // Player list panel — also used as the dropdown summary on mobile
  // (Requirement 15.2 hides the sidebar; the avatars stay accessible via
  // the always-visible header strip below).
  const playerListPanel = (
    <aside
      aria-label="Player list"
      className="hidden md:flex md:flex-col gap-3 rounded-2xl glass p-4 text-white"
    >
      <h2 className="text-xs font-bold uppercase tracking-widest text-white/70">
        Players ({players.length})
      </h2>
      <ul className="flex flex-col gap-2">
        {players.map((player, index) => {
          const playerScore = scores[player.address] ?? 0;
          const isLocal = sameAddr(player.address, walletAddress);
          const isCurrentDrawer =
            drawerAddress !== null && sameAddr(player.address, drawerAddress);
          const playerLabel = displayName(player.address, player.name);
          // Only meaningful while the round is live and this player is
          // not the drawer. We compare the lowercased address against the
          // attempts map / correct list because the contract may store
          // checksummed mixed-case addresses.
          const myAddrLow = player.address.toLowerCase();
          const triedCount = (() => {
            let n = 0;
            for (const [a, c] of Object.entries(attemptsByAddr)) {
              if (a.toLowerCase() === myAddrLow) {
                n = c;
                break;
              }
            }
            return n;
          })();
          const guessedRight = correctThisTurn.some(
            (a) => a.toLowerCase() === myAddrLow,
          );
          const showAttempts =
            roomStatus === 'playing' && !isCurrentDrawer;
          return (
            <li
              key={player.address}
              className={[
                'flex items-center gap-2 rounded-xl px-2.5 py-2 border',
                isCurrentDrawer
                  ? 'bg-yellow/15 border-yellow/40'
                  : 'bg-white/5 border-white/10',
              ].join(' ')}
            >
              <PlayerAvatar player={player} index={index} />
              <div className="flex flex-1 flex-col leading-tight">
                <span className="truncate text-sm font-semibold">
                  {playerLabel}
                  {isLocal ? (
                    <span className="ml-1 text-[10px] uppercase tracking-wide text-white/50">
                      you
                    </span>
                  ) : null}
                </span>
                {isCurrentDrawer ? (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-yellow">
                    drawing
                  </span>
                ) : showAttempts ? (
                  guessedRight ? (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-green-bright">
                      correct
                    </span>
                  ) : triedCount >= MAX_ATTEMPTS ? (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-pink">
                      out of attempts
                    </span>
                  ) : triedCount > 0 ? (
                    <span className="text-[10px] uppercase tracking-wide text-white/55">
                      {triedCount}/{MAX_ATTEMPTS} tries
                    </span>
                  ) : null
                ) : null}
              </div>
              <span className="text-sm font-bold tabular-nums text-white/90">
                <ScoreCounter value={playerScore} />
              </span>
            </li>
          );
        })}
      </ul>
    </aside>
  );

  // Center column — Toolbar (drawer only), Canvas, WordHint.
  const centerPanel = (
    <section
      aria-label="Drawing area"
      // The center column is a flex column that fills the viewport
      // height; the canvas takes the available space and the footer
      // (word hint + round info) sits at the bottom of the column.
      // No `aspect-square` so the canvas doesn't push the footer off
      // the screen on standard 16:9 monitors.
      className="flex h-full min-h-0 min-w-[280px] flex-col gap-2"
    >
      {isDrawer ? (
        <Toolbar
          color={color}
          onColorChange={setColor}
          width={width}
          onWidthChange={setWidth}
          isEraser={isEraser}
          onEraserToggle={setIsEraser}
          onClear={handleClearClicked}
        />
      ) : null}
      <div
        // Canvas wrapper: `flex-1` so it grows to fill the available
        // vertical space, `min-h-0` so it can shrink below its
        // intrinsic content size. White surface, rounded corners, and
        // a chunky shadow for the same paper feel as before.
        className="relative w-full flex-1 min-h-0 overflow-hidden rounded-3xl bg-white shadow-chunky border-2 border-white/20"
        style={{ minWidth: 280 }}
      >
        {isDrawer ? (
          <DrawingCanvas
            ref={canvasRef}
            color={color}
            width={width}
            isEraser={isEraser}
            backgroundColor="#ffffff"
            onStroke={handleStroke}
            onClear={handleClearFromCanvas}
          />
        ) : (
          <ReadOnlyCanvas strokes={strokes} backgroundColor="#ffffff" />
        )}
      </div>
      {/* Footer strip — word hint, round counter, manual end-round.
          Sits below the canvas inside the flex column so it always
          stays visible without needing to scroll. */}
      <div className="flex flex-col items-center gap-1.5 pb-1">
        {/* Only show the word hint while the game is actively playing */}
        {roomStatus === 'playing' ? (
          <WordHint word={isDrawer ? word : null} isDrawer={isDrawer} />
        ) : null}
        <div className="flex items-center justify-center gap-3 text-xs text-white/60">
          <span>
            Round {Math.max(roundNumber, 1)} / {Math.max(totalRounds, 1)}
          </span>
          {isHost && roomStatus === 'playing' ? (
            <button
              type="button"
              onClick={handleManualEndRound}
              className="rounded-full border border-pink/60 bg-pink/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-pink hover:bg-pink/30 disabled:opacity-50"
              title="End the current round on-chain (host only)"
            >
              End round
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );

  // Chat panel — drawer's input is disabled (Req 8.12 / Property 16).
  // Also disabled when the local guesser has either already guessed
  // correctly (no double-scoring) or burned their 5 attempts. The remaining
  // attempts counter is shown above the input as a small hint.
  const chatDisabled = isDrawer || alreadyCorrect || attemptsLeft <= 0;
  const chatPanel = (
    <div className="flex h-full min-h-[260px] flex-col gap-2">
      {!isDrawer && roomStatus === 'playing' ? (
        <div className="rounded-xl glass px-3 py-2 text-[11px] font-bold uppercase tracking-widest">
          {alreadyCorrect ? (
            <span className="text-green-bright">Correct — wait for next turn</span>
          ) : attemptsLeft <= 0 ? (
            <span className="text-pink">no attempts left</span>
          ) : (
            <span className="text-white/70">
              attempts left: <strong className="text-yellow">{attemptsLeft}</strong>/{MAX_ATTEMPTS}
            </span>
          )}
        </div>
      ) : null}
      <Chat
        messages={messages}
        onSubmit={handleChatSubmit}
        disabled={chatDisabled}
        className="flex-1"
      />
    </div>
  );

  // Round-end modal (Req 9.4 / 7.4). Always rendered so transitions are
  // observable; visibility is controlled by `roundEnd.open`.
  const roundEndModal = roundEnd.open ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Round complete"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
    >
      <div className="glass w-full max-w-md rounded-3xl p-6 text-white shadow-chunky">
        <h2 className="text-center text-xs font-bold uppercase tracking-widest text-white/70">
          Round complete
        </h2>
        <p className="mt-3 text-center font-display text-3xl font-bold text-white">
          The word was{' '}
          <span className="bg-gradient-to-r from-yellow via-pink to-purple bg-clip-text text-transparent">
            {roundEnd.revealedWord}
          </span>
        </p>
        <ol className="mt-5 space-y-1.5">
          {rankedScores(roundEnd.scores, players).map((entry, idx) => (
            <li
              key={entry.address}
              className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-3 py-2"
            >
              <span className="flex items-center gap-2">
                <span className="w-5 text-right text-xs font-bold text-yellow">
                  {idx + 1}
                </span>
                <span className="font-bold">{entry.name}</span>
              </span>
              <span className="font-bold tabular-nums">
                <ScoreCounter value={entry.score} />
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  ) : null;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* ── Slim logo header ───────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-surface/60 px-4 py-2 backdrop-blur">
        <SiteWordmark size="sm" tagline={false} className="text-left" />
        {/* Mobile score strip — visible only below md breakpoint */}
        <div className="flex md:hidden items-center gap-2 overflow-x-auto">
          {players.map((player) => {
            const playerScore = scores[player.address] ?? 0;
            const isLocal = sameAddr(player.address, walletAddress);
            const isCurrentDrawer =
              drawerAddress !== null && sameAddr(player.address, drawerAddress);
            const playerLabel = displayName(player.address, player.name);
            return (
              <div
                key={player.address}
                className={[
                  'flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-white',
                  isCurrentDrawer
                    ? 'border-yellow/50 bg-yellow/15'
                    : 'border-white/10 bg-white/5',
                ].join(' ')}
              >
                <PlayerAvatar player={player} index={players.indexOf(player)} />
                <span className="font-semibold">
                  {isLocal ? 'You' : playerLabel}
                </span>
                <span className="font-bold tabular-nums text-yellow">
                  <ScoreCounter value={playerScore} />
                </span>
              </div>
            );
          })}
        </div>
      </header>

      {/* ── Main 3-column game layout ───────────────────────────────────── */}
      <main
        // Single-column on <768 px (Req 15.2); 3-column at >=768 px (Req 15.3).
        className="grid flex-1 overflow-hidden gap-3 p-3 grid-cols-1 md:grid-cols-[200px_1fr_280px] md:gap-4 md:p-4 [&>*]:min-h-0"
      >
        {playerListPanel}
        {centerPanel}
        {chatPanel}
        {roundEndModal}
      </main>
    </div>
  );
}
