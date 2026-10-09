import { useState } from 'preact/hooks';
import { useApp } from '../app';
import { backupFileName, makeBackup } from '../lib/backup';
import { downloadFile } from '../lib/download';
import { formatDate } from '../lib/i18n';
import { retestIcs } from '../lib/ics';
import { addDays, addMonths, isoDay } from '../lib/model';
import { pack } from '../content';

// S13 re-test date. The person picks the date; the app suggests no interval because no
// source in the approved content pack sets one (coordinator, 2026-10-08).
export function Retest() {
  const { t, lang, plan, setPlan, settings, saved } = useApp();
  const today = isoDay();
  const [date, setDate] = useState(plan.retestDate ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && date > today;

  const save = async () => {
    if (!valid) return;
    await setPlan({ ...plan, retestDate: date });
    setMsg(t('retest_line', { date: formatDate(date, lang) }));
  };
  const calendar = () => {
    if (!valid) return;
    downloadFile('re-test.ics', 'text/calendar', retestIcs(date, t('ics_summary'), t('ics_description'), `retest-${date}@lipidai`));
  };
  const backup = () => downloadFile(backupFileName(), 'application/json', JSON.stringify(makeBackup(settings, saved, new Date(), { ...plan, retestDate: valid ? date : plan.retestDate }), null, 2));

  return (
    <>
      <h1 tabIndex={-1}>{t('retest_title')}</h1>
      <p>{t('retest_body')}</p>
      {pack.rules.retest?.text && <p class="small">{t(pack.rules.retest.text)}</p>}
      <div class="chips">
        {/* Neutral quick picks, not a suggested interval (QA H2); the pack's design default is not shown. */}
        {[1, 2, 3].map((n) => {
          const d = addMonths(today, n);
          return <button key={n} class="pill" aria-pressed={date === d} onClick={() => setDate(d)}>{n === 1 ? t('retest_in_month_1') : t('retest_in_months', { n })}</button>;
        })}
      </div>
      <div class="field">
        <label for="retest-date"><span class="lt">{t('retest_date_label')}</span></label>
        <input id="retest-date" class="dateinput" type="date" min={addDays(today, 1)} value={date} onInput={(e) => setDate((e.target as HTMLInputElement).value)} />
        {valid && <p class="small">{formatDate(date, lang)}</p>}
      </div>
      <button class="btn" disabled={!valid} onClick={save}>{t('retest_save')}</button>
      {msg && <p class="notice" role="status">{msg}</p>}
      <button class="btn ghost" disabled={!valid} onClick={calendar}>{t('retest_calendar')}</button>
      <p class="small">{t('retest_calendar_note')}</p>
      {saved.length > 0 && (
        <section class="section">
          <p class="small">{t('retest_backup_note')}</p>
          <button class="btn ghost" onClick={backup}>{t('retest_backup_btn')}</button>
        </section>
      )}
    </>
  );
}
