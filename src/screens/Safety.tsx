import { useApp } from '../app';
import type { Safety } from '../lib/model';

type Q = { key: keyof Safety; text: string; options: { value: string; label: string }[] };

export function SafetyQuestions() {
  const { t, draft, setDraft, go } = useApp();
  const yes = { value: 'yes', label: 'ans_yes' }, no = { value: 'no', label: 'ans_no' };
  const questions: Q[] = [
    { key: 'cholMedicine', text: 'q_med', options: [yes, no, { value: 'not_sure', label: 'ans_not_sure' }] },
    { key: 'familyEarlyCHD', text: 'q_family', options: [yes, no, { value: 'dont_know', label: 'ans_dont_know' }] },
    { key: 'knownCvdDiabetesCkd', text: 'q_known', options: [yes, no, { value: 'not_sure', label: 'ans_not_sure' }] },
    { key: 'pregnant', text: 'q_pregnant', options: [yes, no] },
  ];
  const set = (key: keyof Safety, value: string) =>
    setDraft((d) => ({ ...d, safety: { ...d.safety, [key]: value } }));

  return (
    <>
      <h1 tabIndex={-1}>{t('safety_title')}</h1>
      <p class="sub">{t('safety_sub')}</p>
      {questions.map((q) => (
        <fieldset class="card" key={q.key}>
          <legend>{t(q.text)}</legend>
          <div class="radios">
            {q.options.map((o) => (
              <label class="radio" key={o.value}>
                <input
                  type="radio"
                  name={q.key}
                  value={o.value}
                  checked={draft.safety[q.key] === o.value}
                  onChange={() => set(q.key, o.value)}
                />
                <span>{t(o.label)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <button class="btn" onClick={() => go('confirm')}>{t('continue')}</button>
      <button class="btn ghost" onClick={() => go('confirm')}>{t('skip_these')}</button>
    </>
  );
}
