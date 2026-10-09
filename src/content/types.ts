// Shape of the content pack (architect.md §4, §15, §16). Everything medical or
// user-visible lives in the pack; code only reads it.

export type Lang = 'lt' | 'en';
export type Mode = 'self' | 'helper';
export type Unit = 'mmol/L' | 'mg/dL';
export type MarkerId = 'ldl' | 'total' | 'hdl' | 'tg';
export type CalculatedId = 'non_hdl' | 'athero_index';

/** A string is either one text for both modes, or a self/helper pair. */
export type ModeText = string | { self: string; helper: string };
/** Evidence-pack strings may be EN only until the native LT writer adds LT. */
export type PackString = { en: ModeText; lt?: ModeText };

export interface Range { min: number; max: number }

export interface MeasuredMarker {
  id: MarkerId;
  kind: 'measured';
  names: Record<Lang, string>;
  lab_names: { lt: string; en: string };
  aliases: string[];
  mg_dl_factor: number;            // mg/dL ÷ factor = mmol/L
  display_order: number;
  /** Input sanity only (not a medical range): outside → ask, don't explain. mmol/L. */
  plausible: Range;
  /** Where a missing-decimal suggestion may land. mmol/L. Input heuristic only. */
  typical: Range;
  /** Values in this band (in either unit) always ask which unit (QA B5c). */
  ambiguous?: Range;
  // zones: added by the evidence pass; read only by the rules engine (not built yet).
  zones?: unknown[];
}

export interface CalculatedMarker {
  id: CalculatedId;
  kind: 'calculated';
  names: Record<Lang, string>;
  formula: string;
  display_order: number;
}

export type SourceType = 'guideline' | 'consensus_statement' | 'systematic_review' | 'meta_analysis' | 'rct' | 'observational' | 'other';

export interface Source {
  id: string;
  citation: string;
  type: SourceType;
  doi: string | null;
  correction_note?: string | null;
  open_link: string;
  full_text_free: boolean;
  /** Plain-language summary (a claim itself, QA EV5). Not in the evidence pack yet. */
  summary: Partial<Record<Lang, string>> | null;
  /** Date the stored copy was retrieved. */
  checked: string | null;
}

export type ZoneStatus = 'usual' | 'work_on' | 'doctor';
export interface Zone {
  below?: number; below_mg_dl?: number;
  below_or_equal?: number; below_or_equal_mg_dl?: number;
  from?: number; from_mg_dl?: number;
  above?: number; above_mg_dl?: number;
  status: ZoneStatus;
  label: string;
  claim: string;
}
export interface RuleMarker { id: string; kind: 'measured' | 'calculated'; zones?: Zone[]; guideline_text?: string; headline?: boolean }
export type Severity = 'doctor_soon' | 'doctor_weeks' | 'info';
export interface RuleFlag {
  id: string;
  when: string;
  when_mg_dl?: string;
  severity: Severity;
  time_frame?: string;
  card: string;
  claim: string;
  attach_to?: string;
  effect?: { suppress_status?: string[]; hide?: string[] };
  repeat_before?: string[];
}
export interface Lever {
  id: string;
  /** Marker → how much the source says it moves it ("+" to "+++"). */
  helps: Record<string, string>;
  evidence: string;
  effort: 'small' | 'medium' | 'large';
  category?: string;
  title: string;
  text: string;
  claim: string | string[];
}
export interface LeversConfig {
  use_answers: false;
  show: { min: number; max: number };
  never_offer?: string[];
  /** Options appear only when one of these is outside its guideline range (QA LV5). */
  show_only_when_out_of_range?: string[];
  /** Ranked after all other options within each marker (QA LV2). */
  rank_last?: string[];
  heading?: string;
  note_with_doctor_flag?: string;
  note_on_medicine?: string;
}
export interface Retest { interval_weeks: number | null; person_picks_date: boolean; suggested_weeks?: number | null; suggested_weeks_source?: string; text?: string }
export interface Claim {
  id: string;
  text: string | string[] | null;
  sources?: string[];
  status?: string;
  quotes?: { source: string; quote: string; locator?: string }[];
}

export interface ContentPack {
  manifest: {
    version: string;
    placeholder: boolean;
    released: string | null;
    approved_by: string | null;
    approved_date: string | null;
    reviewed_by_clinician: string | null;
    languages: Lang[];
    ui_languages: Lang[];
    lt_native_review: boolean;
    imported_from: string;
  };
  display: { status_labels: boolean };
  features: { accounts: boolean };
  official_address: string;
  /** Dedicated project address for feedback (QA L2). null hides the feedback link. */
  feedback_email: string | null;
  markers: MeasuredMarker[];
  calculated: CalculatedMarker[];
  source_types: SourceType[];
  sources: Source[];
  bar_scale: Record<string, Range>;
  /** Ranges, doctor flags and claims from the evidence pack. Read only by the rules engine. */
  rules: {
    units: { chol_mg_dl_per_mmol: number; tg_mg_dl_per_mmol: number; mg_dl_rule?: string };
    markers: RuleMarker[];
    flags: RuleFlag[];
    flags_display: { max_cards: number; order: Severity[] };
    claims: Claim[];
    levers: Lever[];
    levers_config: LeversConfig | null;
    retest: Retest | null;
  };
  lint: {
    forbidden: Record<Lang, string[]>;
    /** Exact phrases removed before scanning (approved question wording). */
    allowed_phrases: Record<Lang, string[]>;
  };
  strings: Record<string, PackString>;
}
