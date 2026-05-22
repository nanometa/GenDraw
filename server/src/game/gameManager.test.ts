// Unit tests for GameManager.cleanupIfEmpty (task 5.5).
//
// The cleanup helper is the disconnect-driven hook the socket layer
// (task 6.2) uses to satisfy Requirement 11.7: "IF all players
// disconnect from a Room, THEN THE Server SHALL remove that Room's game
// state from gameManager memory." The tests cover the three observable
// outcomes: cleanup happens, cleanup is skipped while players remain,
// and unknown room ids are treated as a no-op.
import { describe, it, expect } from 'vitest';
import type { Player } from '@gendraw/contract';

import { GameManager } from './gameManager.js';

function makePlayer(address: string, name = `p-${address}`): Player {
  return { address, name };
}

describe('GameManager.cleanupIfEmpty', () => {
  it('removes the room and reports cleanup when the last player has left', async () => {
    const gm = new GameManager();
    const roomId = '1';
    await gm.getOrLoad(roomId);

    const join = gm.addPlayer(roomId, makePlayer('0xabc'));
    expect(join.ok).toBe(true);
    gm.removePlayer(roomId, '0xabc');

    expect(gm.cleanupIfEmpty(roomId)).toBe(true);
    expect(gm.get(roomId)).toBeUndefined();
  });

  it('keeps the room while at least one player remains', async () => {
    const gm = new GameManager();
    const roomId = '2';
    await gm.getOrLoad(roomId);
    gm.addPlayer(roomId, makePlayer('0xabc'));
    gm.addPlayer(roomId, makePlayer('0xdef'));

    gm.removePlayer(roomId, '0xabc');

    expect(gm.cleanupIfEmpty(roomId)).toBe(false);
    expect(gm.get(roomId)).toBeDefined();
  });

  it('returns false for unknown room ids without throwing', () => {
    const gm = new GameManager();
    expect(gm.cleanupIfEmpty('does-not-exist')).toBe(false);
  });

  it('clears any pending round timer when cleanup runs', async () => {
    const gm = new GameManager();
    const roomId = '3';
    const room = await gm.getOrLoad(roomId);

    // Simulate an in-progress round with an active timer; cleanupIfEmpty
    // must not leak the timer when it tears the room down.
    let fired = false;
    const timeout = setTimeout(() => {
      fired = true;
    }, 10_000);
    room.roundTimer = {
      cancel(): void {
        clearTimeout(timeout);
      },
    };

    expect(gm.cleanupIfEmpty(roomId)).toBe(true);
    expect(gm.get(roomId)).toBeUndefined();

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fired).toBe(false);
  });
});
