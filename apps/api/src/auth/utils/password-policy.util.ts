import zxcvbn from 'zxcvbn';
import { BadRequestException } from '@nestjs/common';

export interface PasswordValidationResult {
  valid: boolean;
  score: number;
  feedback?: string[];
}

export function validatePasswordPolicy(password: string, userInputs: string[] = []): void {
  if (!password || password.length < 10) {
    throw new BadRequestException('Password must be at least 10 characters long.');
  }

  // Explicitly reject user personal context (name parts, email local-part)
  const lowerPass = password.toLowerCase();
  for (const input of userInputs) {
    if (input && input.length >= 3) {
      const tokens: string[] = [];
      if (input.includes('@')) {
        tokens.push(input.split('@')[0].toLowerCase());
      } else {
        tokens.push(...input.toLowerCase().split(/[\s_-]+/));
      }

      for (const t of tokens) {
        if (t.length >= 3 && lowerPass.includes(t)) {
          throw new BadRequestException('Password must not contain your name, email, or personal identifiers.');
        }
      }
    }
  }

  const result = zxcvbn(password, userInputs);
  if (result.score < 3) {
    const suggestions = result.feedback.suggestions?.join(' ') || '';
    const warning = result.feedback.warning || 'Password is too predictable or easily guessable.';
    throw new BadRequestException(`Password strength criteria not met (score: ${result.score}/4). ${warning} ${suggestions}`.trim());
  }
}
