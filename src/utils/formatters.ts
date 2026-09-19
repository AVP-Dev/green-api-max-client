import { Language } from '../types';

const PASTEL_PALETTES = [
  { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200' },
  { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
  { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
  { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-200' },
  { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-200' },
  { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700', border: 'border-fuchsia-200' },
];

export interface AvatarColorStyle {
  bg: string;
  text: string;
  border: string;
  hue: number;
  saturation: number;
  lightness: number;
  bgClass: string;
  textClass: string;
  borderClass: string;
  style: {
    backgroundColor: string;
    color: string;
    borderColor: string;
  };
}

/**
 * Deterministically hashes a phone number or ID string using FNV-1a (32-bit).
 * Small variations in the number result in well-distributed hash values.
 */
export function hashPhone(phone: string): number {
  const clean = sanitizePhone(phone) || phone.trim();
  let hash = 2166136261;
  for (let i = 0; i < clean.length; i++) {
    hash ^= clean.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

/**
 * Returns a consistent, deterministic pastel color palette based on the hash of the contact's phone number.
 * Calculates HSL with golden ratio angle distribution for rich variety, high pastel lightness,
 * and high-contrast matching text color for pristine legibility.
 */
export function getAvatarColor(id: string): AvatarColorStyle {
  const hash = hashPhone(id);

  // Golden angle (137.508 deg) distributes adjacent phone numbers widely across hues
  const hue = Math.round((hash * 137.508) % 360);

  // Soft, elegant pastel saturation (55% - 70%)
  const saturation = 55 + (hash % 16);

  // High pastel lightness (88% - 92%)
  const lightness = 88 + (hash % 5);

  // High-contrast text color (matching hue, 23% - 28% lightness for WCAG AAA compliance)
  const textLightness = 23 + (hash % 6);
  const textSaturation = Math.min(85, saturation + 18);

  // Subtle framing border
  const borderLightness = lightness - 8;
  const borderSaturation = Math.max(30, saturation - 10);

  const bg = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  const text = `hsl(${hue}, ${textSaturation}%, ${textLightness}%)`;
  const border = `hsl(${hue}, ${borderSaturation}%, ${borderLightness}%)`;

  const fallbackIndex = hash % PASTEL_PALETTES.length;
  const fallback = PASTEL_PALETTES[fallbackIndex];

  return {
    bg,
    text,
    border,
    hue,
    saturation,
    lightness,
    bgClass: fallback.bg,
    textClass: fallback.text,
    borderClass: fallback.border,
    style: {
      backgroundColor: bg,
      color: text,
      borderColor: border,
    },
  };
}

/**
 * Derives clean, legible initials from a contact's display name or phone number
 */
export function getAvatarInitials(nameOrPhone: string): string {
  if (!nameOrPhone) return 'M';
  const trimmed = nameOrPhone.trim();

  // 1. If name contains alphabetical characters (Cyrillic or Latin)
  const letters = trimmed.replace(/[^a-zA-Zа-яА-ЯёЁ]/g, '');
  if (letters.length > 0) {
    const parts = trimmed.split(/[\s_-]+/).filter(Boolean);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      const c1 = parts[0].replace(/[^a-zA-Zа-яА-ЯёЁ]/g, '')[0];
      const c2 = parts[1].replace(/[^a-zA-Zа-яА-ЯёЁ]/g, '')[0];
      if (c1 && c2) return (c1 + c2).toUpperCase();
    }
    return letters.slice(0, 2).toUpperCase();
  }

  // 2. If it's a phone number
  const digits = sanitizePhone(trimmed) || trimmed.replace(/\D/g, '');
  if (digits.length >= 4) {
    // Use last 2 digits so every contact number has a distinct, memorable 2-character initial
    return digits.slice(-2);
  }
  if (digits.length >= 2) {
    return digits.slice(0, 2);
  }
  return trimmed.slice(0, 2).toUpperCase() || 'M';
}

/**
 * Strict sanitization to plain numeric digits for MAX messenger
 */
export function sanitizePhone(input: string): string {
  if (!input) return '';
  // Strip any @c.us or other suffixes first, then retain digits only
  const clean = input.split('@')[0];
  return clean.replace(/\D/g, '');
}

/**
 * Formats a plain phone number for elegant human reading
 */
export function formatDisplayPhone(rawPhone: string): string {
  const digits = sanitizePhone(rawPhone);
  if (!digits) return rawPhone;

  // Russian standard 11 digits starting with 7
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    const prefix = digits.startsWith('7') ? '+7' : '8';
    return `${prefix} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
  }

  // 10 digits
  if (digits.length === 10) {
    return `+7 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8, 10)}`;
  }

  // Generic international formatting
  if (digits.length > 7) {
    return `+${digits.slice(0, digits.length - 7)} ${digits.slice(digits.length - 7, digits.length - 4)} ${digits.slice(digits.length - 4)}`;
  }

  return digits;
}

/**
 * Time formatting for message bubble (HH:mm)
 */
export function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Formats day separators (Today, Yesterday, Date)
 */
export function formatDateDivider(timestamp: number, lang: Language): string {
  const date = new Date(timestamp);
  const now = new Date();
  
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return lang === 'ru' ? 'Сегодня' : 'Today';
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return lang === 'ru' ? 'Вчера' : 'Yesterday';
  }

  const locale = lang === 'ru' ? 'ru-RU' : 'en-US';
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}
