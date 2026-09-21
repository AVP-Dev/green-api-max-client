/**
 * theme.ts — ЦЕНТРАЛЬНАЯ палитра тёмной темы. Единственный источник правды.
 *
 * Проблема, которую это закрывает: десятки `slate-*` классов разбросаны по
 * компонентам, и любой светлый токен без `dark:`-пары превращается в
 * нечитаемое пятно в тёмной теме. Правила ниже зафиксированы шкалой и
 * проверяются тестом `theme.test.ts` (CI падает при регрессии).
 *
 * ШКАЛА (светлый токен -> тёмная пара):
 *  Фоны:      bg-white/slate-50/slate-100 -> dark:bg-slate-800 (карточки/кнопки/инпуты),
 *             глубокие зоны (nav/панели/модалки) -> dark:bg-slate-900 / slate-950,
 *             slate-200 -> dark:bg-slate-700,
 *             indigo-50 -> dark:bg-indigo-950/60, indigo-100 -> dark:bg-indigo-950,
 *             rose/emerald/amber-50 -> dark:bg-{color}-950/40
 *  Ховеры:    hover:bg-slate-100/50 -> dark:hover:bg-slate-800 (нейтраль),
 *             hover:bg-slate-200 -> dark:hover:bg-slate-700,
 *             hover:bg-indigo-* -> dark:hover:bg-indigo-950/60 (900 для 100),
 *             hover:bg-rose-50 -> dark:hover:bg-rose-950/50
 *  Текст:     slate-900/800 -> slate-100, 700 -> 200, 600 -> 300, 500 -> 400, 400 -> 500,
 *             #471AFF/indigo-600/700 -> indigo-300,
 *             rose-600 -> 400, rose-700+ -> 300/200 (аналогично emerald/amber)
 *  Бордеры:   slate-200 -> dark:border-slate-700, slate-100 -> dark:border-slate-800,
 *             slate-300 -> dark:border-slate-600, цветные 100/200 -> dark:border-{color}-800
 *  Divide:    slate-100 -> dark:divide-slate-800
 *
 * ИСКЛЮЧЕНИЯ (пары не нужны, читаемо в обеих темах):
 *  text-white на бренд-кнопках (max-gradient-primary, bg-[#471AFF], bg-rose-600),
 *  bg-rose-500 / bg-emerald-500 (бейджи/точки), bg-slate-900 (код-блоки, бэкдропы),
 *  max-gradient-* (фирменные градиенты).
 *
 * Как добавить цвет: сначала допиши пару сюда и в theme.test.ts, потом используй.
 */

export interface ThemeRule {
  /** Regex светлого токена (с lookbehind от hover:/dark:/sm:-префиксов). */
  pattern: string;
  /** Маркер тёмной пары, обязан быть на той же className-строке. */
  darkMarker: string;
}

const L = (t: string) => `(?<![\\w:-])${t}(?![\\w/-])`;

export const THEME_RULES: ThemeRule[] = [
  // Фоны
  { pattern: L('bg-white'), darkMarker: 'dark:bg-' },
  { pattern: L('bg-slate-50'), darkMarker: 'dark:bg-' },
  { pattern: L('bg-slate-100'), darkMarker: 'dark:bg-' },
  { pattern: L('bg-slate-200'), darkMarker: 'dark:bg-' },
  { pattern: L('bg-slate-200/60'), darkMarker: 'dark:bg-' },
  { pattern: L('bg-slate-50/80'), darkMarker: 'dark:bg-' },
  { pattern: L('bg-slate-50/70'), darkMarker: 'dark:bg-' },
  { pattern: L('bg-slate-50/60'), darkMarker: 'dark:bg-' },
  { pattern: L('bg-slate-50/50'), darkMarker: 'dark:bg-' },
  { pattern: L('bg-slate-100/80'), darkMarker: 'dark:bg-' },
  { pattern: L('bg-slate-100/70'), darkMarker: 'dark:bg-' },
  { pattern: L('bg-slate-100/60'), darkMarker: 'dark:bg-' },
  { pattern: L('bg-slate-200/60'), darkMarker: 'dark:bg-' },
  { pattern: L('bg-indigo-50'), darkMarker: 'dark:bg-' },
  { pattern: L('bg-indigo-100'), darkMarker: 'dark:bg-' },
  { pattern: L('bg-rose-50'), darkMarker: 'dark:bg-' },
  { pattern: L('bg-emerald-50'), darkMarker: 'dark:bg-' },
  { pattern: L('bg-amber-50'), darkMarker: 'dark:bg-' },
  // Ховер-фоны
  { pattern: L('hover:bg-slate-100'), darkMarker: 'dark:hover:bg-' },
  { pattern: L('hover:bg-slate-50'), darkMarker: 'dark:hover:bg-' },
  { pattern: L('hover:bg-slate-200'), darkMarker: 'dark:hover:bg-' },
  { pattern: L('hover:bg-slate-200/60'), darkMarker: 'dark:hover:bg-' },
  { pattern: L('hover:bg-indigo-50'), darkMarker: 'dark:hover:bg-' },
  { pattern: L('hover:bg-indigo-100'), darkMarker: 'dark:hover:bg-' },
  { pattern: L('hover:bg-rose-50'), darkMarker: 'dark:hover:bg-' },
  // Текст
  { pattern: L('text-slate-400'), darkMarker: 'dark:text-' },
  { pattern: L('text-slate-500'), darkMarker: 'dark:text-' },
  { pattern: L('text-slate-600'), darkMarker: 'dark:text-' },
  { pattern: L('text-slate-700'), darkMarker: 'dark:text-' },
  { pattern: L('text-slate-800'), darkMarker: 'dark:text-' },
  { pattern: L('text-slate-900'), darkMarker: 'dark:text-' },
  { pattern: L('text-\\[#471AFF\\]'), darkMarker: 'dark:text-' },
  { pattern: L('text-indigo-600'), darkMarker: 'dark:text-' },
  { pattern: L('text-indigo-700'), darkMarker: 'dark:text-' },
  { pattern: L('text-indigo-800'), darkMarker: 'dark:text-' },
  { pattern: L('text-rose-600'), darkMarker: 'dark:text-' },
  { pattern: L('text-rose-700'), darkMarker: 'dark:text-' },
  { pattern: L('text-rose-800'), darkMarker: 'dark:text-' },
  { pattern: L('text-emerald-600'), darkMarker: 'dark:text-' },
  { pattern: L('text-emerald-700'), darkMarker: 'dark:text-' },
  { pattern: L('text-emerald-800'), darkMarker: 'dark:text-' },
  { pattern: L('text-amber-600'), darkMarker: 'dark:text-' },
  { pattern: L('text-amber-700'), darkMarker: 'dark:text-' },
  { pattern: L('text-amber-800'), darkMarker: 'dark:text-' },
  // Ховер-текст
  { pattern: L('hover:text-slate-600'), darkMarker: 'dark:hover:text-' },
  { pattern: L('hover:text-slate-700'), darkMarker: 'dark:hover:text-' },
  { pattern: L('hover:text-slate-800'), darkMarker: 'dark:hover:text-' },
  { pattern: L('hover:text-\\[#471AFF\\]'), darkMarker: 'dark:hover:text-' },
  { pattern: L('hover:text-rose-600'), darkMarker: 'dark:hover:text-' },
  // Бордеры / divide / misc
  { pattern: L('border-slate-100'), darkMarker: 'dark:border-' },
  { pattern: L('border-slate-200'), darkMarker: 'dark:border-' },
  { pattern: L('border-slate-300'), darkMarker: 'dark:border-' },
  { pattern: L('border-indigo-100'), darkMarker: 'dark:border-' },
  { pattern: L('border-indigo-200'), darkMarker: 'dark:border-' },
  { pattern: L('border-rose-100'), darkMarker: 'dark:border-' },
  { pattern: L('border-rose-200'), darkMarker: 'dark:border-' },
  { pattern: L('border-emerald-100'), darkMarker: 'dark:border-' },
  { pattern: L('border-amber-100'), darkMarker: 'dark:border-' },
  { pattern: L('border-amber-200'), darkMarker: 'dark:border-' },
  { pattern: L('divide-slate-100'), darkMarker: 'dark:divide-' },
  { pattern: L('focus:bg-white'), darkMarker: 'dark:focus:bg-' },
  // Градиентные стопы (кейс: карточка «Выйти» from-rose-50/to-pink-50)
  { pattern: L('from-white'), darkMarker: 'dark:from-' },
  { pattern: L('from-slate-50'), darkMarker: 'dark:from-' },
  { pattern: L('from-indigo-50'), darkMarker: 'dark:from-' },
  { pattern: L('from-rose-50'), darkMarker: 'dark:from-' },
  { pattern: L('via-white'), darkMarker: 'dark:via-' },
  { pattern: L('via-slate-50'), darkMarker: 'dark:via-' },
  { pattern: L('to-white'), darkMarker: 'dark:to-' },
  { pattern: L('to-slate-50'), darkMarker: 'dark:to-' },
  { pattern: L('to-pink-50'), darkMarker: 'dark:to-' },
  { pattern: L('to-purple-50'), darkMarker: 'dark:to-' },
  { pattern: L('to-indigo-50'), darkMarker: 'dark:to-' },
];

/**
 * Exemption'ов больше нет: даже фирменные поверхности (max-gradient-*,
 * bg-[#471AFF], bg-rose-500) проверяются наравне со всеми — они уже
 * доказали, что умеют прятать светлую соседнюю ветку тернарника
 * (кейс: кнопка «Применить и сохранить шлюз»).
 * Градиентные кнопки и так проходят: text-white и hover:opacity правил не имеют.
 */
export function isExemptClassLine(_line: string): boolean {
  return false;
}
