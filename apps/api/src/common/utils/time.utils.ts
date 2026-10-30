/**
 * Safe delay helper to prevent TimeoutNegativeWarning.
 *
 * Problem: `setTimeout(fn, target - Date.now())` produces a large negative
 * number when `target` is undefined, zero, or in the past, which Node.js logs
 * as a TimeoutNegativeWarning.
 *
 * Usage: `setTimeout(fn, safeDelayMs(targetEpochMs))`
 */
export function safeDelayMs(
  target: number | undefined | null,
  now: number = Date.now(),
): number {
  if (target === undefined || target === null || !Number.isFinite(target)) {
    if (process.env.NODE_ENV === 'development') {
      throw new Error(
        `safeDelayMs: received invalid target=${String(target)}. ` +
          'Check the caller — the expiry/target timestamp may be undefined.',
      );
    }
    // In non-dev environments clamp to 0 rather than crashing.
    return 0;
  }
  return Math.max(0, target - now);
}

/**
 * Compute the number of milliseconds until a future Date.
 * Clamps to 0 if the date is in the past.
 */
export function msUntil(date: Date | undefined | null, now: number = Date.now()): number {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    if (process.env.NODE_ENV === 'development') {
      throw new Error(`msUntil: received invalid date=${String(date)}.`);
    }
    return 0;
  }
  return safeDelayMs(date.getTime(), now);
}
