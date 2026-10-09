import { describe, expect, it } from 'vitest';
import { pack } from '../src/content';
import type { Panel, Safety, StoredValue } from '../src/lib/model';
import { parseCondition, runRules } from '../src/lib/rules';

type In = Partial<Record<'ldl' | 'total' | 'hdl' | 'tg', number | [number, 'mg/dL']>>;
const noSafety: Safety = { cholMedicine: 'no', familyEarlyCHD: 'no', knownCvdDiabetesCkd: 'no', pregnant: 'no' };

function panel(values: In, safety: Partial<Safety> = {}): Pick<Panel, 'values' | 'safety'> {
  const v: Panel['values'] = {};
  for (const [id, raw] of Object.entries(values)) {
    const [n, unit] = Array.isArray(raw) ? raw : [raw, 'mmol/L' as const];
    const f = pack.markers.find((m) => m.id === id)!.mg_dl_factor;
    const sv: StoredValue = { entered: n, unit, canonicalMmol: unit === 'mg/dL' ? n / f : n, unitConfirmedBy: 'default' };
    v[id as keyof typeof v] = sv;
  }
  return { values: v, safety: { ...noSafety, ...safety } as Safety };
}
const ids = (r: ReturnType<typeof runRules>) => r.fired.map((f) => f.id);
const cards = (r: ReturnType<typeof runRules>) => r.doctorCards.map((f) => f.id);

describe('every pack condition parses', () => {
  it('when / when_mg_dl', () => {
    for (const f of pack.rules.flags) {
      expect(() => parseCondition(f.when), f.id).not.toThrow();
      if (f.when_mg_dl) expect(() => parseCondition(f.when_mg_dl!), f.id).not.toThrow();
    }
  });
});

describe('QA golden cases (qa.md §4)', () => {
  it('G1 all inside ranges: no cards, neutral headline, nothing out of range', () => {
    const r = runRules(panel({ ldl: 2.4, total: 4.5, hdl: 1.5, tg: 1.2 }));
    expect(r.doctorCards).toEqual([]);
    expect(r.headline).toBe('neutral');
    expect(r.outOfRange).toEqual([]);
  });
  it('G2 above goals, no cards', () => {
    const r = runRules(panel({ ldl: 4.1, total: 6.3, hdl: 1.3, tg: 2.2 }));
    expect(r.doctorCards).toEqual([]);
    expect(r.headline).toBe('neutral');
    expect(r.outOfRange).toEqual(['ldl', 'total', 'non_hdl', 'tg']);
  });
  it('G3/G4 LDL 4.9 exactly fires, 4.89 does not', () => {
    expect(cards(runRules(panel({ ldl: 4.9 })))).toEqual(['fh_by_ldl']);
    expect(cards(runRules(panel({ ldl: 4.89 })))).toEqual([]);
  });
  it('G5 LDL 190 / 189 mg/dL', () => {
    expect(cards(runRules(panel({ ldl: [190, 'mg/dL'] })))).toEqual(['fh_by_ldl']);
    const r = runRules(panel({ ldl: [189, 'mg/dL'] }));
    expect(cards(r)).toEqual([]);
    expect(r.markers.ldl!.status).toBe('work_on');
  });
  it('G6 total 7.5 with no LDL', () => {
    const r = runRules(panel({ total: 7.5, hdl: 1.2 }));
    expect(cards(r)).toEqual(['fh_by_total']);
    expect(r.markers.non_hdl!.mmol).toBeCloseTo(6.3);
  });
  it('G7 total only 6.0', () => {
    const r = runRules(panel({ total: 6.0 }));
    expect(cards(r)).toEqual([]);
    expect(r.markers.total!.status).toBe('work_on');
  });
  it('G8 family history yes', () => {
    expect(cards(runRules(panel({ ldl: 2.8 }, { familyEarlyCHD: 'yes' })))).toEqual(['fh_by_family']);
  });
  it('family "not sure" adds the family question only', () => {
    const r = runRules(panel({ ldl: 2.8 }, { familyEarlyCHD: 'dont_know' }));
    expect(cards(r)).toEqual([]);
    expect(r.doctorQuestions).toContain('q_family_check');
  });
  it('G9 on medicine: on-medicine card, not the FH one', () => {
    const r = runRules(panel({ ldl: 5.3 }, { cholMedicine: 'yes' }));
    expect(cards(r)).toEqual(['fh_by_ldl_on_medicine']);
    expect(r.doctorQuestions).toContain('q_treat_enough');
  });
  it('G10/G11 TG 10.0 soon, 9.9 weeks', () => {
    expect(cards(runRules(panel({ tg: 10 })))).toEqual(['tg_very_high']);
    expect(cards(runRules(panel({ tg: 9.9 })))).toEqual(['tg_high']);
  });
  it('G12 TG 12 + LDL 5.5: TG card first, then FH; unreliable note on LDL', () => {
    const r = runRules(panel({ tg: 12, ldl: 5.5 }));
    expect(cards(r)).toEqual(['tg_very_high', 'fh_by_ldl']);
    expect(r.markers.ldl!.notes.map((n) => n.id)).toEqual(['ldl_calc_unreliable']);
    expect(r.outOfRange[0]).toBe('tg');
  });
  it('G13/G14 unreliable note above 4.5 only', () => {
    const r = runRules(panel({ tg: 4.6, ldl: 3.0 }));
    expect(r.markers.ldl!.notes.length).toBe(1);
    expect(r.doctorQuestions).toContain('q_apob');
    expect(runRules(panel({ tg: 4.5, ldl: 3.0 })).markers.ldl!.notes.length).toBe(0);
  });
  it('G18 known condition: LDL and non-HDL zones suppressed, doctor-sets-target note', () => {
    const r = runRules(panel({ ldl: 2.4, total: 4.5, hdl: 1.5 }, { knownCvdDiabetesCkd: 'yes' }));
    expect(r.markers.ldl!.suppressed).toBe(true);
    expect(r.markers.non_hdl!.suppressed).toBe(true);
    expect(r.infoNotes.map((n) => n.card)).toEqual(['note_doctor_sets_target']);
    expect(r.doctorQuestions).toContain('q_my_target');
  });
  it('O1 known condition with LDL 4.0: bar stays suppressed, plan still offered', async () => {
    const { offersPlan } = await import('../src/lib/rules');
    const r = runRules(panel({ ldl: 4.0 }, { knownCvdDiabetesCkd: 'yes' }));
    expect(r.markers.ldl!.suppressed).toBe(true);
    expect(r.outOfRange).toEqual(['ldl']);
    expect(offersPlan(r.outOfRange, { use_answers: false, show: { min: 3, max: 5 }, show_only_when_out_of_range: ['ldl', 'non_hdl', 'total', 'tg'] })).toBe(true);
  });
  it('G21 value in a doctor zone without a flag still gives the doctor headline', () => {
    // LDL 5.0 on medicine fires a card; total 8 with LDL 5 fires LDL. Use TG zone via mg/dL edge instead:
    // TG 9.95 mmol fires tg_high, so pick total 7.6 when the LDL card already covers FH.
    const r = runRules(panel({ ldl: 5.0, total: 7.6 }));
    expect(ids(r)).not.toContain('fh_by_total');
    expect(r.markers.total!.status).toBe('doctor');
    expect(r.headline).toBe('doctor');
  });
  it('G22 pregnancy hides plan and options', () => {
    const r = runRules(panel({ ldl: 3 }, { pregnant: 'yes' }));
    expect([...r.hidden].sort()).toEqual(['options', 'plan']);
  });
});

describe('mg/dL rule: either cut-off, more cautious (evidence README)', () => {
  it('TG 497 mg/dL fires the 5.6 card through the converted value', () => {
    const r = runRules(panel({ tg: [497, 'mg/dL'] }));
    expect(cards(r)).toEqual(['tg_high']);
    expect(r.markers.tg!.status).toBe('doctor');
  });
  it('TG 880 mg/dL (9.93 mmol/L) fires the soon card through the mg/dL cut-off', () => {
    expect(cards(runRules(panel({ tg: [880, 'mg/dL'] })))).toEqual(['tg_very_high']);
  });
  it('total 290 mg/dL (7.50 mmol/L) fires; 289 does not', () => {
    expect(cards(runRules(panel({ total: [290, 'mg/dL'] })))).toEqual(['fh_by_total']);
    expect(cards(runRules(panel({ total: [289, 'mg/dL'] })))).toEqual([]);
  });
  it('zone uses the more serious reading: LDL 100 mg/dL (2.59 mmol/L)', () => {
    expect(runRules(panel({ ldl: [100, 'mg/dL'] })).markers.ldl!.status).toBe('work_on');
  });
  it('at most five doctor questions, retest last', () => {
    const r = runRules(panel({ ldl: 5.5, tg: 6, total: 8, hdl: 1 }, { knownCvdDiabetesCkd: 'yes', familyEarlyCHD: 'dont_know' }));
    expect(r.doctorQuestions.length).toBeLessThanOrEqual(5);
    expect(r.doctorQuestions[r.doctorQuestions.length - 1]).toBe('q_retest');
  });
  it('never more than two cards shown; the rest overflow', () => {
    const r = runRules(panel({ ldl: 5.5, tg: 12 }, { familyEarlyCHD: 'yes' }));
    expect(r.shownCards.length).toBeLessThanOrEqual(2);
  });
});

describe('doctor-summary thresholds come from the zones', () => {
  it('reads each card level', async () => {
    const { cardThreshold } = await import('../src/lib/rules');
    expect(cardThreshold('tg_very_high')).toEqual({ id: 'tg', mmol: 10, mg: 880 });
    expect(cardThreshold('tg_high')).toEqual({ id: 'tg', mmol: 5.6, mg: 500 });
    expect(cardThreshold('fh_by_ldl')).toEqual({ id: 'ldl', mmol: 4.9, mg: 190 });
    expect(cardThreshold('fh_by_total')).toEqual({ id: 'total', mmol: 7.5, mg: 290 });
    expect(cardThreshold('fh_by_family')).toBeNull();
  });
});

describe('values just under a guideline level never display as that level (QA R1)', () => {
  const shown = async (values: In) => {
    const { valueText } = await import('../src/results/present');
    const r = runRules(panel(values));
    return { r, text: (id: 'ldl' | 'total' | 'tg' | 'non_hdl') => valueText(r.markers[id]!, 'en') };
  };
  it('LDL 4.86: shown as 4.86, no card', async () => {
    const { r, text } = await shown({ ldl: 4.86 });
    expect(text('ldl')).toBe('4.86 mmol/L');
    expect(r.doctorCards).toEqual([]);
  });
  it('total 7.46: shown as 7.46, no card', async () => {
    const { r, text } = await shown({ total: 7.46 });
    expect(text('total')).toBe('7.46 mmol/L');
    expect(r.doctorCards).toEqual([]);
  });
  it('TG 5.55: shown as 5.55, no card', async () => {
    const { r, text } = await shown({ tg: 5.55 });
    expect(text('tg')).toBe('5.55 mmol/L');
    expect(r.doctorCards).toEqual([]);
  });
  it('TG 9.96: shown as 9.96 with the weeks card, not the prompt one', async () => {
    const { r, text } = await shown({ tg: 9.96 });
    expect(text('tg')).toBe('9.96 mmol/L');
    expect(r.doctorCards.map((f) => f.id)).toEqual(['tg_high']);
  });
  it('mg/dL values show the conversion with 2 decimals', async () => {
    const { text } = await shown({ ldl: [188, 'mg/dL'] });
    expect(text('ldl')).toBe('4.86 mmol/L (188 mg/dL)');
  });
  it('typed with one decimal stays one decimal', async () => {
    const { text } = await shown({ ldl: 4.1, total: 6.3, hdl: 1.25 });
    expect(text('ldl')).toBe('4.1 mmol/L');
    expect(text('non_hdl')).toBe('5.05 mmol/L');
  });
});
