import { validatePasswordPolicy } from '../password-policy.util';
import { BadRequestException } from '@nestjs/common';

describe('Password Policy Utility', () => {
  it('should accept strong passphrase >= 10 characters with good entropy', () => {
    expect(() => {
      validatePasswordPolicy('Sentinel#Investigator@2026', ['Sarah Vance', 'sarah@sentinel.gov']);
    }).not.toThrow();
  });

  it('should reject passwords under 10 characters', () => {
    expect(() => {
      validatePasswordPolicy('Short!12', ['Sarah Vance', 'sarah@sentinel.gov']);
    }).toThrow(BadRequestException);
  });

  it('should reject passwords containing user info or weak patterns (zxcvbn < 3)', () => {
    expect(() => {
      validatePasswordPolicy('SarahVance2026!', ['Sarah Vance', 'sarah.vance@sentinel.gov']);
    }).toThrow(BadRequestException);

    expect(() => {
      validatePasswordPolicy('password123456', []);
    }).toThrow(BadRequestException);
  });
});
