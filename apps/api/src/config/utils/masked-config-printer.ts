export function maskSecret(key: string, value: unknown): string {
  if (value === undefined || value === null) return '<unset>';
  const str = String(value);
  if (!str) return '<empty>';

  // ADMIN_PASSWORD is fully redacted with no trailing characters revealed
  if (/ADMIN_PASSWORD/i.test(key)) {
    return '[REDACTED]';
  }

  const isSensitive = /SECRET|TOKEN|PASSWORD|PEPPER|KEY|URI/i.test(key);

  if (!isSensitive) {
    return str;
  }

  if (str.length <= 4) {
    return '****';
  }

  const last4 = str.slice(-4);
  return `****${last4}`;
}

export function printMaskedConfig(env: Record<string, any>): void {
  console.log('================================================================');
  console.log('🔒 SENTINEL VISION AI — LOADED CONFIGURATION (MASKED)');
  console.log('================================================================');

  const keys = Object.keys(env).sort();
  for (const key of keys) {
    // Skip internal npm/system vars
    if (key.startsWith('npm_') || (key.startsWith('NODE_') && key !== 'NODE_ENV')) continue;
    console.log(`  ${key.padEnd(35)} = ${maskSecret(key, env[key])}`);
  }

  console.log('================================================================');
}
