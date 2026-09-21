import { useEffect, useRef, useState, useCallback } from 'react';

interface TabNotificationOptions {
  unreadCount: number;
  baseTitle?: string;
  lang?: 'ru' | 'en';
}

/**
 * Draws a high-contrast PNG favicon with brand gradient and vivid red badge or dot.
 * Using HTML5 Canvas to PNG data URI guarantees 100% compatibility across Chrome, Safari, Edge, and Firefox.
 */
function generateBadgedFaviconPng(count: number): string {
  if (typeof document === 'undefined') return '';

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // 1. Draw rounded brand background
  const radius = 16;
  const grad = ctx.createLinearGradient(0, 0, 64, 64);
  grad.addColorStop(0, '#00BFFF');
  grad.addColorStop(0.5, '#471AFF');
  grad.addColorStop(1, '#9500FF');

  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(64 - radius, 0);
  ctx.quadraticCurveTo(64, 0, 64, radius);
  ctx.lineTo(64, 64 - radius);
  ctx.quadraticCurveTo(64, 64, 64 - radius, 64);
  ctx.lineTo(radius, 64);
  ctx.quadraticCurveTo(0, 64, 0, 64 - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // 2. Draw white 'M' monogram in the center
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  // Simplified stylized M monogram
  ctx.moveTo(16, 46);
  ctx.lineTo(16, 18);
  ctx.lineTo(24, 18);
  ctx.lineTo(32, 34);
  ctx.lineTo(40, 18);
  ctx.lineTo(48, 18);
  ctx.lineTo(48, 46);
  ctx.lineTo(41, 46);
  ctx.lineTo(41, 28);
  ctx.lineTo(34, 42);
  ctx.lineTo(30, 42);
  ctx.lineTo(23, 28);
  ctx.lineTo(23, 46);
  ctx.closePath();
  ctx.fill();

  // 3. If count > 0, draw high-visibility Red Badge / Dot on top-right
  if (count > 0) {
    const isLarge = count > 9;
    const badgeText = count > 99 ? '99+' : String(count);

    if (isLarge) {
      // Pill badge for numbers 10+
      const pillW = count > 99 ? 34 : 28;
      const pillH = 22;
      const pillX = 64 - pillW - 2;
      const pillY = 2;
      const pillR = 11;

      // Outer white ring
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(pillX - 2, pillY - 2, pillW + 4, pillH + 4, pillR + 2) : ctx.rect(pillX - 2, pillY - 2, pillW + 4, pillH + 4);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      // Red fill
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(pillX, pillY, pillW, pillH, pillR) : ctx.rect(pillX, pillY, pillW, pillH);
      ctx.fillStyle = '#EF4444';
      ctx.fill();

      // Badge number text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, pillX + pillW / 2, pillY + pillH / 2 + 1);
    } else {
      // Circle badge for 1-9
      const cx = 48;
      const cy = 16;
      const r = 14;

      // Outer white ring
      ctx.beginPath();
      ctx.arc(cx, cy, r + 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      // Red badge
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = '#EF4444';
      ctx.fill();

      // Badge number text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 15px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, cx, cy + 1);
    }
  }

  return canvas.toDataURL('image/png');
}

/**
 * Updates the favicon in the browser tab to show an unread badge or restore default
 */
function updateTabFavicon(count: number) {
  if (typeof document === 'undefined') return;

  try {
    const allFavicons = document.querySelectorAll<HTMLLinkElement>(
      "link[rel*='icon']"
    );

    if (count <= 0) {
      // Remove dynamic icon
      const dynamicIcons = document.querySelectorAll<HTMLLinkElement>("link[data-dynamic-favicon='true']");
      dynamicIcons.forEach((el) => el.remove());

      // Restore original icons
      allFavicons.forEach((el) => {
        if (el.dataset.origHref) {
          el.href = el.dataset.origHref;
          delete el.dataset.origHref;
        }
        if (el.dataset.origType) {
          el.type = el.dataset.origType;
          delete el.dataset.origType;
        }
      });
    } else {
      const dataUri = generateBadgedFaviconPng(count);
      if (!dataUri) return;

      // Update ALL existing favicon links (including alternate icon and svg icon)
      allFavicons.forEach((el) => {
        if (!el.dataset.origHref) {
          el.dataset.origHref = el.href;
        }
        if (!el.dataset.origType && el.type) {
          el.dataset.origType = el.type;
        }
        el.type = 'image/png';
        el.href = dataUri;
      });

      // Also ensure a primary dynamic link is present
      let dynamicLink = document.querySelector<HTMLLinkElement>("link[data-dynamic-favicon='true']");
      if (!dynamicLink) {
        dynamicLink = document.createElement('link');
        dynamicLink.rel = 'icon';
        dynamicLink.type = 'image/png';
        dynamicLink.setAttribute('data-dynamic-favicon', 'true');
        document.head.appendChild(dynamicLink);
      }
      dynamicLink.href = dataUri;
    }
  } catch (err) {
    console.warn('Failed to update tab favicon:', err);
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
  const [alertDetails, setAlertDetails] = useState<{ sender: string; text?: string } | null>(null);
  const flashStepRef = useRef<number>(0);

  // Trigger an unread message alert (flashing tab title)
  const notifyNewIncoming = useCallback((senderName?: string, previewText?: string) => {
    const sender = senderName || (lang === 'ru' ? 'Новое сообщение' : 'New message');
    setAlertDetails({ sender, text: previewText });
  }, [lang]);

  // Update favicon whenever unreadCount changes
  useEffect(() => {
    updateTabFavicon(unreadCount);
    return () => {
      updateTabFavicon(0);
    };
  }, [unreadCount]);

  // Listen for user window focus to clear active alert
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleFocus = () => {
      // Delay clearing alert slightly so user has a moment to notice
      setTimeout(() => {
        setAlertDetails(null);
      }, 1000);
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        setTimeout(() => {
          setAlertDetails(null);
        }, 1000);
      }
    });

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Title flashing & unread count synchronization
  useEffect(() => {
    if (typeof document === 'undefined') return;

    // No unread messages: show default title
    if (unreadCount <= 0 && !alertDetails) {
      document.title = baseTitle;
      return;
    }

    const unreadCountNum = Math.max(unreadCount, alertDetails ? 1 : 0);
    const unreadBadge = `(${unreadCountNum > 99 ? '99+' : unreadCountNum})`;

    // If tab is focused and no incoming alert, show steady "(1) MAX Web Messenger"
    if (!alertDetails) {
      document.title = `${unreadBadge} ${baseTitle}`;
      return;
    }

    // When there's a fresh incoming message alert, alternate title to catch attention
    const sender = alertDetails.sender;
    const shortSender = sender.length > 18 ? `${sender.slice(0, 16)}…` : sender;
    const titleA = `🔴 ${unreadBadge} ${shortSender}: ${lang === 'ru' ? 'сообщение' : 'message'}`;
    const titleB = `💬 ${unreadBadge} ${baseTitle}`;

    document.title = titleA;

    const intervalId = setInterval(() => {
      flashStepRef.current = (flashStepRef.current + 1) % 2;
      document.title = flashStepRef.current === 0 ? titleA : titleB;
    }, 1200);

    return () => {
      clearInterval(intervalId);
      document.title = unreadCount > 0 ? `${unreadBadge} ${baseTitle}` : baseTitle;
    };
  }, [unreadCount, baseTitle, alertDetails, lang]);

  return { notifyNewIncoming };
}

