import { useEffect, useRef, useState, useCallback } from 'react';

interface TabNotificationOptions {
  unreadCount: number;
  baseTitle?: string;
  lang?: 'ru' | 'en';
}

function generateBadgedFaviconSvg(count: number): string {
  const badgeText = count > 9 ? '9+' : String(count);
  const fontSize = count > 9 ? '80' : '105';
  const textY = count > 9 ? '120' : '128';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="maxBrandGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00BFFF" />
      <stop offset="48%" stop-color="#471AFF" />
      <stop offset="100%" stop-color="#9500FF" />
    </linearGradient>
    <filter id="subtleGlow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#471AFF" flood-opacity="0.35" />
    </filter>
  </defs>

  <path
    d="M 120 40 C 220 36, 292 36, 392 40 C 454 44, 476 66, 480 128 C 484 220, 484 292, 480 384 C 476 446, 454 468, 392 472 C 310 476, 240 476, 172 472 C 142 470, 96 496, 52 506 C 42 508, 36 502, 40 492 C 52 460, 62 432, 56 408 C 34 374, 28 320, 32 256 C 28 174, 34 116, 56 82 C 72 58, 92 44, 120 40 Z"
    fill="url(#maxBrandGradient)"
    filter="url(#subtleGlow)"
  />

  <path
    d="M 148 356 L 148 168 C 148 155, 158 146, 172 146 L 204 146 C 214 146, 224 152, 230 162 L 256 208 L 282 162 C 288 152, 298 146, 308 146 L 340 146 C 354 146, 364 155, 364 168 L 364 356 C 364 366, 356 374, 346 374 L 316 374 C 306 374, 298 366, 298 356 L 298 238 L 272 284 C 266 294, 252 298, 242 292 C 239 290, 237 287, 235 284 L 214 238 L 214 356 C 214 366, 206 374, 196 374 L 166 374 C 156 374, 148 366, 148 356 Z"
    fill="#FFFFFF"
  />

  <!-- High-contrast Red Notification Badge with White Ring -->
  <g>
    <circle cx="395" cy="95" r="92" fill="#EF4444" stroke="#FFFFFF" stroke-width="26" />
    <text x="395" y="${textY}" font-family="system-ui, -apple-system, 'SF Pro Display', Roboto, sans-serif" font-size="${fontSize}" font-weight="900" fill="#FFFFFF" text-anchor="middle">${badgeText}</text>
  </g>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Updates the favicon in the browser tab to show an unread badge or default icon
 */
function updateTabFavicon(count: number) {
  if (typeof document === 'undefined') return;

  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }

  if (count <= 0) {
    link.type = 'image/svg+xml';
    link.href = '/favicon.svg';
  } else {
    const dataUri = generateBadgedFaviconSvg(count);
    link.type = 'image/svg+xml';
    link.href = dataUri;
  }
}

/**
 * Hook to manage browser tab unread count indications (Title & Favicon)
 */
export function useTabNotification({
  unreadCount,
  baseTitle = 'MAX Web Messenger',
  lang = 'ru',
}: TabNotificationOptions) {
  const [lastSender, setLastSender] = useState<string | null>(null);
  const isDocumentVisibleRef = useRef<boolean>(
    typeof document !== 'undefined' ? !document.hidden : true
  );
  const flashStepRef = useRef<number>(0);

  // Trigger an unread message alert (flashing tab title when user is on another tab)
  const notifyNewIncoming = useCallback((senderName?: string) => {
    if (typeof document !== 'undefined' && document.hidden) {
      setLastSender(senderName || (lang === 'ru' ? 'Новое сообщение' : 'New message'));
    }
  }, [lang]);

  // Update favicon whenever unreadCount changes
  useEffect(() => {
    updateTabFavicon(unreadCount);
    return () => {
      updateTabFavicon(0);
    };
  }, [unreadCount]);

  // Handle visibility change and title blinking/updates
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      isDocumentVisibleRef.current = isVisible;
      if (isVisible) {
        // Tab gained focus - stop flashing sender name
        setLastSender(null);
      }
    };

    const handleFocus = () => {
      isDocumentVisibleRef.current = true;
      setLastSender(null);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Timer for alternating title when hidden with a new incoming message
  useEffect(() => {
    if (typeof document === 'undefined') return;

    // When no unread messages, keep pristine base title
    if (unreadCount <= 0) {
      document.title = baseTitle;
      return;
    }

    const unreadPrefix = `(${unreadCount > 99 ? '99+' : unreadCount})`;

    // If tab is focused OR no incoming sender alert, show standard static title: "(X) MAX Web Messenger"
    if (!lastSender || !document.hidden) {
      document.title = `${unreadPrefix} ${baseTitle}`;
      return;
    }

    // If tab is in background and there's a new message, alternate title to catch user's eye
    const displaySender = lastSender.length > 20 ? `${lastSender.slice(0, 18)}…` : lastSender;
    const alertTitle = `💬 ${displaySender}!`;
    const standardTitle = `${unreadPrefix} ${baseTitle}`;

    const intervalId = setInterval(() => {
      flashStepRef.current = (flashStepRef.current + 1) % 2;
      document.title = flashStepRef.current === 0 ? alertTitle : standardTitle;
    }, 1500);

    // Initial display
    document.title = alertTitle;

    return () => {
      clearInterval(intervalId);
      // Restore on cleanup or when sender clears
      document.title = unreadCount > 0 ? `${unreadPrefix} ${baseTitle}` : baseTitle;
    };
  }, [unreadCount, baseTitle, lastSender]);

  return { notifyNewIncoming };
}
