import { useRef, useState } from 'preact/hooks';
import { useApp } from '../app';
import { pack, packSigned } from '../content';
import type { Lang, Mode } from '../content/types';
import { backupFileName, makeBackup, parseBackup } from '../lib/backup';
import { downloadFile } from '../lib/download';
import { emptyPlan } from '../lib/model';
import * as store from '../lib/store';

export function More() {
  const { t, lang, mode, settings, updateSettings, go, saved, refreshSaved, plan, reloadPlan } = useApp();
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const keeping = settings.storageConsent === 'keep';

  const saveBackup = () => {
    if (saved.length === 0) { setMsg(t('backup_nothing')); return; }
    downloadFile(backupFileName(), 'application/json', JSON.stringify(makeBackup(settings, saved, new Date(), plan), null, 2));
    setMsg(t('backup_saved'));
  };

  const restore = async (file: File | undefined) => {
    if (!file) return;
    const r = parseBackup(await file.text());
    if (fileRef.current) fileRef.current.value = '';
    if (!r.ok) { setMsg(t(r.error === 'newer' ? 'restore_newer' : 'restore_error')); return; }
    await store.savePanels(r.panels);
    if (r.plan && !plan.habits.length && !plan.retestDate) await store.savePlan(r.plan);
    await updateSettings({ ...r.settings, storageConsent: 'keep', consentAt: new Date().toISOString() });
    void store.requestPersist();
    await refreshSaved();
    await reloadPlan();
    setMsg(t('restore_done', { count: r.panels.length }));
  };

  const turnOff = async () => {
    await store.clearPanels();
    await store.savePlan(emptyPlan);
    await reloadPlan();
    await updateSettings({ storageConsent: 'none', consentAt: new Date().toISOString() });
    await refreshSaved();
  };

  const deleteAll = async () => {
    await store.deleteEverything();
    try { sessionStorage.setItem('deleted', '1'); } catch { /* unavailable */ }
    location.replace(location.pathname);
  };

  return (
    <>
      <h1 tabIndex={-1}>{t('settings_title')}</h1>

      <section class="section" aria-labelledby="lang-h">
        <h2 id="lang-h">{t('language')}</h2>
        <div class="seg" role="group" aria-labelledby="lang-h">
          {(['lt', 'en'] as Lang[]).map((l) => (
            <button key={l} lang={l} aria-pressed={lang === l} onClick={() => updateSettings({ language: l })}>
              {l === 'lt' ? 'Lietuvių' : 'English'}
            </button>
          ))}
        </div>
      </section>

      <section class="section" aria-labelledby="size-h">
        <h2 id="size-h">{t('text_size')}</h2>
        <div class="seg" role="group" aria-labelledby="size-h">
          {([1, 2, 3] as const).map((s) => (
            <button key={s} aria-pressed={settings.textSize === s} onClick={() => updateSettings({ textSize: s })}>
              {t(`text_size_${s}`)}
            </button>
          ))}
        </div>
      </section>

      <section class="section" aria-labelledby="mode-h">
        <h2 id="mode-h">{t('mode_label')}</h2>
        <div class="seg" role="group" aria-labelledby="mode-h">
          {(['self', 'helper'] as Mode[]).map((m) => (
            <button key={m} aria-pressed={mode === m} onClick={() => updateSettings({ mode: m })}>
              {t(m === 'self' ? 'mode_self' : 'mode_helper')}
            </button>
          ))}
        </div>
      </section>

      <section class="section" aria-labelledby="store-h">
        <h2 id="store-h">{t('storage_label')}</h2>
        <p>{t(keeping ? 'storage_on' : 'storage_off')}</p>
        {keeping ? (
          <button class="btn ghost" onClick={turnOff}>{t('storage_turn_off')}</button>
        ) : (
          <button class="btn ghost" onClick={() => { updateSettings({ storageConsent: 'keep', consentAt: new Date().toISOString() }); void store.requestPersist(); }}>
            {t('storage_turn_on')}
          </button>
        )}
      </section>

      <section class="section" aria-labelledby="backup-h">
        <h2 id="backup-h">{t('backup_title')}</h2>
        <p class="small">{t('backup_body')}</p>
        <button class="btn ghost" onClick={saveBackup}>{t('backup_save')}</button>
        <p class="small">{t('restore_keeps')}</p>
        <button class="btn ghost" onClick={() => fileRef.current?.click()}>{t('backup_restore')}</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          class="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => restore((e.target as HTMLInputElement).files?.[0])}
        />
        {msg && <p class="notice" role="status">{msg}</p>}
      </section>

      <section class="section">
        <button class="linkbtn" onClick={() => go('share')}>{t('share_link')}</button>
        <button class="linkbtn" onClick={() => go('sources')}>{t('sources')}</button>
        <button class="linkbtn" onClick={() => go('about')}>{t('about_link')}</button>
      </section>

      <section class="section">
        {!confirmDelete ? (
          <button class="linkbtn danger" onClick={() => setConfirmDelete(true)}>{t('delete_all')}</button>
        ) : (
          <div class="confirm-del" role="group" aria-label={t('delete_all')}>
            <p>{t('delete_confirm')}</p>
            <button class="btn danger" onClick={deleteAll}>{t('delete_yes')}</button>
            <button class="btn ghost" onClick={() => setConfirmDelete(false)}>{t('delete_keep')}</button>
          </div>
        )}
      </section>

      <p class="small">
        {t('content_version', { version: pack.manifest.version })}
        {!packSigned && ` (${t('content_unchecked')})`}
      </p>
    </>
  );
}
