# Requirements Document

## Introduction

GenDraw is a multiplayer drawing and guessing game built on the GenLayer blockchain. Players create or join rooms, take turns drawing AI-generated words on a shared canvas, and other players guess the word in real-time. AI validates guesses on-chain, scores are tracked via smart contract, and all game actions are verifiable on GenLayer Testnet. The application consists of a React 18 client (Vite + TailwindCSS) and an Express + Socket.IO server, communicating with a deployed GenLayer smart contract.

## Glossary

- **GenDraw_App**: The complete multiplayer drawing and guessing game application consisting of Client and Server components
- **Client**: The React 18 + Vite + TailwindCSS frontend application served to players' browsers
- **Server**: The Express + Socket.IO backend that manages game state and relays events between players
- **Contract**: The GenLayer smart contract deployed at address 0x3C0C3CdE6eF4D8C11E0cd4E4C2aE04E9981d9776 on GenLayer Testnet
- **Room**: A game session that holds players, scores, rounds, and game status
- **Host**: The player who created a Room and has permission to start the game
- **Drawer**: The player whose turn it is to draw the current word on the Canvas
- **Guesser**: A player who is not the current Drawer and submits guesses
- **Canvas**: The HTML5 drawing surface where the Drawer creates illustrations
- **Word**: A secret term generated on-chain by AI after starting a game or ending a round
- **Round**: One cycle where a Drawer draws and Guessers attempt to identify the Word
- **Session_Wallet**: A randomly generated Ethereum keypair stored in localStorage, used for all contract interactions without requiring an external wallet
- **Transaction_Hash**: The on-chain identifier returned after a write operation to the Contract
- **Leaderboard**: The ranked list of player scores for a given Room retrieved from the Contract
- **Socket_Connection**: A persistent WebSocket connection between Client and Server via Socket.IO
- **Stroke**: A drawing action consisting of coordinate points, color, and line width transmitted via Socket.IO

## Requirements

### Requirement 1: Session Wallet Generation

**User Story:** As a player, I want a wallet generated automatically on my first visit, so that I can interact with the blockchain without installing a wallet extension.

#### Acceptance Criteria

1. WHEN a player visits the GenDraw_App and no Session_Wallet private key exists in localStorage, THE Client SHALL generate a random Ethereum keypair using ethers.Wallet.createRandom() and store the private key in localStorage
2. WHEN a player visits the GenDraw_App and a valid Session_Wallet private key already exists in localStorage, THE Client SHALL reconstruct the Session_Wallet from the stored private key
3. THE Client SHALL use the Session_Wallet for all Contract write and view interactions
4. IF the Session_Wallet private key in localStorage is present but invalid (cannot derive an Ethereum address), THEN THE Client SHALL discard the invalid entry, generate a new Session_Wallet, and store the new private key in localStorage
5. IF localStorage is unavailable or inaccessible, THEN THE Client SHALL generate an in-memory Session_Wallet for the current browser session and display a warning indicating that the wallet will not persist across page reloads

### Requirement 2: Room Creation

**User Story:** As a player, I want to create a game room with custom settings, so that I can invite friends to play.

#### Acceptance Criteria

1. WHEN a player submits the Create Room form with a player name (1-20 characters), room name (1-30 characters), max players (2-8), and rounds (1-5), THE Client SHALL call the Contract create_room function with room_name, max_players, and rounds parameters
2. WHEN the Contract returns a room_id after room creation, THE Client SHALL display the Transaction_Hash to the player
3. WHEN room creation succeeds, THE Client SHALL automatically call join_room on the Contract with the returned room_id and the player name
4. WHEN room creation and join succeed, THE Client SHALL navigate the player to the Lobby page
5. WHILE the Contract transaction is pending, THE Client SHALL display a loading indicator and disable the Create Room form to prevent duplicate submissions
6. IF the create_room or join_room Contract transaction fails, THEN THE Client SHALL display an error message describing the failure and remain on the Create Room page
7. IF the player name or room name is empty or exceeds the allowed character length, THEN THE Client SHALL disable the submit button and display a validation message indicating the constraint

### Requirement 3: Room Joining

**User Story:** As a player, I want to join an existing game room by entering a room code, so that I can play with others.

#### Acceptance Criteria

1. WHEN a player submits the Join Room form with a room code and a player name between 1 and 20 characters, THE Client SHALL call the Contract join_room function with the room_id and player_name
2. WHEN the join transaction succeeds, THE Client SHALL navigate the player to the Lobby page
3. WHEN the join transaction succeeds, THE Server SHALL emit a player:joined event to all players in the Room via Socket_Connection
4. WHILE the Contract transaction is pending, THE Client SHALL display a loading state to the player and disable the Join Room form submission
5. IF the Room status is not "waiting", THEN THE Client SHALL display an error message stating the game has already started
6. IF the Room has reached max_players, THEN THE Client SHALL display an error message stating the room is full
7. WHEN the join transaction succeeds, THE Client SHALL display the Transaction_Hash to the player
8. IF the Contract join_room transaction fails for any reason other than room status or max players, THEN THE Client SHALL display an error message describing the failure
9. IF the provided room_id does not correspond to an existing Room on the Contract, THEN THE Client SHALL display an error message stating the room was not found

### Requirement 4: Game Lobby

**User Story:** As a player in a room, I want to see who else has joined and wait for the host to start the game, so that I know when the game is ready.

#### Acceptance Criteria

1. THE Client SHALL display the Room code as a copyable pill element in the Lobby that copies the code to the clipboard when clicked and displays a visual confirmation for 2 seconds after a successful copy
2. WHEN the Lobby page loads, THE Client SHALL retrieve the current player list from the Server via Socket_Connection and display all players currently in the Room with their names
3. WHEN a new player joins the Room, THE Client SHALL add the player to the displayed player list via the player:joined Socket_Connection event
4. WHEN a player leaves the Room, THE Client SHALL remove the player from the displayed player list via the player:left Socket_Connection event
5. WHERE the current player is the Host, THE Client SHALL display a "Start Game" button that is disabled when fewer than 2 players are in the Room
6. WHERE the current player is not the Host, THE Client SHALL display a message indicating they are waiting for the Host to start
7. WHEN the Client receives a game:state event indicating Room status is "playing", THE Client SHALL navigate the player to the Game page

### Requirement 5: Game Start

**User Story:** As the host, I want to start the game when enough players have joined, so that we can begin playing.

#### Acceptance Criteria

1. WHEN the Host presses the "Start Game" button and at least 2 players are in the Room, THE Client SHALL call the Contract start_game function with the room_id
2. WHEN the start_game transaction succeeds, THE Server SHALL call get_current_word on the Contract and send the Word to the Drawer only via a private Socket_Connection event
3. WHEN the start_game transaction succeeds, THE Server SHALL emit a game:state event to all players in the Room with updated Room status "playing" and the current Drawer identity
4. WHILE the start_game transaction is pending, THE Client SHALL display a loading state and disable the "Start Game" button
5. IF the start_game transaction fails, THEN THE Client SHALL display an error message describing the failure and re-enable the "Start Game" button
6. WHEN the game starts, THE Client SHALL navigate all players in the Room to the Game page via the game:state Socket_Connection event

### Requirement 6: Drawing Functionality

**User Story:** As the drawer, I want smooth drawing tools on a canvas, so that I can illustrate the word for other players to guess.

#### Acceptance Criteria

1. WHILE the current player is the Drawer, THE Client SHALL display an interactive Canvas with a drawing toolbar that accepts pointer input for drawing
2. THE Canvas SHALL render Strokes using requestAnimationFrame at a minimum of 30 frames per second during active drawing
3. WHEN the Drawer draws on the Canvas, THE Client SHALL emit draw:stroke events via Socket_Connection containing coordinate points normalized to a 0-1 range relative to Canvas dimensions, color as a hex string, and line width as a pixel value
4. WHEN the Drawer clears the Canvas, THE Client SHALL emit a draw:clear event via Socket_Connection
5. WHILE the current player is a Guesser, THE Client SHALL display the Canvas in read-only mode that does not accept pointer input for drawing
6. WHEN the Client receives a draw:stroke event via Socket_Connection, THE Client SHALL render the Stroke on the read-only Canvas by mapping the normalized coordinates to the local Canvas dimensions
7. WHEN the Client receives a draw:clear event via Socket_Connection, THE Client SHALL clear the read-only Canvas
8. THE Canvas toolbar SHALL provide a color palette with at least 8 color options, line width adjustment between 2px and 20px, an eraser tool that draws using the Canvas background color, and a clear button
9. WHEN a Guesser joins a Room with an active Round, THE Server SHALL send all previously recorded Strokes for the current Round to the joining player via Socket_Connection so the Canvas displays the current drawing state

### Requirement 7: Word Display and Hints

**User Story:** As a player, I want to see hints about the word length, so that I have context for guessing.

#### Acceptance Criteria

1. WHILE the current player is the Drawer, THE Client SHALL display the full Word text above the Canvas
2. WHILE the current player is a Guesser, THE Client SHALL display a word hint showing underscores representing each letter of the Word, with spaces shown as visible gaps and hyphens shown as hyphens
3. THE Client SHALL display the word hint with a visible gap between each underscore character position so that individual letter positions are distinguishable
4. WHEN a correct guess occurs or the round ends, THE Client SHALL reveal the full Word to all players

### Requirement 8: Guess Submission and Validation

**User Story:** As a guesser, I want to submit guesses and get real-time feedback, so that I can try to identify the drawn word.

#### Acceptance Criteria

1. WHEN a Guesser submits a guess via the chat input, THE Client SHALL emit a guess:submit event to the Server via Socket_Connection containing the guess text trimmed to a maximum of 50 characters
2. IF the guess input is empty or contains only whitespace, THEN THE Client SHALL not emit a guess:submit event
3. WHEN the Server receives a guess, THE Server SHALL first perform an exact case-insensitive string match against the Word
4. WHEN the guess exactly matches the Word, THE Server SHALL call submit_guess on the Contract with the room_id and guess
5. WHEN the guess does not exactly match the Word, THE Server SHALL call submit_guess on the Contract for AI validation
6. WHEN the Server calls submit_guess on the Contract, THE Server SHALL emit a guess:validating event to the submitting player via Socket_Connection
7. WHEN the Contract confirms a correct guess, THE Server SHALL emit a guess:correct event to all players in the Room via Socket_Connection
8. WHEN the Contract confirms an incorrect guess, THE Server SHALL emit a guess:wrong event to the submitting player via Socket_Connection
9. WHILE the Client is awaiting a guess validation response, THE Client SHALL display a visual "validating" indicator and the chat input SHALL remain interactive
10. WHEN a guess is validated, THE Client SHALL display the Transaction_Hash associated with the submit_guess call
11. IF the Contract submit_guess call fails, THEN THE Server SHALL emit a guess:error event to the submitting player via Socket_Connection indicating the validation could not be completed
12. WHILE the current player is the Drawer, THE Client SHALL disable the guess chat input

### Requirement 9: Round Management

**User Story:** As a player, I want rounds to progress automatically with score updates, so that the game flows smoothly.

#### Acceptance Criteria

1. WHEN all Guessers in the Room have guessed correctly or the round timer expires, THE Server SHALL call end_round on the Contract with the room_id
2. WHEN the end_round transaction succeeds and the current round is not the final round, THE Server SHALL call get_current_word on the Contract and send the new Word to the next Drawer only
3. WHEN the end_round transaction succeeds, THE Server SHALL emit a round:end event to all players with the revealed Word and updated scores
4. WHEN the Client receives a round:end event, THE Client SHALL display a modal overlay showing the revealed Word and current scores for 5 seconds before auto-dismissing
5. WHEN all rounds are complete, THE Server SHALL emit a game:end event to all players in the Room via Socket_Connection
6. WHEN the Client receives a game:end event, THE Client SHALL navigate all players to the Results page
7. IF the end_round Contract transaction fails, THEN THE Server SHALL retry the end_round call once and emit an error event to players if the retry also fails

### Requirement 10: Results and Leaderboard

**User Story:** As a player, I want to see final results with rankings after the game ends, so that I know who won.

#### Acceptance Criteria

1. WHEN the Results page loads, THE Client SHALL call get_leaderboard on the Contract and display player scores sorted in descending order by score
2. WHEN the Results page loads with 3 or more players, THE Client SHALL display a podium visualization showing 1st, 2nd, and 3rd place players
3. IF the Room has fewer than 3 players, THEN THE Client SHALL display the podium visualization showing only the available player positions
4. WHEN the Results page loads, THE Client SHALL display a confetti animation on the Results page
5. THE Client SHALL display a "Verified by GenLayer" badge on the Results page
6. WHEN the Results page loads, THE Client SHALL display player scores with a count-up number animation from 0 to the final score
7. IF the get_leaderboard Contract call fails, THEN THE Client SHALL display an error message indicating the leaderboard could not be loaded
8. THE Client SHALL display a "Play Again" button that navigates the player to the Home page

### Requirement 11: Real-Time Communication

**User Story:** As a player, I want all game events to update in real-time, so that the multiplayer experience feels responsive.

#### Acceptance Criteria

1. WHEN a player enters a Room, THE Client SHALL establish a Socket_Connection to the Server within 5 seconds and emit a join:room event containing the room_id and player address
2. THE Server SHALL maintain game state for each active Room in memory via gameManager, including current players, round number, drawer, and room status
3. WHEN the Server receives a game event (draw:stroke, draw:clear, guess:submit, guess:correct, guess:wrong, round:end, game:end, or player:joined), THE Server SHALL broadcast the updated game:state to all connected players in the Room within 100 milliseconds of receiving the event
4. IF a player's Socket_Connection disconnects, THEN THE Server SHALL emit a player:left event containing the disconnected player's name to remaining players in the Room within 2 seconds of detecting the disconnection
5. WHEN the Client receives a game:state event, THE Client SHALL update the local UI state including the player list, current scores, round number, drawer identity, and room status within one rendering frame
6. IF a player's Socket_Connection fails to establish within 5 seconds, THEN THE Client SHALL display an error message indicating the connection failure and provide a retry option
7. IF all players disconnect from a Room, THEN THE Server SHALL remove that Room's game state from gameManager memory

### Requirement 12: Contract Integration

**User Story:** As a player, I want all game actions verified on-chain, so that game results are trustworthy and transparent.

#### Acceptance Criteria

1. THE Client SHALL connect to the GenLayer Testnet via ethers.js using RPC endpoint https://studio.genlayer.com/api and Chain ID 61999
2. WHEN a Contract write call is made, THE Client SHALL display the returned Transaction_Hash as a clickable link to the player
3. WHEN a Contract write call is made, THE Client SHALL poll for transaction finalization at an interval of 2 seconds until the transaction is confirmed or a 30-second timeout is reached
4. THE Client SHALL use direct JSON-RPC calls for all Contract view functions
5. IF a Contract call does not receive a response within 30 seconds, THEN THE Client SHALL display a consensus timeout error message to the player
6. IF a network error occurs during a Contract call, THEN THE Client SHALL display a descriptive network error message to the player including the operation that failed

### Requirement 13: Home Page and Statistics

**User Story:** As a visitor, I want to see the game landing page with stats, so that I understand what GenDraw is and see its activity.

#### Acceptance Criteria

1. THE Client SHALL display an animated GenDraw logo on the Home page
2. THE Client SHALL display the tagline "Draw. Guess. Verified on-chain." on the Home page
3. WHEN a player clicks the "Create Room" button on the Home page, THE Client SHALL navigate to the Create Room form page, and WHEN a player clicks the "Join Room" button, THE Client SHALL navigate to the Join Room form page
4. WHEN the Home page loads, THE Client SHALL call get_room_count and get_total_games on the Contract and display the returned values with descriptive labels identifying each statistic
5. IF the statistics Contract calls fail, THEN THE Client SHALL hide the statistics section and display the remaining Home page content without showing an error message

### Requirement 14: Visual Design and Theme

**User Story:** As a player, I want an engaging dark gaming aesthetic, so that the game experience feels immersive and polished.

#### Acceptance Criteria

1. THE Client SHALL use a dark gaming theme with background color #0d0d14, surface color #16162a, purple #7c3aed, pink #ec4899, blue #3b82f6, green #10b981, and yellow #f59e0b
2. THE Client SHALL use Nunito from Google Fonts as the primary typeface, with a sans-serif system font as fallback if Google Fonts fails to load
3. THE Client SHALL display player avatars as colored circles showing the first letter of the player's name, where the circle color is deterministically assigned based on the player's index in the Room player list
4. WHEN a player's score changes, THE Client SHALL apply a score change animation lasting between 300ms and 1000ms that visually indicates the score increase by transitioning the displayed score from the old value to the new value

### Requirement 15: Responsive Layout

**User Story:** As a mobile user, I want to view the game on small screens, so that I can follow along even without a large display.

#### Acceptance Criteria

1. THE Client SHALL render all pages without horizontal scrollbar and without content overflow for screen widths from 320px to 1920px
2. WHILE the screen width is below 768px, THE Client SHALL display the Game page in a single-column layout showing only the Canvas (minimum 280px wide) and chat, hiding the player list sidebar
3. WHILE the screen width is 768px or above, THE Client SHALL display the Game page in a 3-column layout with player list, Canvas, and chat
4. WHILE the screen width is below 768px and the current player is the Drawer, THE Client SHALL display the Canvas with the drawing toolbar in the single-column layout

### Requirement 16: Error Handling and Resilience

**User Story:** As a player, I want clear error feedback when something goes wrong, so that I understand the issue and can retry.

#### Acceptance Criteria

1. IF a network error occurs during any operation, THEN THE Client SHALL display an error message to the player indicating the operation that failed and the nature of the network error, and the message SHALL remain visible until the player dismisses it
2. IF a Contract transaction fails, THEN THE Client SHALL display the failure reason returned by the Contract to the player
3. IF the consensus validation does not complete within 30 seconds, THEN THE Client SHALL display a timeout message and present a retry button allowing the player to resubmit the operation
4. IF the Socket_Connection is lost, THEN THE Client SHALL attempt to reconnect automatically up to 5 times with exponential backoff starting at 1 second, and SHALL display the current connection status (disconnected, reconnecting, or connected) to the player
5. IF the Socket_Connection reconnection attempts are exhausted without success, THEN THE Client SHALL display a message indicating the connection could not be restored and provide a manual reconnect button
6. WHILE the Socket_Connection is lost, THE Client SHALL preserve the current local game state so the player can resume upon successful reconnection
