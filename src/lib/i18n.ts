import { pack } from '../content';
import type { Lang, Mode, ModeText } from '../content/types';

export type Vars = Record<string, string | number>;

export function pickText(text: ModeText, mode: Mode): string {
  return typeof text === 'string' ? text : text[mode];
}

export function translate(lang: Lang, mode: Mode, key: string, vars?: Vars): string {
  const entry = pack.strings[key];
  if (!entry) {
    if (import.meta.env.DEV) console.warn(`Missing string: ${key}`);
    return key;
  }
  let s = pickText(entry[lang] ?? entry.en, mode); // EN until the LT writer adds LT
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
  return s;
}

/** Numbers as people read them: "4,1" in Lithuanian, "4.1" in English. */
export function formatNumber(value: number, lang: Lang, maxDecimals = 2, minDecimals = 0): string {
  return new Intl.NumberFormat(lang === 'lt' ? 'lt-LT' : 'en-GB', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
    useGrouping: false,
  }).format(value);
}

export function formatDate(iso: string, lang: Lang): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(lang === 'lt' ? 'lt-LT' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(y, m - 1, d),
  );
}

export function unitLabel(lang: Lang, unit: 'mmol/L' | 'mg/dL'): string {
  return translate(lang, 'self', unit === 'mmol/L' ? 'unit_mmol' : 'unit_mg');
}

export function detectLanguage(search: string, saved: Lang | null, navLang: string | undefined): Lang {
  const q = new URLSearchParams(search).get('lang');
  if (q === 'lt' || q === 'en') return q;
  if (saved) return saved;
  if (navLang && navLang.toLowerCase().startsWith('en')) return 'en';
  return 'lt'; // first market is Lithuania
}
