import bcrypt from 'bcryptjs';
import { config } from '../config/index.js';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, config.BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Password strength validation
export interface PasswordStrength {
  isValid: boolean;
  errors: string[];
  score: number; // 0-4
}

export function validatePasswordStrength(password: string): PasswordStrength {
  const errors: string[] = [];
  let score = 0;

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  } else {
    score += 1;
  }

  if (password.length >= 12) {
    score += 1;
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else {
    score += 0.5;
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else {
    score += 0.5;
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  } else {
    score += 0.5;
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  } else {
    score += 0.5;
  }

  return {
    isValid: errors.length === 0,
    errors,
    score: Math.min(4, Math.floor(score)),
  };
}
