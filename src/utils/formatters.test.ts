import { describe, expect, it } from 'vitest';
import { formatDisplayPhone, sanitizePhone } from './formatters';

describe('sanitizePhone', () => {
  it('strips @c.us suffix and non-digits', () => {
    expect(sanitizePhone('79991234567@c.us')).toBe('79991234567');
    expect(sanitizePhone('+7 (999) 123-45-67')).toBe('79991234567');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizePhone('')).toBe('');
  });
});

describe('formatDisplayPhone', () => {
  it('formats RU 11-digit numbers', () => {
    expect(formatDisplayPhone('79991234567')).toBe('+7 (999) 123-45-67');
  });

  it('returns raw input when no digits', () => {
    expect(formatDisplayPhone('abc')).toBe('abc');
  });
});
