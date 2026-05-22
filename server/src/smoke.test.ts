// Smoke test verifying the server toolchain (Vitest + fast-check) wired up
// and that the shared contract package resolves from the server workspace.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { CONTRACT_ADDRESS } from '@gendraw/contract';

describe('server toolchain smoke', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });

  it('runs fast-check property tests', () => {
    fc.assert(
      fc.property(fc.string(), (s) => typeof s === 'string'),
      { numRuns: 25 }
    );
  });

  it('resolves the shared contract package', () => {
    expect(CONTRACT_ADDRESS).toBe('0xDcF68814DCF7a11B2AbC82Eb08854eBe93174080');
  });
});
