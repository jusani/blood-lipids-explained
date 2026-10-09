import { describe, expect, it } from 'vitest';
import { pack } from '../src/content';
import appText from '../src/content/app-text.json';
import type { Lang } from '../src/content/types';

const langs: Lang[] = ['lt', 'en'];

function allTexts(): { key: string; lang: Lang; text: string }[] {
  const out: { key: string; lang: Lang; text: string }[] = [];
  for (const [key, entry] of Object.entries(pack.strings)) {
    for (const lang of langs) {
      const t = entry[lang];
      if (typeof t === 'string') out.push({ key, lang, text: t });
      else if (t) { out.push({ key, lang, text: t.self }); out.push({ key, lang, text: t.helper }); }
    }
  }
  for (const s of pack.sources) for (const lang of langs) if (s.summary?.[lang]) out.push({ key: `source:${s.id}`, lang, text: s.summary[lang]! });
  return out;
}

describe('content pack strings (architect §4, G2)', () => {
  it('every app screen string exists in LT and EN, and in both modes where it has modes', () => {
    for (const [key, entry] of Object.entries(appText.strings as typeof pack.strings)) {
      for (const lang of langs) {
        const t = entry[lang];
        expect(t, `${key}.${lang}`).toBeTruthy();
        if (t && typeof t !== 'string') {
          expect(t.self, `${key}.${lang}.self`).toBeTruthy();
          expect(t.helper, `${key}.${lang}.helper`).toBeTruthy();
        }
      }
    }
  });

  it('every evidence string has EN; LT waits for the native writer', () => {
    const noLt = Object.entries(pack.strings).filter(([, e]) => e.en && !e.lt).map(([k]) => k);
    for (const [key, entry] of Object.entries(pack.strings)) expect(entry.en, key).toBeTruthy();
    expect(noLt.every((k) => !(k in appText.strings))).toBe(true);
  });

  it('placeholders match between LT and EN', () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    for (const [key, entry] of Object.entries(pack.strings)) {
      if (!entry.lt) continue;
      const en = typeof entry.en === 'string' ? entry.en : entry.en.self;
      const lt = typeof entry.lt === 'string' ? entry.lt : entry.lt.self;
      expect(vars(lt), key).toBe(vars(en));
    }
  });
});

describe('stay-educational lint (pm.md §11.1, architect §16.1, QA M4, C4)', () => {
  it('no forbidden diagnosis, risk, medicine-change or evaluative phrasing', () => {
    const hits: string[] = [];
    for (const { key, lang, text } of allTexts()) {
      let s = text.toLowerCase();
      for (const ok of pack.lint.allowed_phrases[lang]) s = s.split(ok.toLowerCase()).join(' ');
      for (const bad of pack.lint.forbidden[lang]) {
        const b = bad.toLowerCase();
        // Whole-word match for plain EN words, stem match otherwise.
        const re = lang === 'en' && /^[a-z ]+$/.test(b) ? new RegExp(`\\b${b}\\b`) : null;
        if (re ? re.test(s) : s.includes(b)) hits.push(`${key} [${lang}]: "${bad}"`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('the intended-purpose sentence is one fixed string (QA M3)', () => {
    expect(pack.strings.intended_purpose.en).toMatch(/does not diagnose, assess risk or recommend treatment/);
  });

  it('every listed source has an open link and is cited by a claim (architect §15)', () => {
    const cited = new Set(pack.rules.claims.flatMap((c) => c.sources ?? []));
    for (const s of pack.sources) {
      expect(s.open_link).toMatch(/^https:\/\//);
      expect(cited.has(s.id), s.id).toBe(true);
    }
  });

  it('uses the approved evidence pack 2026.3', () => {
    expect(pack.manifest.version).toBe('2026.3');
    expect(pack.manifest.approved_by).toBeTruthy();
    expect(pack.manifest.languages).toContain('lt');
    expect(pack.rules.levers.length).toBeGreaterThan(0);
    expect(pack.markers.find((m) => m.id === 'tg')?.mg_dl_factor).toBe(88.6);
    expect(pack.markers.find((m) => m.id === 'ldl')?.mg_dl_factor).toBe(38.67);
  });

  it('pilot defaults: status labels off, accounts off (decisions.md)', () => {
    expect(pack.display.status_labels).toBe(false);
    expect(pack.features.accounts).toBe(false);
  });
});
