# GenDraw

A real-time, multiplayer drawing-and-guessing game where every guess is a
transaction on [GenLayer](https://genlayer.com) Studionet. Each round one
player draws the secret word their wallet uniquely sees, while everyone
else races to guess it on chain — points, rotation, and the weekly
leaderboard are all settled by a single deterministic Intelligent Contract.

<p align="center">
  <img src="client/public/brand-logo.png" alt="GenDraw logo" width="120" />
</p>

## What's inside

A three-workspace TypeScript monorepo:

| Workspace   | Stack                                            | Role                                                      |
| ----------- | ------------------------------------------------ | --------------------------------------------------------- |
| `contract/` | TypeScript + GenLayer ABI                        | Shared contract address, ABI JSON, and types              |
| `server/`   | Express + Socket.IO                              | Pure relay for strokes, chat, and connection state        |
| `client/`   | React 18 + Vite + Tailwind + RainbowKit + wagmi  | Game UI, drawing canvas, wallet integration, on-chain RPC |

The on-chain contract handles the trustworthy parts (word selection,
attempt counting, scoring, leaderboard). The server is intentionally
trust-free: it only fans out drawing strokes and chat messages between
players in the same room.

## On-chain rules (contract v5)

Deployed at **`0xDcF68814DCF7a11B2AbC82Eb08854eBe93174080`** on
[GenLayer Studionet](https://studio.genlayer.com) (chain id `61999`).

- 250 base words plus ~190 country names, plus per-room custom words
  via `add_words`
- Anti-repeat: the same word never appears twice in a single game, and
  never matches one of the last 20 words used globally
- 5 attempts per player per turn
- Multiple players can guess correctly in one turn — each correct
  guesser gets +100 points, the drawer gets a +30 bonus once per turn
- A turn closes the moment every non-drawer is either correct or out
  of attempts (atomic rotate inside `submit_guess`)
- Weekly leaderboard via owner-controlled `current_week` counter
  (rolled forward by `advance_week()`)
- Player names are optional — empty names render as a shortened
  `0xXXXX…YYYY` address

## Quick start

Requires Node.js 20 or newer and a wallet that supports adding a custom
EVM network (MetaMask, Rabby, etc.).

```bash
git clone https://github.com/nanometa/GenDraw.git
cd GenDraw
npm install
```

Create `client/.env.local` with your WalletConnect project id and the
local server URL:

```env
VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id_here
VITE_SOCKET_URL=http://localhost:3001
```

Run the client and server together:

```bash
npm run dev
```

Vite serves the client on <http://localhost:5173> and the relay listens
on <http://localhost:3001>. Open the client, connect a wallet on
Studionet (the app prompts the network switch automatically), and create
or join a room.

### Useful scripts

```bash
npm run dev:client     # Vite only
npm run dev:server     # tsx watch on the relay only
npm run build          # type-check + build every workspace
npm run typecheck      # tsc --noEmit across all workspaces
npm run test           # vitest run across all workspaces
npm run lint           # ESLint over the whole monorepo
```

## How the game flows

1. The host creates a room on chain (`create_room`), then shares the
   room code with their friends.
2. Other players join the room (`join_room`) — both the on-chain state
   and a Socket.IO channel.
3. The host calls `start_game`. The contract picks a word per turn,
   visible only to the active drawer's wallet (`get_current_word`).
4. The drawer's strokes are broadcast through the Socket.IO relay so
   guessers can watch in real time.
5. Each guess (`submit_guess`) is its own transaction. The contract
   awards points, decrements attempts, and rotates the drawer the
   moment the round is settled.
6. After all rounds, the contract returns the final ranking and the
   client navigates to a results view.

## Project structure

```text
contract/          # GenLayer Studionet config, ABI, shared TS types
server/            # Socket.IO relay (Express + tsx watch)
  src/socket/      # join, draw, guess, round handlers
  src/game/        # in-memory room registry + stroke replay cache
client/            # React app (Vite + Tailwind)
  src/pages/       # Home, CreateRoom, JoinRoom, Lobby, Game, Results
  src/components/  # Canvas, Toolbar, Chat, WalletBadge, BrandMark, ...
  src/lib/         # contract.ts, socket.ts, strokes, formValidation
  src/store/       # Zustand store for live game state
  public/          # static assets (brand-logo.png)
.kiro/specs/       # spec-driven development artifacts
```

## License

Source available for the GenLayer hackathon. Refer to the repository
owner before any redistribution.
