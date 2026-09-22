/**
 * Central helper for focus-aware desktop notifications.
 *
 * Industry-standard routing (MDN Notifications API + 2026 UX consensus):
 * - In-app popup  -> only when the user is LOOKING at this tab (active session).
 * - Native browser Notification -> only when the tab is HIDDEN / in background.
 * - Never both at once -> eliminates the duplication complaint.
 * - Notifications sharing the same `tag` (one per chat) replace each other
 *   instead of stacking, with `renotify: true` so the OS still alerts.
 * - Stale native notifications are auto-closed as soon as the tab
 *   becomes visible again (MDN `visibilitychange -> close()` pattern).
 */

export type BrowserPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export interface NotificationChannelPrefs {
  browserNotificationsEnabled: boolean;
  inAppPopupsEnabled: boolean;
  /**
   * Осознанное дублирование системным каналом поверх одноканального
   * роутинга: баннер ОС рядом с карточкой, даже когда вкладка открыта.
   */
  duplicateNativeWhenFocused?: boolean;
}

export type NotificationChannel = 'popup' | 'native' | 'none';

const activeNative = new Map<string, Notification>();
let globalListenersAttached = false;

function chatTag(chatId: string): string {
  return `max-chat-${chatId}`;
}

export function getBrowserNotificationPermission(): BrowserPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  const p = Notification.permission;
  if (p === 'granted' || p === 'denied' || p === 'default') return p;
  return 'default';
}

export async function requestBrowserNotificationPermission(): Promise<BrowserPermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    // Must be called from a user gesture (button click) — Chrome blocks
    // non-gesture permission prompts entirely.
    const result = await Notification.requestPermission();
    if (result === 'granted' || result === 'denied' || result === 'default') return result;
    return getBrowserNotificationPermission();
  } catch {
    return getBrowserNotificationPermission();
  }
}

/** True when the user is actually looking at this tab right now. */
export function isTabFocused(): boolean {
  if (typeof document === 'undefined') return true;
  if (document.hidden) return false;
  if (typeof document.hasFocus === 'function' && !document.hasFocus()) return false;
  return true;
}

/**
 * Decides which single channel should fire for an incoming message.
 * Guarantees at most one visual channel — no duplication by construction.
 */
export function resolveNotificationChannel(
  tabFocused: boolean,
  prefs: NotificationChannelPrefs,
): NotificationChannel {
  if (tabFocused) {
    if (prefs.inAppPopupsEnabled) return 'popup';
    if (prefs.browserNotificationsEnabled) return 'native';
    return 'none';
  }
  if (prefs.browserNotificationsEnabled) return 'native';
  if (prefs.inAppPopupsEnabled) return 'popup';
  return 'none';
}

/**
 * Нужно ли ВДОБАВОК к карточке показать системное уведомление ОС,
 * хотя вкладка в фокусе. В фоне дублирование не требуется — там
 * системный канал и так первичный (см. resolveNotificationChannel).
 */
export function shouldDuplicateNative(
  tabFocused: boolean,
  prefs: NotificationChannelPrefs,
): boolean {
  return (
    tabFocused &&
    prefs.browserNotificationsEnabled &&
    prefs.duplicateNativeWhenFocused === true
  );
}

export interface NativeNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  chatId: string;
  onClick?: () => void;
}

/**
 * Shows a native OS/browser notification, replacing any previous one
 * from the same chat (same tag). Returns null when permission is missing
 * or the platform does not support notifications.
 */
export function showNativeNotification(opts: NativeNotificationOptions): Notification | null {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;
  if (Notification.permission !== 'granted') return null;

  // SECURITY: icon приходит из API (avatarUrl) — разрешаем только https/data:image,
  // иначе подмена на javascript:/file: может стать вектором обхода.
  let safeIcon = '/favicon.svg';
  if (opts.icon && /^(https:\/\/|data:image\/)/i.test(opts.icon.trim())) {
    safeIcon = opts.icon;
  }

  try {
    const tag = chatTag(opts.chatId);

    // Deduplicate: close the previous notification from this chat first,
    // so rapid messages replace instead of stacking.
    const prev = activeNative.get(tag);
    if (prev) {
      try {
        prev.close();
      } catch {
        // ignore
      }
      activeNative.delete(tag);
    }

    const n = new Notification(opts.title, {
      body: opts.body,
      icon: safeIcon,
      // `badge` / `renotify` are valid at runtime in Chrome/Edge/Firefox,
      // but missing from this TS lib version — hence the cast.
      badge: '/favicon.svg',
      tag,
      renotify: true,
      silent: false,
    } as NotificationOptions);

    activeNative.set(tag, n);

    n.onclick = () => {
      try {
        window.focus();
      } catch {
        // ignore
      }
      try {
        opts.onClick?.();
      } finally {
        try {
          n.close();
        } catch {
          // ignore
        }
        if (activeNative.get(tag) === n) activeNative.delete(tag);
      }
    };
    n.onclose = () => {
      if (activeNative.get(tag) === n) activeNative.delete(tag);
    };
    n.onerror = () => {
      if (activeNative.get(tag) === n) activeNative.delete(tag);
    };

    return n;
  } catch {
    return null;
  }
}

/** Closes native notification(s) — for one chat, or all when chatId is omitted. */
export function closeNativeNotificationsForChat(chatId?: string): void {
  try {
    if (chatId) {
      const n = activeNative.get(chatTag(chatId));
      if (n) {
        try {
          n.close();
        } catch {
          // ignore
        }
        activeNative.delete(chatTag(chatId));
      }
      return;
    }
    activeNative.forEach((n) => {
      try {
        n.close();
      } catch {
        // ignore
      }
    });
    activeNative.clear();
  } catch {
    // ignore
  }
}

/**
 * Auto-dismiss stale native notifications once the user returns to the tab
 * (MDN recommended pattern). Registered once per page load.
 */
export function attachNativeAutocloseOnVisible(): void {
  if (globalListenersAttached) return;
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  globalListenersAttached = true;

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) closeNativeNotificationsForChat();
  });
  window.addEventListener('focus', () => closeNativeNotificationsForChat());
}
