import { useApp } from '../app';
import { pack } from '../content';
import { feedbackHref } from '../screens/About';

// Photo reading, testing mode (Justina, 2026-10-12): one optional question after the numbers were
// checked, shown once per reading. An answer opens a pre-filled email with that answer only: no
// numbers, nothing else, nothing sent by the app itself.
const ANSWERS = ['read_feedback_all', 'read_feedback_fixed', 'read_feedback_failed'] as const;

export function ReadFeedback() {
  const { t, draft, setDraft } = useApp();
  if (!draft.sheetUsed || draft.sheetFeedbackDone || !pack.feedback_email) return null;
  const done = () => setDraft((d) => ({ ...d, sheetFeedbackDone: true }));
  return (
    <section class="card readfeedback" aria-labelledby="rf-h">
      <h2 id="rf-h" class="h3">{t('read_feedback_q')}</h2>
      <div class="opts">
        {ANSWERS.map((k) => (
          <a key={k} class="pill" onClick={done}
            href={feedbackHref(pack.feedback_email!, t('read_feedback_subject'), t('read_feedback_body', { answer: t(k) }))}>
            {t(k)}
          </a>
        ))}
      </div>
      <button class="linkbtn" onClick={done}>{t('read_feedback_skip')}</button>
    </section>
  );
}
