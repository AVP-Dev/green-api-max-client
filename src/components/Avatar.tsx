import React from 'react';
import { getAvatarColor, getAvatarInitials } from '../utils/formatters';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  id: string;
  name?: string;
  avatarUrl?: string;
  size?: AvatarSize;
  className?: string;
  showBorder?: boolean;
  elementId?: string;
}

const SIZE_MAP: Record<AvatarSize, { dimension: string; text: string }> = {
  xs: { dimension: 'w-6 h-6', text: 'text-[10px]' },
  sm: { dimension: 'w-8 h-8', text: 'text-[11px]' },
  md: { dimension: 'w-10 h-10', text: 'text-xs' },
  lg: { dimension: 'w-11 h-11', text: 'text-xs' },
  xl: { dimension: 'w-14 h-14', text: 'text-base font-extrabold' },
};

/**
 * Allowlist для аватаров: только https и data:image.
 * Блокирует javascript:/blob:/vbscript: из непроверенных API-ответов (XSS через <img src>).
 */
function isSafeAvatarUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,/i.test(trimmed)) return true;
  try {
    const parsed = new URL(trimmed, typeof window !== 'undefined' ? window.location.origin : 'https://localhost');
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export const Avatar: React.FC<AvatarProps> = ({
  id,
  name,
  avatarUrl,
  size = 'md',
  className = '',
  showBorder = true,
  elementId,
}) => {
  const [imgFailed, setImgFailed] = React.useState(false);
  const colorStyle = getAvatarColor(id);
  const initials = getAvatarInitials(name || id);
  const sizeConfig = SIZE_MAP[size] || SIZE_MAP.md;

  if (avatarUrl && !imgFailed) {
    // Недоверенный URL (напр. javascript:) — показываем инициалы вместо <img>.
    if (!isSafeAvatarUrl(avatarUrl)) {
      // fall through к инициалам ниже
    } else {
      return (
        <div
          id={elementId}
          className={`rounded-full overflow-hidden shrink-0 select-none ${sizeConfig.dimension} ${
            showBorder ? 'ring-1 ring-slate-200' : ''
          } ${className}`}
        >
          <img
            src={avatarUrl}
            alt={name || id}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover rounded-full"
          />
        </div>
      );
    }
  }

  return (
    <div
      id={elementId}
      className={`rounded-full flex items-center justify-center font-bold shrink-0 select-none transition-transform duration-150 ${sizeConfig.dimension} ${sizeConfig.text} ${
        showBorder ? 'border' : ''
      } ${className}`}
      style={{
        backgroundColor: colorStyle.bg,
        color: colorStyle.text,
        borderColor: showBorder ? colorStyle.border : 'transparent',
      }}
      title={name || id}
      aria-label={name || id}
    >
      <span className="tracking-tighter">{initials}</span>
    </div>
  );
};
