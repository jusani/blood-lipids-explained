// Rules engine (architect.md §4, §16.1, §17; qa.md §18). A pure, deterministic function:
// a panel and its safety answers in, everything the results and summary screens show out.
// It does arithmetic and comparisons only: no risk, score, probability or prediction.
// Statuses are computed (to choose bar zones, doctor cards and habit-option order) but,
// with status_labels permanently false, never shown as a word or verdict.

import { pack } from '../content';
import type { Lever, LeversConfig, RuleFlag, RuleMarker, Severity, Zone, ZoneStatus } from '../content/types';
import type { Panel } from './model';
import { calculate } from './units';

// ---------------------------------------------------------------------------
// Condition language: comparisons, and / or / not, parentheses, flag(id), any_flag_of(a, b).
// Bare words other than variables are literals (yes, no, dont_know, not_sure); null is null.
// ---------------------------------------------------------------------------

type Val = number | string | null | boolean;
type Env = Record<string, Val>;
type Node =
  | { t: 'num'; v: number }
  | { t: 'id'; v: string }
  | { t: 'call'; fn: string; args: string[] }
  | { t: 'cmp'; op: string; a: Node; b: Node }
  | { t: 'and' | 'or'; a: Node; b: Node }
  | { t: 'not'; a: Node };

const TOKEN = /\s*(>=|<=|==|!=|>|<|\(|\)|,|\d+(?:\.\d+)?|[a-z_][a-z0-9_]*)/gy;

function tokenize(src: string): string[] {
  const out: string[] = [];
  TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while (TOKEN.lastIndex < src.length && (m = TOKEN.exec(src))) out.push(m[1]);
  if (TOKEN.lastIndex < src.trimEnd().length) throw new Error(`Cannot read condition: ${src}`);
  return out;
}

const cache = new Map<string, Node>();
export function parseCondition(src: string): Node {
  const hit = cache.get(src);
  if (hit) return hit;
  const tk = tokenize(src);
  let i = 0;
  const peek = () => tk[i];
  const take = (want?: string) => {
    const t = tk[i++];
    if (want && t !== want) throw new Error(`Expected ${want} in: ${src}`);
    return t;
  };
  const primary = (): Node => {
    const t = take();
    if (t === '(') { const n = or(); take(')'); return n; }
    if (t === 'not') return { t: 'not', a: primary() };
    if (/^\d/.test(t)) return { t: 'num', v: Number(t) };
    if (peek() === '(') {
      take('(');
      const args: string[] = [];
      while (peek() !== ')') { args.push(take()); if (peek() === ',') take(','); }
      take(')');
      return { t: 'call', fn: t, args };
    }
    return { t: 'id', v: t };
  };
  const cmp = (): Node => {
    const a = primary();
    if (['>=', '<=', '==', '!=', '>', '<'].includes(peek())) { const op = take(); return { t: 'cmp', op, a, b: primary() }; }
    return a;
  };
  const and = (): Node => { let a = cmp(); while (peek() === 'and') { take(); a = { t: 'and', a, b: cmp() }; } return a; };
  const or = (): Node => { let a = and(); while (peek() === 'or') { take(); a = { t: 'or', a, b: and() }; } return a; };
  const node = or();
  if (i !== tk.length) throw new Error(`Unexpected "${tk[i]}" in: ${src}`);
  cache.set(src, node);
  return node;
}

function evaluate(n: Node, env: Env, fired: Set<string>): Val {
  switch (n.t) {
    case 'num': return n.v;
    case 'id': return n.v === 'null' ? null : n.v in env ? env[n.v] : n.v;
    case 'call':
      if (n.fn === 'flag') return fired.has(n.args[0]);
      if (n.fn === 'any_flag_of') return n.args.some((a) => fired.has(a));
      throw new Error(`Unknown function ${n.fn}`);
    case 'not': return !evaluate(n.a, env, fired);
    case 'and': return !!evaluate(n.a, env, fired) && !!evaluate(n.b, env, fired);
    case 'or': return !!evaluate(n.a, env, fired) || !!evaluate(n.b, env, fired);
    case 'cmp': {
      const a = evaluate(n.a, env, fired), b = evaluate(n.b, env, fired);
      if (n.op === '==') return a === b;
      if (n.op === '!=') return a !== b;
      if (typeof a !== 'number' || typeof b !== 'number') return false; // missing value: never fires
      return n.op === '>=' ? a >= b : n.op === '<=' ? a <= b : n.op === '>' ? a > b : a < b;
    }
  }
}

function variables(n: Node, out = new Set<string>()): Set<string> {
  if (n.t === 'id') out.add(n.v);
  else if (n.t === 'cmp' || n.t === 'and' || n.t === 'or') { variables(n.a, out); variables(n.b, out); }
  else if (n.t === 'not') variables(n.a, out);
  return out;
}

// ---------------------------------------------------------------------------
// Zones: each row is an interval; a row without its own bound takes its neighbour's.
// ---------------------------------------------------------------------------

interface Interval { lo: number; loIncl: boolean; hi: number; hiIncl: boolean }

export function intervals(zones: Zone[], mg: boolean): Interval[] {
  const g = (z: Zone, k: 'below' | 'below_or_equal' | 'from' | 'above') =>
    (mg ? (z as unknown as Record<string, number | undefined>)[`${k}_mg_dl`] : z[k]);
  const own = zones.map((z) => ({
    lo: g(z, 'from') ?? g(z, 'above'), loIncl: g(z, 'from') !== undefined,
    hi: g(z, 'below') ?? g(z, 'below_or_equal'), hiIncl: g(z, 'below_or_equal') !== undefined,
  }));
  return own.map((z, i) => {
    const prev = own[i - 1], next = own[i + 1];
    const lo = z.lo ?? prev?.hi ?? -Infinity;
    const loIncl = z.lo !== undefined ? z.loIncl : prev?.hi !== undefined ? !prev.hiIncl : true;
    const hi = z.hi ?? next?.lo ?? Infinity;
    const hiIncl = z.hi !== undefined ? z.hiIncl : next?.lo !== undefined ? !next.loIncl : true;
    return { lo, loIncl, hi, hiIncl };
  });
}

function zoneIndex(zones: Zone[], value: number, mg: boolean): number {
  const iv = intervals(zones, mg);
  return iv.findIndex((r) => (r.loIncl ? value >= r.lo : value > r.lo) && (r.hiIncl ? value <= r.hi : value < r.hi));
}

const RANK: Record<ZoneStatus, number> = { usual: 0, work_on: 1, doctor: 2 };

// ---------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------

export type ValueId = 'ldl' | 'total' | 'hdl' | 'tg' | 'non_hdl' | 'athero_index';

export interface MarkerResult {
  id: ValueId;
  mmol: number;
  /** Value as typed when typed in mg/dL (non-HDL: when both parts were). */
  mg: number | null;
  /** Decimals to show the mmol/L value with: as typed (at least 1), 2 for converted or calculated
   *  values, so a value just under a guideline level never displays as that level (QA R1). */
  decimals: number;
  zones: Zone[];
  zone: number;           // index into zones, -1 when no zone applies
  status: ZoneStatus | null;
  suppressed: boolean;    // known condition: no zones shown, "your doctor sets your target"
  guidelineText?: string;
  notes: RuleFlag[];      // info flags attached to this marker
}

export interface RulesResult {
  markers: Partial<Record<ValueId, MarkerResult>>;
  fired: RuleFlag[];
  doctorCards: RuleFlag[];   // doctor_soon first, then doctor_weeks, in pack order
  shownCards: RuleFlag[];    // at most flags_display.max_cards
  overflowCards: RuleFlag[];
  infoNotes: RuleFlag[];     // info flags not attached to a marker
  headline: 'doctor' | 'neutral';
  hidden: Set<string>;       // e.g. plan, options (pregnancy)
  outOfRange: ValueId[];     // outside the guideline range, in the fixed order used for habit options
  doctorQuestions: string[];
  contentVersion: string;
}

const SUPERSEDED_BY: [string, string][] = [['tg_high', 'tg_very_high']];

const MG_FACTOR = (id: string) => (id === 'tg' ? pack.rules.units.tg_mg_dl_per_mmol : pack.rules.units.chol_mg_dl_per_mmol);

export function runRules(panel: Pick<Panel, 'values' | 'safety'>): RulesResult {
  const v = panel.values;
  const mmol: Partial<Record<ValueId, number>> = {};
  const mg: Partial<Record<ValueId, number>> = {};
  for (const id of ['ldl', 'total', 'hdl', 'tg'] as const) {
    const sv = v[id];
    if (!sv) continue;
    mmol[id] = sv.canonicalMmol;
    if (sv.unit === 'mg/dL') mg[id] = sv.entered;
  }
  const calc = calculate({ total: mmol.total, hdl: mmol.hdl });
  if (calc.non_hdl !== undefined) mmol.non_hdl = calc.non_hdl;
  if (calc.athero_index !== undefined) mmol.athero_index = calc.athero_index;
  if (mg.total !== undefined && mg.hdl !== undefined) mg.non_hdl = mg.total - mg.hdl;

  const s = panel.safety;
  const answers: Env = {
    on_chol_medicine: s.cholMedicine,
    family_early_chd: s.familyEarlyCHD,
    family_known_fh: s.familyEarlyCHD, // one question covers both (designer S4, QA S4)
    known_cvd_diabetes_ckd: s.knownCvdDiabetesCkd,
    pregnant: s.pregnant,
  };
  const envMmol: Env = { ...answers };
  const envMg: Env = { ...answers };
  for (const id of ['ldl', 'total', 'hdl', 'tg', 'non_hdl'] as const) {
    envMmol[id] = mmol[id] ?? null;
    envMg[id] = mg[id] ?? (mmol[id] !== undefined ? mmol[id]! * MG_FACTOR(id) : null);
  }

  // Flags, in pack order (later flags may refer to earlier ones). A value typed in mg/dL
  // fires a flag if either the source's mg/dL cut-off or the mmol/L cut-off is crossed.
  const firedIds = new Set<string>();
  const fired: RuleFlag[] = [];
  for (const f of pack.rules.flags) {
    let hit = !!evaluate(parseCondition(f.when), envMmol, firedIds);
    if (!hit && f.when_mg_dl) {
      const node = parseCondition(f.when_mg_dl);
      const usesMg = [...variables(node)].some((x) => x in mg);
      if (usesMg) hit = !!evaluate(node, envMg, firedIds);
    }
    if (hit) { firedIds.add(f.id); fired.push(f); }
  }
  // The two triglyceride bands are exclusive. With a mg/dL value near 10 mmol/L the two
  // readings can land in different bands; the more serious one is shown alone.
  for (const [lower, higher] of SUPERSEDED_BY) {
    if (firedIds.has(lower) && firedIds.has(higher)) {
      firedIds.delete(lower);
      fired.splice(fired.findIndex((f) => f.id === lower), 1);
    }
  }

  const suppressed = new Set(fired.flatMap((f) => f.effect?.suppress_status ?? []));
  const hidden = new Set(fired.flatMap((f) => f.effect?.hide ?? []));

  // Zones: the more serious of the two readings for mg/dL values.
  const typedDecimals = (id: 'ldl' | 'total' | 'hdl' | 'tg') => {
    const sv = v[id];
    if (!sv) return 0;
    if (sv.unit === 'mg/dL') return 2;
    const str = String(sv.entered);
    const i = str.indexOf('.');
    return Math.min(2, Math.max(1, i < 0 ? 0 : str.length - i - 1));
  };
  const decimalsFor = (id: ValueId) =>
    id === 'athero_index' ? 1
      : id === 'non_hdl' ? Math.max(typedDecimals('total'), typedDecimals('hdl'), 1)
        : typedDecimals(id);

  const markers: RulesResult['markers'] = {};
  for (const rm of pack.rules.markers as RuleMarker[]) {
    const id = rm.id as ValueId;
    const value = mmol[id];
    if (value === undefined) continue;
    const zones = rm.zones ?? [];
    let zone = zones.length ? zoneIndex(zones, value, false) : -1;
    const mgValue = mg[id];
    if (zones.length && mgValue !== undefined && zones.some((z) => z.below_mg_dl ?? z.from_mg_dl ?? z.below_or_equal_mg_dl ?? z.above_mg_dl)) {
      const z2 = zoneIndex(zones, mgValue, true);
      const score = (i: number) => (i < 0 ? -1 : RANK[zones[i].status] * 100 + i);
      if (score(z2) > score(zone)) zone = z2;
    }
    markers[id] = {
      id,
      mmol: value,
      mg: mgValue ?? null,
      decimals: decimalsFor(id),
      zones,
      zone,
      status: zone >= 0 ? zones[zone].status : null,
      suppressed: suppressed.has(id),
      guidelineText: rm.guideline_text,
      notes: fired.filter((f) => f.attach_to === id),
    };
  }

  const order: Severity[] = pack.rules.flags_display?.order ?? ['doctor_soon', 'doctor_weeks', 'info'];
  const doctorCards = fired
    .filter((f) => f.severity !== 'info')
    .sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
  const max = pack.rules.flags_display?.max_cards ?? 2;
  const infoNotes = fired.filter((f) => f.severity === 'info' && !f.attach_to);

  // B1: the doctor headline also follows any value in a doctor zone, flag or not.
  const anyDoctorZone = Object.values(markers).some((m) => m && !m.suppressed && m.status === 'doctor');
  const headline = doctorCards.length > 0 || anyDoctorZone ? 'doctor' : 'neutral';

  // Habit options are ordered only by which values sit outside the guideline range (QA §18, M2),
  // in a fixed marker order; triglycerides lead when a triglyceride doctor card is showing.
  const fixed: ValueId[] = firedIds.has('tg_very_high') || firedIds.has('tg_high')
    ? ['tg', 'ldl', 'total', 'non_hdl', 'hdl']
    : ['ldl', 'total', 'non_hdl', 'tg', 'hdl']; // levers_config.ordering, pack 2026.3
  // A suppressed marker (known condition: no bar shown) still counts here when its value is
  // above the usual zone, so the person is still offered a plan (QA O1).
  const outOfRange = fixed.filter((id) => {
    const m = markers[id];
    return !!m && !!m.status && m.status !== 'usual';
  });

  // Questions for the doctor summary (architect §4 doctor_questions), at most five.
  const q: string[] = [];
  const any = (...ids: string[]) => ids.some((x) => firedIds.has(x));
  if (any('fh_by_ldl', 'fh_by_total', 'fh_by_family')) q.push('q_fh');
  if (any('fh_by_ldl_on_medicine')) q.push('q_treat_enough');
  if (any('known_condition')) q.push('q_my_target');
  if (any('tg_high', 'tg_very_high')) q.push('q_tg_high');
  if (s.familyEarlyCHD === 'dont_know') q.push('q_family_check');
  if (any('ldl_calc_unreliable')) q.push('q_apob');
  if (outOfRange.length && !any('fh_by_ldl_on_medicine')) q.push('q_treat');
  q.push('q_retest');
  const doctorQuestions = q.length > 5 ? [...q.slice(0, 4), 'q_retest'] : q;

  return {
    markers, fired, doctorCards,
    shownCards: doctorCards.slice(0, max),
    overflowCards: doctorCards.slice(max),
    infoNotes, headline, hidden, outOfRange, doctorQuestions,
    contentVersion: pack.manifest.version,
  };
}

/** Zone a doctor card refers to, so the summary can state that guideline level. */
const CARD_ZONE: Record<string, [ValueId, string]> = {
  tg_very_high: ['tg', 'zone_tg_doctor_soon'],
  tg_high: ['tg', 'zone_tg_doctor_weeks'],
  fh_by_ldl: ['ldl', 'zone_ldl_doctor'],
  fh_by_ldl_on_medicine: ['ldl', 'zone_ldl_doctor'],
  fh_by_total: ['total', 'zone_total_doctor'],
};

/** For a doctor card: the marker and the guideline level ("x or higher") in mmol/L and mg/dL. */
export function cardThreshold(flagId: string): { id: ValueId; mmol: number; mg: number } | null {
  const hit = CARD_ZONE[flagId];
  if (!hit) return null;
  const zones = pack.rules.markers.find((m) => m.id === hit[0])?.zones ?? [];
  const i = zones.findIndex((z) => z.label === hit[1]);
  if (i < 0) return null;
  const mmol = intervals(zones, false)[i].lo, mg = intervals(zones, true)[i].lo;
  return Number.isFinite(mmol) ? { id: hit[0], mmol, mg } : null;
}

/** "< 2.6" style guideline range for the summary table: the first zone's bound. */
export function guidelineRange(id: ValueId): { op: '<' | '>' | '≤' | '≥'; value: number } | null {
  const rm = pack.rules.markers.find((m) => m.id === id);
  const zones = rm?.zones ?? [];
  const usual = zones.find((z) => z.status === 'usual');
  if (!usual) return null;
  if (usual.below !== undefined) return { op: '<', value: usual.below };
  if (usual.below_or_equal !== undefined) return { op: '≤', value: usual.below_or_equal };
  if (usual.above !== undefined) return { op: '>', value: usual.above };
  if (usual.from !== undefined) return { op: '≥', value: usual.from };
  return null;
}

const EFFORT = { small: 0, medium: 1, large: 2 } as const;

/** Whether a habit plan is offered: a value outside its guideline range, and with a pack that
 *  limits it, one of the listed markers (HDL alone brings up no plan, QA LV5). */
export function offersPlan(
  outOfRange: ValueId[],
  config: LeversConfig | null = pack.rules.levers_config ?? null,
): boolean {
  const only = config?.show_only_when_out_of_range;
  return only ? outOfRange.some((id) => only.includes(id)) : outOfRange.length > 0;
}

/**
 * Habit options (architect §4 levers_config; QA M2, G25). Order depends only on which values
 * are outside their guideline ranges: levers helping the first out-of-range marker (fixed
 * marker order, triglycerides first when a triglyceride doctor card shows), then the larger
 * effect the source gives for that marker, then smaller effort. Questionnaire answers play no part.
 */
export function rankLevers(
  outOfRange: ValueId[],
  levers: Lever[] = pack.rules.levers ?? [],
  config: LeversConfig | null = pack.rules.levers_config ?? null,
): Lever[] {
  if (!offersPlan(outOfRange, config) || !levers.length) return [];
  const last = new Set(config?.rank_last ?? []);
  const never = config?.never_offer ?? [];
  // Explicit ids or categories only (QA O4).
  const usable = levers.filter((l) => !never.includes(l.id) && !(l.category && never.includes(l.category)));
  const firstHelped = (l: Lever) => {
    const i = outOfRange.findIndex((id) => l.helps[id]);
    return i < 0 ? Infinity : i;
  };
  const strength = (l: Lever) => {
    const i = firstHelped(l);
    return i === Infinity ? 0 : (l.helps[outOfRange[i]] ?? '').length;
  };
  const ranked = usable
    .filter((l) => firstHelped(l) !== Infinity)
    .sort((a, b) =>
      firstHelped(a) - firstHelped(b)
      || Number(last.has(a.id)) - Number(last.has(b.id))
      || strength(b) - strength(a)
      || EFFORT[a.effort] - EFFORT[b.effort]);
  const max = config?.show.max ?? 5;
  return ranked.slice(0, max);
}
