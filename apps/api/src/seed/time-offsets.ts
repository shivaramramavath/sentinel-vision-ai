/**
 * Helper to compute absolute ISO timestamps from relative offset strings like:
 * "-2m", "-15m", "-45m", "-1h", "-3h", "-12h", "-1d", "-3d", "+15m"
 */
export function resolveOffset(offset: string, baseDate = new Date()): string {
  if (!offset) return baseDate.toISOString();

  // If already full ISO timestamp, return as is
  if (offset.includes('T') && offset.endsWith('Z')) {
    return offset;
  }

  const match = offset.trim().match(/^([+-]?\d+)\s*([smhdw])$/i);
  if (!match) {
    return baseDate.toISOString();
  }

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  let msMultiplier = 1000;
  switch (unit) {
    case 's':
      msMultiplier = 1000;
      break;
    case 'm':
      msMultiplier = 60 * 1000;
      break;
    case 'h':
      msMultiplier = 60 * 60 * 1000;
      break;
    case 'd':
      msMultiplier = 24 * 60 * 60 * 1000;
      break;
    case 'w':
      msMultiplier = 7 * 24 * 60 * 60 * 1000;
      break;
  }

  const resultTime = new Date(baseDate.getTime() + value * msMultiplier);
  return resultTime.toISOString();
}
