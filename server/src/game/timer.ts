/**
 * Round-deadline timer for the GenDraw server.
 *
 * Per design.md ("Server Components" / "Specific Handlers"), each round
 * carries a server-side `setTimeout`-driven deadline so that an inactive
 * Drawer or a Round whose Guessers all give up is still bounded in
 * wall-clock time (Requirement 9.1). The timer is also cancelled early
 * when every non-Drawer player has guessed correctly.
 *
 * This module is intentionally a thin wrapper around `setTimeout` /
 * `clearTimeout` so that the round handler (task 9.3) can rely on a
 * stable interface, and so unit tests in tasks 9.4 / 15.3 can substitute
 * fake timers or stub the wrapper without touching the global timer
 * functions.
 */

/**
 * Handle returned by `scheduleRoundDeadline`. Exposes a single `cancel`
 * method so callers don't have to remember which raw `Timeout` value
 * goes with which `clearTimeout` invocation. `cancel` is idempotent so
 * the round handler can call it unconditionally on early termination.
 *
 * Validates: Requirement 9.1 (round timer expiry path).
 */
export interface RoundDeadlineHandle {
  /**
   * Cancel the pending deadline. Subsequent calls are no-ops, which lets
   * the round orchestrator call this both from the all-guessed early-end
   * branch and from the timer-expired branch without worrying about
   * double-cancel races.
   */
  cancel(): void;
}

/**
 * Schedule a round deadline. Fires `onExpire` exactly once after
 * `durationMs` milliseconds unless `cancel` is called first.
 *
 * The implementation is deliberately trivial — it exists so the round
 * orchestrator (task 9.3) and its tests can pivot on a single seam
 * rather than on the global `setTimeout` symbol. Production callers pass
 * `ROUND_DURATION_MS` from `socket/round.ts`; tests can pass small
 * durations or stub the function entirely.
 */
export function scheduleRoundDeadline(
  durationMs: number,
  onExpire: () => void
): RoundDeadlineHandle {
  let cancelled = false;
  const timeout = setTimeout(() => {
    if (cancelled) return;
    onExpire();
  }, durationMs);
  return {
    cancel(): void {
      if (cancelled) return;
      cancelled = true;
      clearTimeout(timeout);
    },
  };
}
