// Habit questionnaire (pm.md D1, designer S10). Answers are about what people do now and are
// used for one thing only: suggesting moments ("cues") for the if-then plan. They never choose,
// hide or rank habit options (QA M2, architect §17.1, levers_config.use_answers: false).
// No "Good to know" facts here: those are claims and wait for the evidence pack.

export type HabitAnswers = Partial<Record<QuestionId, string>>;
export type QuestionId = 'fats' | 'fibre' | 'sweet' | 'alcohol' | 'activity' | 'smoking';

const FREQ = ['most_days', 'few_week', 'rarely', 'never'] as const;

export interface HabitQuestion {
  id: QuestionId;
  text: string;                       // string key
  options: readonly string[];         // answer ids; label key is `hq_${id}`
  cue: string;                        // cue string key suggested by an answer
  cueWhen: readonly string[];         // answers that suggest the cue
}

export const habitQuestions: HabitQuestion[] = [
  { id: 'fats', text: 'hq_fats', options: FREQ, cue: 'cue_cook', cueWhen: ['most_days', 'few_week', 'rarely'] },
  { id: 'fibre', text: 'hq_fibre', options: FREQ, cue: 'cue_breakfast', cueWhen: FREQ },
  { id: 'sweet', text: 'hq_sweet', options: FREQ, cue: 'cue_snack', cueWhen: ['most_days', 'few_week', 'rarely'] },
  { id: 'alcohol', text: 'hq_alcohol', options: FREQ, cue: 'cue_offered_drink', cueWhen: ['most_days', 'few_week', 'rarely'] },
  { id: 'activity', text: 'hq_activity', options: FREQ, cue: 'cue_after_lunch', cueWhen: FREQ },
  { id: 'smoking', text: 'hq_smoking', options: ['smoke_yes', 'smoke_sometimes', 'smoke_no'], cue: 'cue_crave_smoke', cueWhen: ['smoke_yes', 'smoke_sometimes'] },
];

/** Cue string keys suggested by the answers, in question order. */
export function cuesFor(answers: HabitAnswers | undefined): string[] {
  if (!answers) return [];
  return habitQuestions.filter((q) => answers[q.id] && q.cueWhen.includes(answers[q.id]!)).map((q) => q.cue);
}

/** Keeps only known questions and answers (used on restore). */
export function cleanAnswers(raw: unknown): HabitAnswers | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const out: HabitAnswers = {};
  for (const q of habitQuestions) {
    const v = (raw as Record<string, unknown>)[q.id];
    if (typeof v === 'string' && q.options.includes(v)) out[q.id] = v;
  }
  return Object.keys(out).length ? out : undefined;
}
