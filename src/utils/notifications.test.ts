import { describe, expect, it } from 'vitest';
import { resolveNotificationChannel, shouldDuplicateNative } from './notifications';

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

describe('shouldDuplicateNative', () => {
  it('focused tab + duplication on -> true', () => {
    expect(
      shouldDuplicateNative(true, {
        browserNotificationsEnabled: true,
        inAppPopupsEnabled: true,
        duplicateNativeWhenFocused: true,
      })
    ).toBe(true);
  });

  it('focused tab + duplication off -> false (single channel preserved)', () => {
    expect(
      shouldDuplicateNative(true, {
        browserNotificationsEnabled: true,
        inAppPopupsEnabled: true,
      })
    ).toBe(false);
    expect(
      shouldDuplicateNative(true, {
        browserNotificationsEnabled: true,
        inAppPopupsEnabled: true,
        duplicateNativeWhenFocused: false,
      })
    ).toBe(false);
  });

  it('background tab -> false (native is already primary, no duplication needed)', () => {
    expect(
      shouldDuplicateNative(false, {
        browserNotificationsEnabled: true,
        inAppPopupsEnabled: true,
        duplicateNativeWhenFocused: true,
      })
    ).toBe(false);
  });

  it('system channel off -> false even with duplication on', () => {
    expect(
      shouldDuplicateNative(true, {
        browserNotificationsEnabled: false,
        inAppPopupsEnabled: true,
        duplicateNativeWhenFocused: true,
      })
    ).toBe(false);
  });
});
