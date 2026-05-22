// Smoke test verifying the client toolchain (Vitest + fast-check) wired up.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

describe('client toolchain smoke', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });

  it('runs fast-check property tests', () => {
    fc.assert(
      fc.property(fc.integer(), (n) => n + 0 === n),
      { numRuns: 25 }
    );
  });
});
