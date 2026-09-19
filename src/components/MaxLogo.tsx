import React from 'react';

export interface MaxLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'icon' | 'full';
  showDomain?: boolean;
  className?: string;
  id?: string;
}

const SIZE_MAP = {
  xs: { icon: 24, text: 'text-sm', badge: 'text-[9px] px-1 py-0.2' },
  sm: { icon: 30, text: 'text-base', badge: 'text-[10px] px-1.5 py-0.5' },
  md: { icon: 36, text: 'text-lg', badge: 'text-xs px-1.5 py-0.5' },
  lg: { icon: 44, text: 'text-xl', badge: 'text-xs px-2 py-0.5' },
  xl: { icon: 56, text: 'text-2xl', badge: 'text-sm px-2.5 py-1' },
};

/**
 * Official MAX (max.ru) logo component rendered with authentic brandbook specifications:
 * - Colors: Голубая комета (#00BFFF) -> Синий гигант (#471AFF) -> Пурпурная туманность (#9500FF)
 * - Modern rounded speech bubble squircle with messenger tail
 * - Bold geometric "M" center mark
 */
export const MaxLogo: React.FC<MaxLogoProps> = ({
  size = 'md',
  variant = 'icon',
  showDomain = true,
  className = '',
  id,
}) => {
  const cfg = SIZE_MAP[size] || SIZE_MAP.md;
  const gradientId = `max-grad-${size}-${id || 'default'}`;

  const iconElement = (
    <div
      className="shrink-0 relative select-none"
      style={{ width: cfg.icon, height: cfg.icon }}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm"
      >
        <defs>
          <linearGradient
            id={gradientId}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#00BFFF" />
            <stop offset="50%" stopColor="#471AFF" />
            <stop offset="100%" stopColor="#9500FF" />
          </linearGradient>
        </defs>

        {/* Squircle Chat Bubble with tail */}
        <path
          d="M 24 8 
             C 45 7, 55 7, 76 8 
             C 89 9, 94 15, 95 28 
             C 96 46, 96 54, 95 72 
             C 94 85, 89 91, 76 92 
             C 60 93, 48 93, 34 92 
             C 27 91, 18 97, 10 99 
             C 8 100, 7 98, 8 96 
             C 10 90, 12 85, 11 80 
             C 7 74, 6 63, 7 50 
             C 6 34, 7 23, 11 16 
             C 15 11, 18 9, 24 8 Z"
          fill={`url(#${gradientId})`}
        />

        {/* Clean geometric bold M */}
        <path
          d="M 31 70
             L 31 32
             C 31 29, 33 27, 36 27
             L 42 27
             C 44 27, 46 28, 48 30
             L 51.5 39
             L 55 30
             C 57 28, 59 27, 61 27
             L 67 27
             C 70 27, 72 29, 72 32
             L 72 70
             C 72 72, 70 73.5, 68 73.5
             L 62 73.5
             C 60 73.5, 59 72, 59 70
             L 59 44
             L 54 53.5
             C 53 55, 50 55, 49 53.5
             L 44 44
             L 44 70
             C 44 72, 42 73.5, 40 73.5
             L 34 73.5
             C 32 73.5, 31 72, 31 70 Z"
          fill="#FFFFFF"
        />
      </svg>
    </div>
  );

  if (variant === 'icon') {
    return (
      <div id={id} className={`inline-flex items-center ${className}`}>
        {iconElement}
      </div>
    );
  }

  return (
    <div id={id} className={`inline-flex items-center gap-2.5 ${className}`}>
      {iconElement}
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 leading-none">
          <span className={`font-black text-slate-900 tracking-tight font-sans ${cfg.text}`}>
            MAX
          </span>
          <span className={`font-bold bg-indigo-50 text-[#471AFF] border border-indigo-100/80 rounded-md tracking-wider ${cfg.badge}`}>
            WEB
          </span>
        </div>
        {showDomain && (
          <span className="text-[11px] font-semibold text-slate-400 tracking-tight mt-0.5">
            max.ru
          </span>
        )}
      </div>
    </div>
  );
};
