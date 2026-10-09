import { describe, expect, it } from 'vitest';
import { pack } from '../src/content';
import { cleanAnswers, cuesFor, habitQuestions } from '../src/lib/questionnaire';
import { rankLevers } from '../src/lib/rules';
import { feedbackHref } from '../src/screens/About';

describe('habit questionnaire (pm D1, designer S10, QA M2)', () => {
  it('covers fats, fibre, sugar, alcohol, activity and smoking, every one with text and option labels in LT and EN', () => {
    expect(habitQuestions.map((q) => q.id)).toEqual(['fats', 'fibre', 'sweet', 'alcohol', 'activity', 'smoking']);
    for (const q of habitQuestions) {
      for (const k of [q.text, q.cue, ...q.options.map((o) => `hq_${o}`)]) {
        expect(pack.strings[k]?.en, k).toBeTruthy();
        expect(pack.strings[k]?.lt, k).toBeTruthy();
      }
    }
  });
  it('answers only suggest cues', () => {
    expect(cuesFor({ alcohol: 'never', sweet: 'most_days', smoking: 'smoke_no' })).toEqual(['cue_snack']);
    expect(cuesFor({ fibre: 'never', smoking: 'smoke_sometimes' })).toEqual(['cue_breakfast', 'cue_crave_smoke']);
    expect(cuesFor(undefined)).toEqual([]);
  });
  it('habit options cannot see the answers: rankLevers takes none, and the pack keeps use_answers off', () => {
    expect(rankLevers.length).toBeLessThanOrEqual(3);
    expect(pack.rules.levers_config?.use_answers).toBe(false);
  });
  it('restore keeps only known questions and answers', () => {
    expect(cleanAnswers({ alcohol: 'rarely', weight: 90, fats: 'lots' })).toEqual({ alcohol: 'rarely' });
    expect(cleanAnswers('x')).toBeUndefined();
  });
});

describe('feedback link (pm 11.4, QA L1, L2)', () => {
  it('uses the address Justina gave', () => expect(pack.feedback_email).toBe('justina.aniulyte@gmail.com'));
  it('is a plain email with an empty template and no values', () => {
    const href = feedbackHref('hello@example.org', 'Feedback', 'Did this help?\n\n');
    expect(href.startsWith('mailto:hello@example.org?subject=Feedback&body=')).toBe(true);
    expect(pack.strings.feedback_template.en).not.toMatch(/\d|doctor/i);
  });
});
