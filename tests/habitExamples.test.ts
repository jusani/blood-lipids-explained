import { describe, expect, it } from 'vitest';
import { pack } from '../src/content';
import { fieldsFor, habitsFor } from '../src/lib/habitExamples';
import { translate } from '../src/lib/i18n';

describe('daily habit ideas (2026.7)', () => {
  it('13 short ideas, at most two per option, each inside an option, in pack order, sourced', () => {
    const habits = pack.habit_examples ?? [];
    expect(habits).toHaveLength(13);
    for (const l of pack.rules.levers) expect(habitsFor(l.id).length, l.id).toBeLessThanOrEqual(2);
    const levers = new Set(pack.rules.levers.map((l) => l.id));
    const claims = new Set(pack.rules.claims.map((c) => c.id));
    for (const h of habits) {
      expect(levers.has(h.lever), h.id).toBe(true);
      expect(h.claim.every((c) => claims.has(c)), h.id).toBe(true);
    }
    expect(habitsFor('swap_sat_fat').map((h) => h.id)).toEqual(['habit_butter_thin', 'habit_sandwich_filling']);
  });

  it('every habit reads as a whole sentence once saved, in both languages (QA DH1)', () => {
    for (const h of pack.habit_examples ?? []) {
      for (const lang of ['en', 'lt'] as const) {
        const f = fieldsFor(h, lang);
        const sentence = translate(lang, 'self', 'habit_sentence', f);
        expect(sentence, `${h.id}.${lang}`).not.toMatch(/When (When|With|After)|I will I|Kai Kai|tada tada/);
      }
      expect(h.text.en.when.startsWith('When '), h.id).toBe(true);
      expect(h.text.en.then.startsWith('I will '), h.id).toBe(true);
      expect(h.text.lt.when.startsWith('Kai '), h.id).toBe(true);
    }
  });

  it('the trans-fat option is retired', () => {
    expect(pack.rules.levers.some((l) => l.id === 'avoid_trans_fat')).toBe(false);
  });

  it('a tap fills the two fields without repeating the form\'s own "When" / "I will" / "Kai"', () => {
    const h = habitsFor('swap_sat_fat')[0];
    expect(fieldsFor(h, 'en')).toEqual({ cue: 'I make my breakfast sandwich', action: 'skip the butter or spread it thin' });
    expect(fieldsFor(h, 'lt')).toEqual({ cue: 'ruošiu pusryčių sumuštinį', action: 'sviesto netepsiu arba užtepsiu ploną sluoksnį' });
  });
});
