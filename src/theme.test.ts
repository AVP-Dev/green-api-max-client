/**
 * theme.test.ts — сторож централизации (см. theme.ts).
 * Сканирует все className-строки в tsx-файлах src: каждый светлый токен
 * обязан иметь dark-пару на той же строке. Падает в CI при регрессии,
 * чтобы тёмная тема больше никогда не расползалась в хаос.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { THEME_RULES, isExemptClassLine } from './theme';

function collectTsx(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectTsx(full, out);
    } else if (full.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

describe('dark theme centralization guard', () => {
  it('every light token has a dark: pair on the same className line', () => {
    const root = join(process.cwd(), 'src');
    const violations: string[] = [];
    for (const file of collectTsx(root)) {
      const lines = readFileSync(file, 'utf-8').split('\n');
      lines.forEach((line, idx) => {
        if (!line.includes('className') || isExemptClassLine(line)) return;
        for (const rule of THEME_RULES) {
          if (new RegExp(rule.pattern).test(line) && !line.includes(rule.darkMarker)) {
            violations.push(
              `${relative(process.cwd(), file)}:${idx + 1}: /${rule.pattern}/ without ${rule.darkMarker}`
            );
            break;
          }
        }
      });
    }
    expect(violations, `\n${violations.join('\n')}`).toEqual([]);
  });
});
