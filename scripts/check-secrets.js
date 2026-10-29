#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');

// Check if gitleaks is installed; if so, run it
try {
  execSync('gitleaks version', { stdio: 'ignore' });
  console.log('🔍 Running gitleaks protect...');
  execSync('gitleaks protect --verbose --staged', { stdio: 'inherit' });
  process.exit(0);
} catch {
  // Fall back to node-based staged secret patterns check
}

console.log('🔍 Running lightweight secret scanner on staged files...');
let stagedFiles = [];
try {
  const output = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' });
  stagedFiles = output.split('\n').filter(Boolean);
} catch {
  process.exit(0);
}

const FORBIDDEN_FILES = [/^\.env(\.local|\.production|\.staging)?$/i, /.*\.pem$/i, /.*\.key$/i, /.*id_rsa$/i];
const HIGH_ENTROPY_PATTERNS = [
  /-----BEGIN [A-Z]+ PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/,
  /ghp_[0-9a-zA-Z]{36}/,
  /gho_[0-9a-zA-Z]{36}/,
  /xox[baprs]-[0-9]{12}-[0-9]{12}-[a-zA-Z0-9]{24}/,
];

let failed = false;
for (const file of stagedFiles) {
  for (const forbidden of FORBIDDEN_FILES) {
    if (forbidden.test(file) && !file.includes('.example')) {
      console.error(`❌ BLOCKED: Attempting to commit forbidden secret file: ${file}`);
      failed = true;
    }
  }

  if (fs.existsSync(file)) {
    const stats = fs.statSync(file);
    if (stats.size < 500000) {
      const content = fs.readFileSync(file, 'utf8');
      for (const pattern of HIGH_ENTROPY_PATTERNS) {
        if (pattern.test(content)) {
          console.error(`❌ BLOCKED: Secret pattern detected in staged file: ${file}`);
          failed = true;
        }
      }
    }
  }
}

if (failed) {
  console.error('\n🛑 Commit aborted: secrets or sensitive files detected. Remove them before committing.');
  process.exit(1);
} else {
  console.log('✅ Secret scan passed: no staged secrets detected.');
}
