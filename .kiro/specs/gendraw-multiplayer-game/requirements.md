# GenDraw Requirements

GenDraw is a multiplayer drawing and guessing game built on GenLayer
Studionet. Players create or join rooms, take turns drawing, and guess the
secret word. The GenLayer intelligent contract is the source of truth for
rooms, turns, words, clues, attempts, scores, and leaderboards.

Current contract:

```txt
0xE736C7A8bA9f62bB807dA7059F9997A342893A2F
```

## Core Requirements

1. Players connect with their wallet.
2. A host can create a room with a name, player limit, and round count.
3. Players can join a waiting room before the host starts the game.
4. The host starts the game with `start_game(room_id)`.
5. The contract selects the secret word for each turn.
6. The contract generates the clue for guessers using GenLayer consensus.
7. The drawer reads the secret word with `get_current_word(room_id)`.
8. Guessers read the clue with `get_current_hint(room_id)`.
9. The drawer must not receive the guesser clue from `get_current_hint`.
10. Guessers and spectators must not receive the secret word from `get_current_word`.
11. Drawing strokes are relayed in realtime by Socket.IO.
12. The relay server must not decide the word, clue, score, winner, or turn.
13. Guesses are submitted to the contract with `submit_guess(room_id, guess)`.
14. The contract updates attempts, scores, turn rotation, round progress, and game status.
15. The weekly leaderboard is read from the contract and advanced by owner action.

## GenLayer Requirements

The contract must use GenLayer consensus for meaningful language tasks:

- clue generation with `gl.nondet.exec_prompt`
- clue acceptance with `gl.eq_principle.prompt_non_comparative`
- semantic guess judgement for non-exact guesses

The app must show contract-generated results after they are available, without
letting the relay server replace contract judgement.
