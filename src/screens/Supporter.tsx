import { useEffect, useMemo, useState } from 'preact/hooks';
import { useApp } from '../app';
import type { Lang } from '../content/types';
import { formatDate } from '../lib/i18n';
import { noteHabits, supporterNote, supporterOffered } from '../lib/supporterNote';
import { shareUrl } from './Share';

// Supporter mode (phase-v2/supporter-mode-spec.md): the person picks what goes in, reads and may
// change the note, then sends it themselves. No network request, nothing stored, never lab numbers.
export function Supporter() {
  const { t, lang, mode, plan, back } = useApp();
  const habits = useMemo(() => noteHabits(plan), [plan]);
  const [msgLang, setMsgLang] = useState<Lang>(lang);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(habits.map((h) => h.id)));
  const [withRetest, setWithRetest] = useState(false);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const canShare = typeof navigator.share === 'function';

  // Choices rewrite the note; the person can then change the words in the box.
  useEffect(() => {
    setStatus(null);
    setText(supporterNote({
      habits: habits.filter((h) => picked.has(h.id)).map(({ cue, action, week, total }) => ({ cue, action, week, total })),
      retestDate: withRetest ? plan.retestDate : null,
      link: shareUrl(msgLang),
    }, msgLang));
  }, [habits, picked, withRetest, msgLang, plan.retestDate]);

  if (!supporterOffered(mode, plan)) {
    return <button class="btn" onClick={back}>{t('back')}</button>;
  }

  const toggle = (id: string) => setPicked((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const share = async () => {
    try {
      await navigator.share({ text });
    } catch { /* cancelled */ }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(t('copied'));
    } catch {
      setStatus(t('copy_failed'));
    }
  };

  return (
    <>
      <h1 tabIndex={-1}>{t('supporter_title')}</h1>
      <p>{t('supporter_intro')}</p>
      <fieldset class="stack">
        <legend>{t('supporter_include')}</legend>
        {habits.map((h) => (
          <label key={h.id} class="check">
            <input type="checkbox" checked={picked.has(h.id)} onChange={() => toggle(h.id)} />
            <span>{t('habit_sentence', { cue: h.cue, action: h.action })}</span>
          </label>
        ))}
        {plan.retestDate && (
          <label class="check">
            <input type="checkbox" checked={withRetest} onChange={() => setWithRetest((v) => !v)} />
            <span>{t('supporter_include_retest', { date: formatDate(plan.retestDate, lang) })}</span>
          </label>
        )}
      </fieldset>
      <div class="stack">
        <span class="small" id="note-lang">{t('share_lang')}</span>
        <div class="seg" role="group" aria-labelledby="note-lang">
          {(['lt', 'en'] as Lang[]).map((l) => (
            <button key={l} lang={l} aria-pressed={msgLang === l} onClick={() => setMsgLang(l)}>
              {l === 'lt' ? 'Lietuvių' : 'English'}
            </button>
          ))}
        </div>
      </div>
      <label class="stack">
        <span class="small">{t('supporter_message_label')}</span>
        <textarea class="notebox" lang={msgLang} rows={10} value={text} onInput={(e) => setText(e.currentTarget.value)} />
      </label>
      <p><b>{t('share_never')}</b></p>
      <p class="small">{t('supporter_chat_note')}</p>
      {canShare && <button class="btn" onClick={share}>{t('share_btn')}</button>}
      <button class={canShare ? 'btn ghost' : 'btn'} onClick={copy}>{t('supporter_copy')}</button>
      {status && <p class="small" role="status">{status}</p>}
    </>
  );
}
