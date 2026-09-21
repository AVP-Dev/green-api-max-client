import { describe, expect, it } from 'vitest';
import { DEFAULT_POLLING_MS, sanitizePollingInterval } from './config';

describe('sanitizePollingInterval', () => {
  it('keeps allowed values', () => {
    expect(sanitizePollingInterval(1000)).toBe(1000);
    expect(sanitizePollingInterval(5000)).toBe(5000);
  });

  it('falls back to default for garbage', () => {
    expect(sanitizePollingInterval(0)).toBe(DEFAULT_POLLING_MS);
    expect(sanitizePollingInterval('fast')).toBe(DEFAULT_POLLING_MS);
    expect(sanitizePollingInterval(undefined)).toBe(DEFAULT_POLLING_MS);
  });
});
