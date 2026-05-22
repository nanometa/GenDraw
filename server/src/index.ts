/**
 * GenDraw server bootstrap.
 *
 * Wires up Express + Socket.IO and hands every new connection to the
 * handler router (`socket/handlers.ts`). Per design.md ("Project
 * Structure" / "Real-Time Communication") this module owns:
 *
 *   - The HTTP server + Socket.IO instance (Requirement 11.1: clients
 *     reach the Server within 5 s).
 *   - A liveness probe (`GET /healthz`) used by deployment platforms.
 *   - The single `GameManager` instance shared by every handler module
 *     (Requirement 11.2: per-Room state is held in `gameManager`).
 *   - Process lifecycle: graceful shutdown on SIGINT / SIGTERM so the
 *     Socket.IO server drains and the HTTP listener releases its port
 *     cleanly during deploys.
 *
 * The `disconnect`-driven empty-room cleanup required by Requirement
 * 11.7 is wired inside `socket/join.ts` (the same module that owns
 * `join:room`); keeping the listener co-located with its mirror means
 * the bootstrap stays a thin assembly point and the cleanup invariant
 * is enforced wherever joins happen.
 *
 * Adding new socket events does *not* require editing this file: the
 * router walks an in-process registry of handler modules, and the
 * bootstrap only constructs and passes the shared dependency bag.
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.7, 12.1, 16.1.
 */
import { createServer } from 'http';

import cors from 'cors';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';

import { CONTRACT_ADDRESS } from '@gendraw/contract';

import { GameManager } from './game/gameManager.js';
import { registerHandlers } from './socket/handlers.js';

/**
 * Resolved server configuration. Centralized in one place so the
 * startup log, the listener, and any future env-driven knobs read
 * from a single source of truth instead of scattering
 * `process.env.X ?? default` calls across the file.
 */
interface ServerConfig {
  port: number;
}

/**
 * Read the server configuration from `process.env`. Pure / side-effect
 * free so it stays trivial to unit-test if we ever need to.
 */
function loadConfig(): ServerConfig {
  const rawPort = process.env.PORT;
  return {
    port: Number(rawPort ?? 3001),
  };
}

const config = loadConfig();

const app = express();
// Open CORS in dev so a Vite dev server (default port 5173) can reach
// the API. Production deployments tighten this via env-driven config in
// a future hardening pass; the current task only wires up the env
// surface, not the policy.
app.use(cors());
app.use(express.json());

/**
 * Liveness probe used by container orchestrators and the local dev
 * harness. Kept deliberately trivial: a 200 response with `{ ok: true }`
 * is the only signal the platform needs to know the process is alive.
 */
app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: '*' },
});

const gameManager = new GameManager();

// Mount the socket handler router from task 6.1. Each per-event module
// (`join`, `draw`, `guess`, `round`) attaches its own `socket.on(...)`
// listeners, including the `disconnect` listener in `join.ts` that
// runs `gameManager.cleanupIfEmpty(roomId)` so empty rooms are dropped
// from memory (Requirement 11.7).
registerHandlers(io, { gameManager });

httpServer.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[gendraw/server] listening on :${config.port} ` +
      `(contract=${CONTRACT_ADDRESS})`
  );
});

/**
 * Graceful shutdown. SIGINT (Ctrl+C in dev) and SIGTERM (the signal a
 * container runtime sends during a rolling deploy) both drain the
 * Socket.IO connections and close the HTTP listener so the next
 * process can bind the port immediately.
 *
 * `io.close` is invoked first so in-flight sockets receive a clean
 * disconnect (which in turn fires the per-room cleanup wired in
 * `join.ts`) before the underlying HTTP server stops accepting
 * connections.
 *
 * If the shutdown can't complete within 5 s — e.g. a stuck client
 * keeps the socket alive — we fall back to `process.exit(0)` so the
 * orchestrator isn't left waiting on us. The exit code stays 0 because
 * a graceful shutdown is not a failure even if it had to be forced.
 */
function shutdown(signal: NodeJS.Signals): void {
  // eslint-disable-next-line no-console
  console.log(`[gendraw/server] received ${signal}, shutting down...`);

  const forceExitTimer = setTimeout(() => {
    // eslint-disable-next-line no-console
    console.warn('[gendraw/server] shutdown timed out, forcing exit');
    process.exit(0);
  }, 5000);
  // Don't let the timer itself keep the event loop alive.
  forceExitTimer.unref();

  io.close(() => {
    httpServer.close(() => {
      clearTimeout(forceExitTimer);
      process.exit(0);
    });
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { app, httpServer, io, gameManager, config };
