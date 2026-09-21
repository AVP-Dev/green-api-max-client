import { describe, expect, it } from 'vitest';
import { resolveNotificationChannel } from './notifications';

describe('resolveNotificationChannel', () => {
  it('focused tab -> popup when enabled', () => {
    expect(
      resolveNotificationChannel(true, {
        browserNotificationsEnabled: true,
        inAppPopupsEnabled: true,
      })
    ).toBe('popup');
  });

  it('focused tab falls back to native when popups off', () => {
    expect(
      resolveNotificationChannel(true, {
        browserNotificationsEnabled: true,
        inAppPopupsEnabled: false,
      })
    ).toBe('native');
  });

  it('background tab -> native when enabled', () => {
    expect(
      resolveNotificationChannel(false, {
        browserNotificationsEnabled: true,
        inAppPopupsEnabled: true,
      })
    ).toBe('native');
  });

  it('background tab waits with popup when native off', () => {
    expect(
      resolveNotificationChannel(false, {
        browserNotificationsEnabled: false,
        inAppPopupsEnabled: true,
      })
    ).toBe('popup');
  });

  it('both channels off -> none (badge/title only)', () => {
    expect(
      resolveNotificationChannel(true, {
        browserNotificationsEnabled: false,
        inAppPopupsEnabled: false,
      })
    ).toBe('none');
    expect(
      resolveNotificationChannel(false, {
        browserNotificationsEnabled: false,
        inAppPopupsEnabled: false,
      })
    ).toBe('none');
  });
});
