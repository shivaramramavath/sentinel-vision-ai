import * as readline from 'readline';

export function promptText(question: string, defaultValue = ''): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const q = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
    rl.question(q, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

export function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    if (stdin.setRawMode) {
      stdin.setRawMode(true);
    }
    stdin.resume();
    stdin.setEncoding('utf8');

    let input = '';
    const onData = (char: string) => {
      if (char === '\n' || char === '\r' || char === '\u0004') {
        if (stdin.setRawMode) {
          stdin.setRawMode(Boolean(wasRaw));
        }
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(input);
      } else if (char === '\u0003') {
        process.stdout.write('\n');
        process.exit(130);
      } else if (char === '\u0008' || char === '\x7f') {
        if (input.length > 0) {
          input = input.slice(0, -1);
        }
      } else {
        input += char;
      }
    };

    stdin.on('data', onData);
  });
}

export function validatePasswordComplexity(pass: string): { valid: boolean; error?: string } {
  if (pass.length < 12) {
    return { valid: false, error: 'Password must be at least 12 characters long.' };
  }
  if (!/[A-Z]/.test(pass)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter.' };
  }
  if (!/[a-z]/.test(pass)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter.' };
  }
  if (!/[0-9]/.test(pass)) {
    return { valid: false, error: 'Password must contain at least one digit.' };
  }
  if (!/[^A-Za-z0-9]/.test(pass)) {
    return { valid: false, error: 'Password must contain at least one symbol.' };
  }
  return { valid: true };
}
