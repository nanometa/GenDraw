/**
 * `draw:stroke` and `draw:clear` handler module.
 *
 * The server is now a pure realtime relay — the GenLayer contract is the
 * source of truth for who's actually drawing this round. Drawer-only
 * authorisation is enforced on the client side (only the `DrawingCanvas`
 * mounts for the local drawer; guessers see `ReadOnlyCanvas`). A
 * misbehaving peer who hand-emits `draw:stroke` can only produce
 * cosmetic noise on other clients — they can't affect scores or word
 * secrecy.
 *
 * Behaviour:
 *  - Any socket that has been populated by `join:room` (i.e. has
 *    `socket.data.roomId`) can emit `draw:stroke` / `draw:clear`.
 *  - The event is rebroadcast to every *other* socket in the same room
 *    via `socket.to(roomId).emit(...)`.
 *  - The stroke cache in `gameManager` is updated so a late joiner
 *    receives a `strokes:replay` snapshot of the in-progress drawing.
 */
import type { WireStroke } from '@gendraw/contract';
import type { Server, Socket } from 'socket.io';

import { fromWire } from '../lib/strokes.js';

import type {
  ResolvedHandlerDeps,
  SocketHandlerModule,
} from './handlers.js';

const drawHandler: SocketHandlerModule = {
  name: 'draw',
  register(_io: Server, socket: Socket, deps: ResolvedHandlerDeps): void {
    socket.on('draw:stroke', (wireStroke: WireStroke) => {
      const roomId = socket.data?.roomId as string | undefined;
      if (!roomId) return;

      // Cache for late joiners. `appendStroke` is a no-op when the room
      // hasn't been hydrated yet, so we don't need to gate on that here.
      deps.gameManager.appendStroke(roomId, fromWire(wireStroke));

      // `socket.to(roomId)` excludes the sender, which keeps the
      // drawer's own canvas the single source of truth for their own
      // pixels and avoids a self-broadcast feedback loop.
      socket.to(roomId).emit('draw:stroke', wireStroke);
    });

    socket.on('draw:clear', () => {
      const roomId = socket.data?.roomId as string | undefined;
      if (!roomId) return;
      deps.gameManager.clearStrokes(roomId);
      socket.to(roomId).emit('draw:clear');
    });
  },
};

export default drawHandler;
