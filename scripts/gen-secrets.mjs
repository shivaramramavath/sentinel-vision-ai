import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: node scripts/gen-secrets.mjs <VARIABLE_NAME...>');
  process.exit(1);
}

const envPath = path.resolve(process.cwd(), 'apps/api/.env');

if (!fs.existsSync(envPath)) {
  console.error('apps/api/.env not found');
  process.exit(1);
}

let content = fs.readFileSync(envPath, 'utf8');
const lines = content.split(/\r?\n/);

let anyRotated = false;

for (const varName of args) {
  const isPassword = varName.toUpperCase().includes('PASSWORD');
  // 48 bytes for tokens, 24 bytes for passwords
  const bytes = isPassword ? 24 : 48;
  const newValue = crypto.randomBytes(bytes).toString('base64url');

  let found = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith(`${varName}=`)) {
      lines[i] = `${varName}=${newValue}`;
      found = true;
      anyRotated = true;
      break;
    }
  }

  if (!found) {
    // If not found, append it
    lines.push(`${varName}=${newValue}`);
    anyRotated = true;
  }
}

if (anyRotated) {
  fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
  console.log('rotated');
}
