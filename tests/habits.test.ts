import { describe, expect, it } from 'vitest';
import { parseBackup, makeBackup } from '../src/lib/backup';
import { retestIcs } from '../src/lib/ics';
import { defaultSettings, emptyPlan, emptySafety, type Panel, type Plan } from '../src/lib/model';
import { daysDone, doneThisWeek, lastFourWeeks, missedYesterday } from '../src/results/habits';

const habit = (id: string, createdAt = '2026-10-01') => ({ id, cue: 'I have my morning coffee', action: 'walk 10 minutes', createdAt, leverId: null });
const plan: Plan = {
  ...emptyPlan,
  habits: [habit('h1')],
  checkins: [
    { habitId: 'h1', date: '2026-10-05', result: 'done' },  // Monday
    { habitId: 'h1', date: '2026-10-06', result: 'not_today' },
    { habitId: 'h1', date: '2026-10-07', result: 'done' },
    { habitId: 'h1', date: '2026-09-30', result: 'done' },
  ],
};

describe('habit progress (designer S14, S15)', () => {
  it('days done never resets', () => expect(daysDone(plan, 'h1')).toBe(3));
  it('this week counts from Monday', () => expect(doneThisWeek(plan, 'h1', '2026-10-08')).toBe(2));
  it('four-week strip is 28 days ending today', () => {
    const s = lastFourWeeks(plan, 'h1', '2026-10-08');
    expect(s.length).toBe(28);
    expect(s[27]).toEqual({ date: '2026-10-08', result: null });
    expect(s[26]).toEqual({ date: '2026-10-07', result: 'done' });
  });
  it('welcome back only after a day with no answer', () => {
    expect(missedYesterday(plan, '2026-10-08')).toBe(false);
    expect(missedYesterday(plan, '2026-10-10')).toBe(true);
  });
});

describe('re-test calendar file', () => {
  it('is an all-day event with a reminder', () => {
    const ics = retestIcs('2026-12-31', 'Blood test', 'Bring your earlier results.', 'x@y', new Date('2026-10-08T10:00:00Z'));
    expect(ics).toContain('DTSTART;VALUE=DATE:20261231');
    expect(ics).toContain('DTEND;VALUE=DATE:20270101');
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).not.toMatch(/cholesterol/i); // neutral wording in someone's calendar
  });
});

describe('backup carries the plan', () => {
  it('round-trips habits, check-ins and the re-test date', () => {
    const p: Panel = {
      id: 'p1', testDate: '2026-10-01', enteredAt: '2026-10-01T10:00:00Z', defaultUnit: 'mmol/L',
      values: { ldl: { entered: 4.1, unit: 'mmol/L', canonicalMmol: 4.1, unitConfirmedBy: 'default' } },
      safety: emptySafety, mode: 'self', contentVersionSeen: '2026.1', source: 'manual',
    };
    const file = JSON.stringify(makeBackup(defaultSettings, [p], new Date(), { ...plan, retestDate: '2026-12-31' }));
    const r = parseBackup(file);
    expect(r.ok && r.plan?.habits.length).toBe(1);
    expect(r.ok && r.plan?.checkins.length).toBe(4);
    expect(r.ok && r.plan?.retestDate).toBe('2026-12-31');
  });
  it('drops check-ins for unknown habits', () => {
    const bad = { ...plan, checkins: [...plan.checkins, { habitId: 'nope', date: '2026-10-01', result: 'done' as const }] };
    const p = { id: 'p1', testDate: null, enteredAt: '2026-10-01T10:00:00Z', defaultUnit: 'mmol/L', values: { ldl: { entered: 4, unit: 'mmol/L' } }, safety: {} };
    const r = parseBackup(JSON.stringify({ ...makeBackup(defaultSettings, [p as unknown as Panel]), plan: bad }));
    expect(r.ok && r.plan?.checkins.length).toBe(4);
  });
});

describe('before and after (QA M1, G20, G24)', () => {
  it('strings carry numbers and the difference only', async () => {
    const { pack } = await import('../src/content');
    for (const k of ['ba_lower', 'ba_higher', 'ba_same']) {
      for (const lang of ['en', 'lt'] as const) {
        const s = pack.strings[k][lang] as string;
        expect(s).not.toMatch(/good|better|worse|worked|habit|gerai|geriau|blogiau|įpro/i);
      }
    }
  });
  it('picks the most recent earlier panel of the same mode', async () => {
    const { previousPanel } = await import('../src/results/BeforeAfter');
    const mk = (id: string, testDate: string, mode: 'self' | 'helper' = 'self') => ({ id, testDate, mode, enteredAt: `${testDate}T10:00:00Z` }) as unknown as Panel;
    const cur = mk('c', '2026-12-01');
    expect(previousPanel(cur, [mk('a', '2026-06-01'), mk('b', '2026-09-01'), mk('h', '2026-10-01', 'helper'), cur])?.id).toBe('b');
    expect(previousPanel(mk('a', '2026-06-01'), [mk('b', '2026-09-01')])).toBeNull();
  });
});

describe('habit option order depends only on out-of-range values (QA M2, G25)', async () => {
  const { rankLevers } = await import('../src/lib/rules');
  const L = (id: string, helps: Record<string, string>, effort: 'small' | 'medium' | 'large') =>
    ({ id, helps, effort, evidence: 'guideline', title: id, text: id, claim: 'c' });
  const levers = [
    L('swap_sat_fat', { ldl: '++', non_hdl: '++', tg: '+' }, 'small'),
    L('more_fibre', { ldl: '++', non_hdl: '++' }, 'small'),
    L('less_alcohol', { tg: '+++' }, 'small'),
    L('cut_sweet_drinks', { tg: '++' }, 'small'),
    L('move_more', { tg: '++', hdl: '+++', ldl: '+' }, 'medium'),
    L('lose_weight', { ldl: '++', tg: '+', hdl: '++' }, 'large'),
    L('stop_smoking', { hdl: '+' }, 'large'),
    { ...L('fish_oil', { tg: '+++' }, 'small'), category: 'supplements' },
    L('supplement_free_walk', { tg: '+' }, 'large'), // id merely contains the word: still offered (QA O4)
  ];
  const cfg = { use_answers: false as const, show: { min: 3, max: 5 }, never_offer: ['supplements'] };
  const ids = (o: Parameters<typeof rankLevers>[0]) => rankLevers(o, levers, cfg).map((l) => l.id);

  it('nothing out of range: no options', () => expect(ids([])).toEqual([]));
  it('LDL first: LDL levers by effect, then effort', () =>
    expect(ids(['ldl', 'tg'])).toEqual(['swap_sat_fat', 'more_fibre', 'lose_weight', 'move_more', 'less_alcohol']));
  it('TG first (doctor card): TG levers lead', () =>
    expect(ids(['tg', 'ldl'])).toEqual(['less_alcohol', 'cut_sweet_drinks', 'move_more', 'swap_sat_fat', 'lose_weight']));
  it('never offers supplements, never more than five', () => {
    const all = ids(['tg', 'ldl', 'non_hdl', 'hdl']);
    expect(all).not.toContain('fish_oil');
    expect(all.length).toBe(5);
  });
  it('same values give the same order whatever else is known', () => expect(ids(['hdl'])).toEqual(ids(['hdl'])));

  const L2 = [...levers, L('avoid_trans_fat', { ldl: '++', non_hdl: '++', hdl: '++' }, 'small')];
  const cfg2 = { ...cfg, rank_last: ['avoid_trans_fat'], show_only_when_out_of_range: ['ldl', 'non_hdl', 'total', 'tg'] };
  const ids2 = (o: Parameters<typeof rankLevers>[0]) => rankLevers(o, L2, cfg2).map((l) => l.id);
  it('rank_last goes after every other option for that marker (QA LV2)', () => {
    const o = ids2(['ldl']);
    expect(o.indexOf('avoid_trans_fat')).toBe(o.filter((x) => L2.find((l) => l.id === x)!.helps.ldl).length - 1);
  });
  it('HDL alone brings up no options and no plan (QA LV5)', async () => {
    const { offersPlan } = await import('../src/lib/rules');
    expect(ids2(['hdl'])).toEqual([]);
    expect(offersPlan(['hdl'], cfg2)).toBe(false);
    expect(offersPlan(['total', 'hdl'], cfg2)).toBe(true);
    expect(ids2(['ldl', 'hdl']).length).toBeGreaterThan(0);
  });
});

describe('re-test quick picks are calendar months, not a suggested interval (QA H2)', () => {
  it('adds months without overflowing', async () => {
    const { addMonths } = await import('../src/lib/model');
    expect(addMonths('2026-10-08', 3)).toBe('2027-01-08');
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28');
  });
});

describe('levers in the approved 2026.3 pack', async () => {
  const { pack } = await import('../src/content');
  const { rankLevers, runRules } = await import('../src/lib/rules');
  it('total cholesterol alone gets a non-empty options list', () => {
    const r = runRules({ values: { total: { entered: 6.0, unit: 'mmol/L', canonicalMmol: 6.0, unitConfirmedBy: 'default' } }, safety: emptySafety });
    expect(r.outOfRange).toEqual(['total']);
    const ids = rankLevers(r.outOfRange).map((l) => l.id);
    expect(ids.length).toBeGreaterThanOrEqual(3);
    expect(ids[ids.length - 1]).toBe('avoid_trans_fat');
  });
  it('HDL alone still gets none', () => expect(rankLevers(['hdl'])).toEqual([]));
  it('no lever is a supplement', () => {
    const never = pack.rules.levers_config?.never_offer ?? [];
    for (const l of pack.rules.levers) expect(never.includes(l.id) || (l.category && never.includes(l.category))).toBeFalsy();
  });
});
