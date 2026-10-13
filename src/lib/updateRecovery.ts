// Whole-app test U2: a page left open while a release lands still asks for the old reader file,
// which the new release removed. Reloading picks up the new version. Done once a minute at most,
// and only when nothing held in memory would be lost (QA pass 14, U2-a).
import { emptySafety, type Panel, type Plan, type Settings } from './model';
import { todayIso, type Draft } from './entry';

const RELOADED = 'reader-reload';

/**
 * True when a reload loses nothing: no entry typed or changed, results either saved or absent,
 * and the plan either saved (data kept on this device) or empty.
 */
export function nothingToLose(d: Draft, current: Panel | null, isSaved: (id: string) => boolean, settings: Settings, plan: Plan, today = todayIso()): boolean {
  const draftUntouched = !d.helperName.trim()
    && Object.values(d.fields).every((f) => !f.text.trim())
    && d.testDate === today && !d.dateUnknown
    && (Object.keys(emptySafety) as (keyof typeof emptySafety)[]).every((k) => d.safety[k] === emptySafety[k]);
  const resultsSafe = current === null || isSaved(current.id);
  const planSafe = settings.storageConsent === 'keep' || (plan.habits.length === 0 && plan.checkins.length === 0 && !plan.retestDate);
  return draftUntouched && resultsSafe && planSafe;
}
const REOPEN = 'reopen-entry';

/** The browser could not load a code file (Chrome, Firefox and Safari messages). */
export const isChunkLoadError = (e: unknown) =>
  /dynamically imported module|Importing a module script failed/i.test(String((e as Error)?.message ?? e));

export function reloadForUpdate(now = Date.now()): boolean {
  try {
    if (now - Number(sessionStorage.getItem(RELOADED) ?? 0) < 60_000) return false;
    sessionStorage.setItem(RELOADED, String(now));
    sessionStorage.setItem(REOPEN, '1');
  } catch {
    return false;
  }
  location.reload();
  return true;
}

/** After such a reload, start on the entry screen again. */
export function takeReopenEntry(): boolean {
  try {
    if (sessionStorage.getItem(REOPEN) !== '1') return false;
    sessionStorage.removeItem(REOPEN);
    return true;
  } catch {
    return false;
  }
}
