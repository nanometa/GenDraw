/**
 * Socket.IO event router for the GenDraw server.
 *
 * Per design.md ("Project Structure"), each gameplay event is owned by a
 * dedicated module under `server/src/socket/` (`join.ts`, `draw.ts`,
 * `guess.ts`, `round.ts`). This file is the *router*: it accepts the
 * shared dependency bag, walks an in-process registry of handler
 * modules, and lets each module attach its own `socket.on(...)`
 * listeners to a freshly-connected socket.
 *
 * Adding a new handler module therefore only requires:
 *   1. Creating the module under `socket/` with a default-exported
 *      `SocketHandlerModule`.
 *   2. Appending it to `HANDLER_MODULES` below.
 * The router itself never has to change.
 *
 * The module also exposes the `emitError(socket, code, message)` helper
 * used by every handler to produce the standardized `error` event shape
 * `{ code, message }` documented in design.md and Requirement 11.3 /
 * 16.1.
 */
import type { Server, Socket } from 'socket.io';

import type { GameManager } from '../game/gameManager.js';

import joinHandler from './join.js';
import drawHandler from './draw.js';
import guessHandler from './guess.js';
import roundHandler from './round.js';

/**
 * Dependency bag accepted by `registerHandlers`.
 *
 * The server is now purely a Socket.IO relay for strokes/presence —
 * all contract writes are client-driven.
 */
export interface HandlerDeps {
  gameManager: GameManager;
}

/**
 * Resolved dependency bag passed to individual handler modules.
 * Same as HandlerDeps now that relay/views have been removed.
 */
export interface ResolvedHandlerDeps {
  gameManager: GameManager;
}

/**
 * Contract every entry in `HANDLER_MODULES` must satisfy.
 *
 * `register` is invoked once per inbound `connection`, with the shared
 * `Server` instance, the per-connection `Socket`, and the resolved
 * dependency bag. Modules are expected to attach their `socket.on(...)`
 * listeners synchronously and return; any teardown should be wired via
 * `socket.on('disconnect', ...)` from inside the module itself.
 */
export interface SocketHandlerModule {
  /** Display name used in logs / diagnostics. */
  readonly name: string;
  register(io: Server, socket: Socket, deps: ResolvedHandlerDeps): void;
}

/**
 * In-process handler registry. The router iterates this list on every
 * new socket connection.
 */
const HANDLER_MODULES: readonly SocketHandlerModule[] = [
  joinHandler,
  drawHandler,
  guessHandler,
  roundHandler,
];

/**
 * Emits the standardized `error` event to a single socket.
 *
 * All gameplay error surfaces — generic Server-internal errors
 * (design.md "Server-internal" row), and connection / capacity refusals
 * — flow through this helper so the client sees a single, predictable
 * shape.
 *
 * Validates: Requirements 11.3, 16.1.
 */
export function emitError(socket: Socket, code: string, message: string): void {
  socket.emit('error', { code, message });
}

/**
 * Wire every `SocketHandlerModule` in `HANDLER_MODULES` to each new
 * socket connection.
 */
export function registerHandlers(io: Server, deps: HandlerDeps): void {
  const resolved: ResolvedHandlerDeps = {
    gameManager: deps.gameManager,
  };

  io.on('connection', (socket) => {
    for (const handlerModule of HANDLER_MODULES) {
      handlerModule.register(io, socket, resolved);
    }
  });
}
