# GenDraw Design

## Current Architecture

```txt
Wallet client
  |
  | contract reads and writes
  v
GenLayer intelligent contract
  |
  | rooms words clues guesses scores leaderboard
  v
React client
  |
  | realtime strokes and presence only
  v
Socket.IO relay server
```

The contract is the authoritative game engine. The relay server is only a
low-latency transport for drawing strokes, chat-style guess fan-out, room
presence, and stroke replay.

## Contract Address

```txt
0xE736C7A8bA9f62bB807dA7059F9997A342893A2F
```

## Contract Responsibilities

- Create rooms.
- Join rooms.
- Start games.
- Select the current word.
- Generate a fair clue with GenLayer consensus.
- Reveal the word only to the drawer.
- Reveal the clue only to guessers.
- Accept guesses.
- Judge non-exact guesses with GenLayer consensus.
- Rotate turns.
- Advance rounds.
- Finish games.
- Track room scores and weekly leaderboards.

## Client Responsibilities

- Connect a user wallet.
- Read room state from the contract.
- Read `get_current_word(room_id)` only for the drawer.
- Read `get_current_hint(room_id)` only for guessers.
- Render the drawing canvas.
- Send drawing strokes to the Socket.IO relay.
- Submit guesses as contract transactions.
- Poll contract state after transactions finalize.

## Server Responsibilities

- Maintain Socket.IO rooms.
- Broadcast drawing strokes.
- Replay current stroke cache to late joiners.
- Broadcast lightweight presence and guess messages.
- Never store or decide the secret word.
- Never generate or validate clues.
- Never update score or winner state.

## Privacy Rules

- The drawer sees the secret word.
- Guessers see the contract-generated clue.
- The drawer does not need the clue.
- Spectators do not receive private word or clue data.
- The relay server is not trusted with the secret word.

## Deployment Notes

When the contract is redeployed, update:

- `contract/src/config.ts`
- `server/src/smoke.test.ts`
- `scripts/advance-week.mjs`

Then run:

```bash
npm run build
npm test
```
