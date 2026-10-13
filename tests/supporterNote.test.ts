import { describe, expect, expectTypeOf, it } from 'vitest';
import { pack } from '../src/content';
import { translate } from '../src/lib/i18n';
import { emptyPlan, emptySafety, type Panel, type Plan } from '../src/lib/model';
import { noteHabits, supporterNote, supporterOffered, type NoteHabit, type NoteInput } from '../src/lib/supporterNote';

const lever = pack.rules.levers[0];
const plan: Plan = {
  ...emptyPlan,
  habits: [
    { id: 'h1', cue: 'I finish lunch', action: 'walk 10 minutes', createdAt: '2026-10-01', leverId: lever.id },
    { id: 'h2', cue: 'I shop on Saturday', action: 'buy oat flakes', createdAt: '2026-10-01', leverId: null },
  ],
  checkins: [
    { habitId: 'h1', date: '2026-09-30', result: 'done' },
    { habitId: 'h1', date: '2026-10-12', result: 'done' },  // Monday
    { habitId: 'h1', date: '2026-10-13', result: 'done' },
    { habitId: 'h2', date: '2026-10-13', result: 'not_today' },
  ],
  retestDate: '2027-01-13',
};
// Distinctive stored values that appear nowhere in the habits (QA SM4).
const panel: Panel = {
  id: 'p1', testDate: '2026-10-01', enteredAt: '2026-10-01T10:00:00.000Z', defaultUnit: 'mmol/L',
  values: {
    ldl: { entered: 5.83, unit: 'mmol/L', canonicalMmol: 5.83, unitConfirmedBy: 'default' },
    tg: { entered: 7.41, unit: 'mmol/L', canonicalMmol: 7.41, unitConfirmedBy: 'default' },
  },
  safety: { ...emptySafety, cholMedicine: 'yes' }, mode: 'self', contentVersionSeen: '2026.5', source: 'manual',
};
const link = 'https://example.org/app/?lang=en';
const note = (lang: 'en' | 'lt', retest = false, ids = ['h1', 'h2']) => {
  void panel; // stored alongside the plan, but the builder has no way to take it
  const habits = noteHabits(plan, '2026-10-13').filter((h) => ids.includes(h.id)).map(({ cue, action, week, total }) => ({ cue, action, week, total }));
  return supporterNote({ habits, retestDate: retest ? plan.retestDate : null, link }, lang);
};

describe('supporter note (phase-v2 supporter mode, QA SM1-SM5)', () => {
  it('takes only habit text, day counts, an optional date and the link (SM3, SM4)', () => {
    expectTypeOf<keyof NoteInput>().toEqualTypeOf<'habits' | 'retestDate' | 'link'>();
    expectTypeOf<keyof NoteHabit>().toEqualTypeOf<'cue' | 'action' | 'week' | 'total'>();
    // @ts-expect-error a panel cannot be passed in
    supporterNote({ habits: [], retestDate: null, link, panel }, 'en');
  });

  it('writes counts under each habit, plain numbers only (SM5)', () => {
    expect(note('en')).toBe([
      'My habit plan update:',
      '• When I finish lunch, I will walk 10 minutes. Days done: 2 this week, 3 in total.',
      '• When I shop on Saturday, I will buy oat flakes. Days done: 0 this week, 0 in total.',
      '',
      'Sent from Blood Lipids Explained, a free app that explains cholesterol results. It is not a medical advisor.',
      link,
    ].join('\n'));
  });

  it('carries the not-a-medical-advisor statement and the link in both languages (SM1)', () => {
    expect(note('en')).toContain('It is not a medical advisor.');
    expect(note('lt')).toContain('Ji nėra medicinos patarėja.');
    expect(note('lt').endsWith(link)).toBe(true);
  });

  it('leaves out unticked habits, and the re-test date unless ticked', () => {
    expect(note('en', false, ['h2'])).not.toContain('lunch');
    expect(note('en')).not.toContain('2027');
    expect(note('en', true)).toContain('My next cholesterol test: 13 January 2027.');
    expect(note('lt', true)).toContain('Kitas mano cholesterolio tyrimas: 2027 m. sausio 13 d.\n');
    expect(note('en', false, [])).toBe(`Sent from Blood Lipids Explained, a free app that explains cholesterol results. It is not a medical advisor.\n${link}`);
  });

  it('never contains lab values, the lever title or lever id', () => {
    for (const lang of ['en', 'lt'] as const) {
      const s = note(lang, true);
      for (const v of ['5,83', '5.83', '7,41', '7.41']) expect(s).not.toContain(v);
      expect(s).not.toContain(lever.id);
      expect(s).not.toContain(translate(lang, 'self', lever.title));
    }
  });

  it('is offered only for the person\'s own plan (SM2)', () => {
    expect(supporterOffered('self', plan)).toBe(true);
    expect(supporterOffered('helper', plan)).toBe(false);
    expect(supporterOffered('self', emptyPlan)).toBe(false);
  });
});
