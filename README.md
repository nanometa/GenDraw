# GenDraw

Draw it. Guess it. Verified by GenLayer consensus.

GenDraw is a realtime multiplayer drawing and guessing game built for GenLayer
Studionet. The intelligent contract owns the core game state, selects each
round word, generates a fair clue with GenLayer consensus, reveals the secret
word only to the drawer, and lets the other players guess.

Live app: https://gendraw.vercel.app

## Current Contract

Contract address:

```txt
0xE736C7A8bA9f62bB807dA7059F9997A342893A2F
```

## Key Features

GenDraw keeps the main game logic inside the intelligent contract:

- The contract generates one fair clue for the current word.
- The clue is generated with `gl.nondet.exec_prompt`.
- The clue is checked with `gl.eq_principle.prompt_non_comparative`.
- `get_current_word(room_id)` shows the word only to the drawer.
- `get_current_hint(room_id)` shows the clue only to the guessers.
- The realtime server only relays drawing strokes and room events.
- Game state, scoring, turns, attempts, words, clues, and leaderboards stay on-chain.

## Why GenLayer Matters Here

GenDraw is not just a normal deterministic drawing game. The contract uses
GenLayer consensus where normal smart contracts are weak: language judgement.

The contract can ask for a short fair clue without revealing the secret word.
This makes every round more dynamic and avoids relying on a central backend or
on the drawer to create a valid clue.

The contract also supports intelligent judgement for non-exact guesses, so a
player can still be accepted when the guess is semantically correct.

Example:

- The drawer sees: `UMBRELLA`
- The guessers see a contract-generated clue such as: `Used for protection from rain`
- The guessers never see the secret word from the contract view.
- Spectators do not receive the private clue or word.

## Game Flow

1. A host creates a room.
2. Players join the room with their wallet.
3. The host starts the game.
4. The contract chooses the secret word.
5. The contract generates a fair clue using GenLayer consensus.
6. The drawer sees the secret word.
7. The other players see only the generated clue.
8. Drawing strokes are broadcast in realtime through Socket.IO.
9. Players submit guesses through the contract.
10. The contract updates attempts, scores, turns, rounds, and leaderboards.

## On-Chain Rules

- Minimum players per room: 2
- Maximum players per room: 8
- Rounds per game: 1 to 10
- Maximum attempts per player per turn: 5
- Correct guess reward: 100 points
- Drawer bonus when someone guesses correctly: 30 points
- Recent words are tracked to reduce repetition.
- Weekly leaderboard scores are stored on-chain.
- `advance_week()` is owner-only and starts the next leaderboard epoch.

## Contract Features

Core write methods:

- `create_room(room_name, max_players, rounds)`
- `join_room(room_id, player_name)`
- `start_game(room_id)`
- `submit_guess(room_id, guess)`
- `end_round(room_id)`
- `advance_week()`

Core view methods:

- `get_room(room_id)`
- `get_current_word(room_id)`
- `get_current_hint(room_id)`
- `get_leaderboard(room_id)`
- `get_weekly_leaderboard(top_n)`
- `get_weekly_leaderboard_for(week_id, top_n)`
- `get_pool_size()`
- `get_recent_words()`
- `get_room_count()`
- `get_total_games()`
- `get_current_week_id()`

## Architecture

```txt
Player wallet
   |
   | contract transactions and reads
   v
GenLayer intelligent contract
   |
   | owns rooms words clues guesses scores turns leaderboards
   v
Frontend app
   |
   | realtime drawing strokes only
   v
Socket.IO relay server
```

The server is intentionally lightweight. It does not decide the word, clue,
winner, score, or game progress. Those decisions belong to the GenLayer
contract.

## Local Development

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Run tests:

```bash
npm test
```

## Contract Address Updates

When redeploying the contract, update the address in:

- `contract/src/config.ts`
- `server/src/smoke.test.ts`
- `scripts/advance-week.mjs`

Then rebuild and redeploy the frontend/server.

## Tech Stack

- GenLayer intelligent contracts
- React
- TypeScript
- Vite
- Socket.IO
- Tailwind CSS
- Node.js

## Project Goal

GenDraw demonstrates how GenLayer can power consumer games where a contract
does more than store deterministic state. It can participate in gameplay by
handling natural language tasks such as fair clue generation and semantic guess
judgement while keeping the important game rules transparent and on-chain.
