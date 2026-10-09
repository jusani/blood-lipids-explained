import { useEffect, useRef } from 'preact/hooks';
import { useApp } from '../app';
import { markerById, markers } from '../content';
import type { MarkerId } from '../content/types';

// Lab-sheet help: sheet layouts differ by lab, so instead of a drawing this lists the names and
// abbreviations labs print for each value, in LT and EN (Justina, 2026-10-09). Naming help only.
export function LabGuide({ marker, onClose }: { marker: MarkerId | null; onClose: () => void }) {
  const { t, lang } = useApp();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (marker && !d.open) d.showModal();
    if (!marker && d.open) d.close();
  }, [marker]);

  // The value asked about first, then the others.
  const list = marker ? [markerById[marker], ...markers.filter((m) => m.id !== marker)] : markers;
  return (
    <dialog class="sheet" ref={ref} onClose={onClose} aria-labelledby="guide-h"
      onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <div class="grab" aria-hidden="true" />
      <div class="sheet-body">
        <h2 id="guide-h" tabIndex={-1} autofocus>{t('guide_title')}</h2>
        <p>{t('guide_names_intro')}</p>
        <dl class="names">
          {list.map((m) => (
            <div class={m.id === marker ? 'on' : ''} key={m.id}>
              <dt>{m.names[lang]}</dt>
              <dd>
                <span class="small">{t('guide_also_printed')}: </span>
                {[...new Set([m.lab_names.lt, m.lab_names.en, ...m.aliases])].filter((n) => n !== m.names[lang])
                  .map((n, i) => <>{i > 0 && ' · '}<span class="nowrap">{n}</span></>)}
              </dd>
            </div>
          ))}
        </dl>
        <p class="small">{t('guide_ranges_note')}</p>
        <button class="btn" onClick={onClose}>{t('guide_close')}</button>
      </div>
    </dialog>
  );
}
