// Whole-app test U2: a page left open while a release lands still asks for the old reader file,
// which the new release removed. Reloading picks up the new version. Done once a minute at most,
// and only when the person has typed nothing yet, so nothing is lost.
const RELOADED = 'reader-reload';
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
