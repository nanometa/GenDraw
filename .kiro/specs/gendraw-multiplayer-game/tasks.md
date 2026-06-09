# GenDraw Tasks

## Done

- [x] Shared contract package exports ABI, config, address, and types.
- [x] Contract address points to the current GenDraw deployment.
- [x] ABI includes `get_current_hint`.
- [x] ABI exposes only the current clue and game methods.
- [x] Client reads the drawer word from `get_current_word`.
- [x] Client reads the guesser clue from `get_current_hint`.
- [x] Client no longer shows a manual Send Clue flow.
- [x] Socket.IO relay handles strokes, presence, and guess fan-out only.
- [x] Contract source generates clues with GenLayer consensus.
- [x] Contract source keeps word visibility limited to the drawer.
- [x] README describes the current contract and deployment flow.

## Before Deploy

- [ ] Run `npm run build`.
- [ ] Run `npm test`.
- [ ] Deploy the frontend with the current contract address.
- [ ] Start a new room after deployment to avoid stale room state from an older contract.

## Current Contract

```txt
0xE736C7A8bA9f62bB807dA7059F9997A342893A2F
```
