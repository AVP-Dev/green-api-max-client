import React from 'react';
import { getAvatarColor, getAvatarInitials } from '../utils/formatters';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  id: string;
  name?: string;
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

export const Avatar: React.FC<AvatarProps> = ({
  id,
  name,
  size = 'md',
  className = '',
  showBorder = true,
  elementId,
}) => {
  const colorStyle = getAvatarColor(id);
  const initials = getAvatarInitials(name || id);
  const sizeConfig = SIZE_MAP[size] || SIZE_MAP.md;

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
