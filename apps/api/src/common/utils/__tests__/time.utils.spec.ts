import { safeDelayMs, msUntil } from '../time.utils';

describe('safeDelayMs', () => {
  const NOW = 1_700_000_000_000; // fixed epoch ms for determinism

  it('returns positive ms for a future target', () => {
    expect(safeDelayMs(NOW + 5000, NOW)).toBe(5000);
  });

  it('clamps to 0 for a past target', () => {
    expect(safeDelayMs(NOW - 1000, NOW)).toBe(0);
  });

  it('clamps to 0 for target equal to now', () => {
    expect(safeDelayMs(NOW, NOW)).toBe(0);
  });

  it('throws in development for undefined target', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() => safeDelayMs(undefined, NOW)).toThrow(/invalid target/);
    process.env.NODE_ENV = original;
  });

  it('returns 0 in non-development for undefined target', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    expect(safeDelayMs(undefined, NOW)).toBe(0);
    process.env.NODE_ENV = original;
  });

  it('returns 0 for NaN target', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    expect(safeDelayMs(NaN, NOW)).toBe(0);
    process.env.NODE_ENV = original;
  });

  it('returns 0 for Infinity target', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    expect(safeDelayMs(Infinity, NOW)).toBe(0);
    process.env.NODE_ENV = original;
  });
});

describe('msUntil', () => {
  const NOW = 1_700_000_000_000;

  it('returns ms until future date', () => {
    const future = new Date(NOW + 30_000);
    expect(msUntil(future, NOW)).toBe(30_000);
  });

  it('clamps to 0 for past date', () => {
    const past = new Date(NOW - 1000);
    expect(msUntil(past, NOW)).toBe(0);
  });

  it('throws in development for undefined date', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() => msUntil(undefined, NOW)).toThrow(/invalid date/);
    process.env.NODE_ENV = original;
  });
});
