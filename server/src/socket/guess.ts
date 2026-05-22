/**
 * `chat:guess` relay handler.
 *
 * Pure realtime fan-out — no contract calls. Each client emits
 * `chat:guess` with `{ text, address, name }` after their own optimistic
 * append; the server forwards to every other socket in the same room
 * via `socket.to(roomId).emit('chat:guess', payload)`. The on-chain
 * scoring still flows through `submit_guess` from the guesser's wallet,
 * but that's slow (consensus); this socket relay is what makes the
 * chat feel instant.
 */
import type { Server, Socket } from 'socket.io';

import type {
  ResolvedHandlerDeps,
  SocketHandlerModule,
} from './handlers.js';

interface ChatGuessPayload {
  text?: unknown;
  address?: unknown;
  name?: unknown;
}

const guessHandler: SocketHandlerModule = {
  name: 'guess',
  register(_io: Server, socket: Socket, _deps: ResolvedHandlerDeps): void {
    socket.on('chat:guess', (payload?: ChatGuessPayload) => {
      const roomId = socket.data?.roomId as string | undefined;
      if (!roomId) return;
      if (!payload || typeof payload !== 'object') return;

      const text = typeof payload.text === 'string' ? payload.text : '';
      const address =
        typeof payload.address === 'string' ? payload.address : '';
      const name = typeof payload.name === 'string' ? payload.name : '';
      if (text.length === 0 || address.length === 0) return;

      socket.to(roomId).emit('chat:guess', {
        text: text.slice(0, 50),
        address,
        name: name.slice(0, 32),
      });
    });
  },
};

export default guessHandler;
