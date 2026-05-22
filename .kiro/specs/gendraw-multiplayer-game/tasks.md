# Implementation Plan: GenDraw Multiplayer Game

## Overview

Build the GenDraw multiplayer drawing-and-guessing game as a TypeScript monorepo with three packages: a `client/` (React 18 + Vite + TailwindCSS), a `server/` (Express + Socket.IO), and a shared `contract/` package consumed by both. Implementation proceeds bottom-up: shared types and utilities first, then state stores and transport, then the server gameplay engine, then the client pages, and finally end-to-end wiring. Each correctness property from the design becomes its own optional property-test sub-task placed close to the code it validates.

## Tasks

- [x] 1. Set up workspace and shared contract package
  - [x] 1.1 Initialize monorepo workspace and tooling
    - Create `package.json` workspace root with `client/`, `server/`, `contract/` packages
    - Configure TypeScript, Vite, Vitest, `fast-check`, ESLint, TailwindCSS
    - Add npm scripts for `dev`, `build`, `test`
    - _Requirements: 12.1, 14.2_

  - [x] 1.2 Create shared `contract/` package
    - Add `contract/abi.json` (ABI for the deployed Contract)
    - Add `contract/config.ts` exporting `CHAIN_ID = 61999`, `RPC_URL = 'https://studio.genlayer.com/api'`, `CONTRACT_ADDRESS = '0x3C0C3CdE6eF4D8C11E0cd4E4C2aE04E9981d9776'`
    - Add `contract/types.ts` (Player, Stroke, WireStroke, RoomState, LeaderboardEntry)
    - Add `contract/address.ts` re-exporting the address
    - _Requirements: 12.1, 12.4_

- [x] 2. Implement Session Wallet
  - [x] 2.1 Implement `client/src/lib/sessionWallet.ts`
    - `init()` reads private key from `localStorage` and validates by constructing `new ethers.Wallet(pk).address`
    - On missing or invalid key, generate via `ethers.Wallet.createRandom()` and persist
    - On `localStorage` unavailable, fall back to in-memory wallet and set `persistenceWarning`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 2.2 Property tests for Session Wallet
    - **Property 1: Session Wallet generation produces a valid persisted wallet**
    - **Validates: Requirements 1.1**
    - **Property 2: Session Wallet round-trip persistence**
    - **Validates: Requirements 1.2**
    - **Property 3: Session Wallet recovers from invalid stored keys**
    - **Validates: Requirements 1.4**

  - [x] 2.3 Implement `client/src/store/walletStore.ts` (Zustand)
    - Holds Session Wallet, derived address, and `persistenceWarning` boolean
    - Exposes `address`, `signer`, and a hook for the warning banner
    - _Requirements: 1.3, 1.5_

- [x] 3. Implement contract integration layer
  - [x] 3.1 Implement `client/src/lib/contract.ts`
    - Construct `ethers.JsonRpcProvider` with shared `RPC_URL` and `CHAIN_ID`
    - Wrap `ethers.Contract` with the Session Wallet signer for write calls
    - Implement direct `eth_call` JSON-RPC view helpers (`getRoomCount`, `getTotalGames`, `getLeaderboard`, etc.)
    - Implement `pollFinalization(txHash, intervalMs=2000, timeoutMs=30000)` rejecting with `ConsensusTimeoutError` after 30s
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [ ]* 3.2 Property test for finalization polling
    - **Property 21: Transaction finalization polling**
    - **Validates: Requirements 12.3, 12.5**

  - [x] 3.3 Implement `server/src/contract/relay.ts` and `server/src/contract/views.ts`
    - `submitGuess(roomId, guesser, guess) → { correct, txHash }`
    - `endRound(roomId) → { scores, txHash }` with single-shot retry on failure
    - `getCurrentWord(roomId)` returning the secret word for the active drawer
    - View helpers used by `gameManager.getOrLoad`
    - _Requirements: 5.2, 8.4, 8.5, 9.1, 9.2, 9.7, 11.2_

  - [ ]* 3.4 Unit tests for relay error and retry behavior
    - Cover `endRound` retry-once-then-fail and propagation of `submitGuess` errors
    - _Requirements: 8.11, 9.7_

- [x] 4. Implement pure utilities (strokes, hint, colors, exact match)
  - [x] 4.1 Implement utility modules
    - `client/src/lib/strokes.ts` — normalize/denormalize against canvas size, RAF batching helpers, wire ↔ in-memory `Stroke` conversion
    - `client/src/lib/wordHint.ts` — `buildHint(word)` mapping alnum → `_`, preserving spaces and hyphens
    - `client/src/lib/colors.ts` — `avatarFor(index)` returning a deterministic theme palette color
    - `server/src/lib/exactMatch.ts` — case-insensitive trimmed comparator
    - _Requirements: 6.3, 6.6, 7.2, 7.3, 8.3, 14.1, 14.3_

  - [ ]* 4.2 Property test for stroke coordinate round-trip
    - **Property 10: Stroke coordinate round-trip**
    - **Validates: Requirements 6.3, 6.6**

  - [ ]* 4.3 Property test for word hint masking
    - **Property 12: Word hint masking preserves length and character classes**
    - **Validates: Requirements 7.2, 7.3**

  - [ ]* 4.4 Property test for avatar color determinism
    - **Property 20: Avatar color is a deterministic function of index**
    - **Validates: Requirements 14.3**

  - [ ]* 4.5 Unit tests for `exactMatch` comparator
    - Cover whitespace trimming, case folding, and non-ASCII inputs
    - _Requirements: 8.3_

- [x] 5. Implement server gameManager
  - [x] 5.1 Implement `server/src/game/room.ts` and `server/src/game/gameManager.ts`
    - `RoomState` shape (status, players, drawerOrder, scores, guessedThisRound, etc.)
    - `addPlayer`, `removePlayer`, capacity gate against `max_players`
    - `getOrLoad(roomId)` lazy hydration via Contract views
    - _Requirements: 3.6, 4.3, 4.4, 11.2_

  - [ ]* 5.2 Property test for room capacity gate
    - **Property 5: Room capacity gate**
    - **Validates: Requirements 3.6**

  - [x] 5.3 Implement stroke cache and replay support in `gameManager`
    - `appendStroke`, `clearStrokes`, per-round cache cleared on `round:end`
    - Helper to send cached strokes to late joiners as `strokes:replay`
    - _Requirements: 6.9_

  - [ ]* 5.4 Property test for mid-round stroke replay
    - **Property 11: Mid-round stroke replay reproduces the drawing**
    - **Validates: Requirements 6.9**

  - [x] 5.5 Implement empty-room cleanup in `gameManager`
    - `destroy(roomId)` removes the entry when last socket disconnects
    - _Requirements: 11.7_

  - [ ]* 5.6 Property test for empty-room cleanup
    - **Property 24: Empty-room cleanup**
    - **Validates: Requirements 11.7**

- [x] 6. Implement Socket.IO transport
  - [x] 6.1 Implement server bootstrap and handler router
    - `server/src/index.ts` with Express + Socket.IO server
    - `server/src/socket/handlers.ts` registering each event handler module via auto-discovery so adding handlers does not require editing the router
    - Standard `error` event format `{ code, message }`
    - _Requirements: 11.1, 11.3, 16.1_

  - [x] 6.2 Implement `server/src/socket/join.ts` (`join:room` handler)
    - Add player to `gameManager`, broadcast `player:joined`, reply with current roster and `strokes:replay`
    - On disconnect, emit `player:left` within 2 seconds
    - _Requirements: 3.3, 4.3, 4.4, 6.9, 11.4_

  - [x] 6.3 Implement `server/src/socket/draw.ts` (`draw:stroke` and `draw:clear` handlers)
    - Validate sender is the current Drawer
    - Broadcast to room except sender, append to stroke cache (or clear it)
    - _Requirements: 5.6, 6.6, 6.7_

  - [ ]* 6.4 Property test for game-state broadcast fan-out
    - **Property 9: Game-state broadcast covers every connected player**
    - **Validates: Requirements 5.3, 5.6, 11.3, 11.5**

  - [x] 6.5 Implement client socket transport `client/src/lib/socket.ts`
    - Connect to server with `join:room` payload
    - Reconnect with backoff delay `1000 * 2^i` for `i ∈ [0..4]`, then expose manual reconnect
    - Surface `connection` state (`connected | reconnecting | disconnected`)
    - _Requirements: 11.1, 11.6, 16.4, 16.5_

  - [ ]* 6.6 Property test for reconnect backoff schedule
    - **Property 22: Reconnect backoff schedule**
    - **Validates: Requirements 16.4, 16.5**

- [x] 7. Implement client game store and disconnect resilience
  - [x] 7.1 Implement `client/src/store/gameStore.ts`
    - Roster reducer for `player:joined` / `player:left`
    - Slots for scores, drawer, round number, status, lastTxHash, strokes, wordHint, word
    - _Requirements: 4.3, 4.4, 11.4, 11.5_

  - [ ]* 7.2 Property test for player roster reducer
    - **Property 6: Player roster reducer**
    - **Validates: Requirements 3.3, 4.3, 4.4, 11.4**

  - [x] 7.3 Implement disconnect-resilience behavior in `gameStore`
    - Do not mutate game state when `connection !== 'connected'`
    - Buffer outgoing user input locally; discard on permanent disconnect
    - _Requirements: 16.4, 16.5, 16.6_

  - [ ]* 7.4 Property test for state preservation across disconnects
    - **Property 23: Local game state preserved across disconnects**
    - **Validates: Requirements 16.6**

- [x] 8. Implement guess pipeline
  - [x] 8.1 Implement client guess submission helper
    - Trim input, drop empty/whitespace-only inputs, slice to 50 characters
    - Emit `guess:submit` exactly once per submit action
    - _Requirements: 8.1, 8.2_

  - [ ]* 8.2 Property test for guess input sanitization
    - **Property 13: Guess input sanitization**
    - **Validates: Requirements 8.1, 8.2**

  - [x] 8.3 Implement `server/src/socket/guess.ts` (`guess:submit` handler)
    - Trim input, run `exactMatch(word, guess)` for routing
    - Always call `Contract.submit_guess(roomId, guess)` exactly once
    - Emit `guess:validating` to the submitter
    - _Requirements: 8.3, 8.4, 8.5, 8.6_

  - [ ]* 8.4 Property test for guess pipeline routing
    - **Property 14: Guess pipeline routing**
    - **Validates: Requirements 8.3, 8.4, 8.5, 8.6**

  - [x] 8.5 Implement guess result fan-out in `server/src/socket/guess.ts`
    - On `correct`: broadcast `guess:correct` with `{address, name, text, txHash, scores}` to room
    - On `wrong`: unicast `guess:wrong` with `txHash` to submitter only
    - On Contract failure: unicast `guess:error` to submitter
    - _Requirements: 8.7, 8.8, 8.10, 8.11_

  - [ ]* 8.6 Property test for guess result fan-out
    - **Property 15: Guess result fan-out**
    - **Validates: Requirements 8.7, 8.8**

- [x] 9. Implement word secrecy and round/game lifecycle
  - [x] 9.1 Implement `word:assign` unicast on round start
    - Server fetches `getCurrentWord(roomId)` and emits to drawer's socket only
    - Other sockets receive `game:state` with drawer identity but no word
    - _Requirements: 5.2, 7.1, 9.2_

  - [ ]* 9.2 Property test for word secrecy
    - **Property 8: Word secrecy**
    - **Validates: Requirements 5.2, 9.2**

  - [x] 9.3 Implement round timer, `end_round`, and game completion
    - `server/src/game/timer.ts` with deadline-based `setTimeout` and early termination when all guessers correct
    - `server/src/socket/round.ts` orchestrates `Contract.end_round` (with one retry); emit `round:end` mid-game and `game:end` on final round
    - On retry exhaustion emit `error` with `{ code: 'END_ROUND_FAILED' }`
    - _Requirements: 9.1, 9.2, 9.3, 9.5, 9.7_

  - [ ]* 9.4 Property test for round and game lifecycle
    - **Property 17: Round and game lifecycle**
    - **Validates: Requirements 9.1, 9.3, 9.5**

- [x] 10. Checkpoint - Server-side tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement entry pages (Home, CreateRoom, JoinRoom, Lobby)
  - [x] 11.1 Implement `client/src/pages/Home.tsx`
    - Animated logo, tagline "Draw. Guess. Verified on-chain.", Create / Join buttons
    - Stats panel calls `get_room_count` and `get_total_games`; hides on view-call failure
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x] 11.2 Implement `client/src/pages/CreateRoom.tsx` and `client/src/pages/JoinRoom.tsx`
    - Inline validation (player 1-20, room 1-30, max 2-8, rounds 1-5; join playerName 1-20)
    - Disable submit while invalid or transaction pending; surface room-status / room-full / not-found errors
    - On success display tx hash and navigate to Lobby
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

  - [ ]* 11.3 Property test for form validation length bounds
    - **Property 4: Form validation matches name length bounds**
    - **Validates: Requirements 2.7, 3.1**

  - [x] 11.4 Implement `client/src/pages/Lobby.tsx`
    - Copyable room code pill with 2s confirmation
    - Player list reacts to `player:joined` / `player:left`
    - Host-only "Start Game" button, gated on >= 2 players; non-hosts see waiting message
    - On `game:state` status `playing`, navigate to Game page
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1, 5.4, 5.5, 5.6_

  - [ ]* 11.5 Property test for start-game gate
    - **Property 7: Start-game gate is determined by host status and player count**
    - **Validates: Requirements 4.5, 4.6, 5.1**

- [x] 12. Implement drawing surface and Game page
  - [x] 12.1 Implement `client/src/components/Canvas/DrawingCanvas.tsx`
    - Pointer input batched via `requestAnimationFrame`, target ≥ 30 fps stroke commits
    - Emits `draw:stroke` (normalized coords) and `draw:clear`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 12.2 Implement `client/src/components/Canvas/ReadOnlyCanvas.tsx` and `strokeRenderer.ts`
    - Render incoming `draw:stroke` events by denormalizing to local canvas size
    - Clear on `draw:clear`; replay `initialStrokes` on mount
    - _Requirements: 6.5, 6.6, 6.7, 6.9_

  - [x] 12.3 Implement `client/src/components/Canvas/Toolbar.tsx`
    - 8-color palette, width slider 2-20 px, eraser toggle, clear button
    - _Requirements: 6.8_

  - [x] 12.4 Implement supporting UI components
    - `WordHint`, `PlayerAvatar`, `ScoreCounter` (300-1000 ms count-up), `ConnectionStatus`, `TxHashLink`, `Chat`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 8.10, 10.6, 14.3, 14.4, 16.4, 16.5_

  - [ ]* 12.5 Property test for score count-up animation
    - **Property 19: Score count-up animation**
    - **Validates: Requirements 10.6, 14.4**

  - [x] 12.6 Implement `client/src/pages/Game.tsx` with responsive layout and chat
    - 3-column layout >= 768 px (PlayerList | Canvas+Toolbar+WordHint | Chat)
    - Single-column < 768 px hiding PlayerList; canvas occupies >= 280 px
    - Chat input disabled when local player is the Drawer
    - Round-end modal overlay shown for 5 s with revealed word and scores
    - _Requirements: 5.6, 7.4, 8.9, 8.12, 9.4, 15.1, 15.2, 15.3, 15.4_

  - [ ]* 12.7 Property test for drawer-only chat input gating
    - **Property 16: Drawer-only chat input gating**
    - **Validates: Requirements 8.12**

  - [ ]* 12.8 Property test for responsive layout invariants
    - **Property 25: Responsive layout invariants**
    - **Validates: Requirements 15.1, 15.2, 15.3, 15.4**

- [x] 13. Implement Results page
  - [x] 13.1 Implement `client/src/pages/Results.tsx`
    - Calls `get_leaderboard`, sorts non-increasing by score with deterministic tiebreaker (address ascending)
    - Podium with `min(3, |L|)` slots, confetti, "Verified by GenLayer" badge, count-up scores, "Play Again" button
    - Error message when leaderboard load fails
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_

  - [ ]* 13.2 Property test for leaderboard ordering and podium
    - **Property 18: Leaderboard ordering and podium**
    - **Validates: Requirements 10.1, 10.2, 10.3**

- [x] 14. Checkpoint - Client UI tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Wire end-to-end and global error handling
  - [x] 15.1 Wire client `App.tsx` router and global error surfaces
    - Routes: `/`, `/create`, `/join`, `/lobby/:roomId`, `/game/:roomId`, `/results/:roomId`
    - Mount `ConnectionStatus` banner globally; toast banner for transient errors; modal for `END_ROUND_FAILED` and consensus timeouts with retry CTA
    - Render Session Wallet persistence warning banner when `walletStore.persistenceWarning` is set
    - _Requirements: 1.5, 12.5, 13.3, 16.1, 16.2, 16.3, 16.4, 16.5_

  - [x] 15.2 Wire server bootstrap config
    - Load env vars (PORT, RPC_URL override, server signer key)
    - Mount socket handler router from task 6.1, connect `gameManager` lifecycle, install `disconnect`-driven empty-room cleanup
    - _Requirements: 11.2, 11.7, 12.1_

  - [ ]* 15.3 Integration tests for the end-to-end loop
    - Mocked Contract + in-process Socket.IO harness: Create → Join → Start → Round → End
    - Verifies round timer expiry path, "all guessed" early termination, and round/game transitions
    - _Requirements: 5.2, 5.3, 8.7, 9.1, 9.3, 9.5_

- [x] 16. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP.
- Each property test references the design document's correctness property by number.
- Property tests use `fast-check` with `numRuns: 100` minimum, a `MockContract` harness for Contract calls, an in-process Socket.IO mock for transport, and Vitest fake timers for time-sensitive properties.
- Checkpoints ensure incremental validation between server and client work.
- All implementation code is TypeScript per the design's repository layout.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "3.1", "3.3", "4.1", "5.1", "6.5", "7.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "3.2", "3.4", "4.2", "4.3", "4.4", "4.5", "5.2", "5.3", "6.1", "6.6", "7.2", "7.3", "8.1", "11.1", "11.2", "12.3", "12.4"] },
    { "id": 4, "tasks": ["5.4", "5.5", "6.2", "6.3", "7.4", "8.2", "8.3", "9.1", "9.3", "11.3", "11.4", "12.1", "12.2", "12.5", "13.1"] },
    { "id": 5, "tasks": ["5.6", "6.4", "8.4", "8.5", "9.2", "9.4", "11.5", "12.6", "13.2", "15.2"] },
    { "id": 6, "tasks": ["8.6", "12.7", "12.8", "15.1"] },
    { "id": 7, "tasks": ["15.3"] }
  ]
}
```
