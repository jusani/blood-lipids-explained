import { useApp } from '../app';
import { pack } from '../content';
import type { Lesson } from '../content/types';
import { SourceQuotes } from '../components/SourceQuotes';
import { PlaqueDrawings } from '../components/PlaqueDrawings';

// 60-second lessons (content 2026.5, v2-scope §2). General to everyone: no value, range bar or
// "your result" ever appears here (QA L2), and the plaque drawings appear only in lesson 5.

export const lessonsFor = (markerId: string): Lesson[] => pack.lessons.filter((l) => l.linked_from.includes(markerId));

/** Links to lessons: the same for everyone, whatever the value (QA L3). */
export function LessonLinks({ lessons, heading = true }: { lessons: Lesson[]; heading?: boolean }) {
  const { t, go, setLesson } = useApp();
  if (!lessons.length || !pack.lessons_config) return null;
  return (
    <section class="stack lessons" aria-label={t(pack.lessons_config.heading)}>
      {heading && <h2>{t(pack.lessons_config.heading)}</h2>}
      <ul class="plainlist">
        {lessons.map((l) => (
          <li key={l.id}><button class="linkbtn" onClick={() => { setLesson(l.id); go('lesson'); }}>{t(l.title)}</button></li>
        ))}
      </ul>
    </section>
  );
}

export function LessonList() {
  const { t } = useApp();
  const cfg = pack.lessons_config;
  return (
    <>
      <h1 tabIndex={-1}>{cfg ? t(cfg.heading) : ''}</h1>
      {cfg && <p class="small">{t(cfg.general_note)}</p>}
      <LessonLinks lessons={pack.lessons} heading={false} />
    </>
  );
}

export function LessonScreen() {
  const { t, lesson } = useApp();
  const l = pack.lessons.find((x) => x.id === lesson);
  if (!l || !pack.lessons_config) return <LessonList />;
  return (
    <article class="lesson">
      <h1 tabIndex={-1}>{t(l.title)}</h1>
      <p class="small">{t(pack.lessons_config.general_note)}</p>
      {l.id === 'lesson_plaque' && <PlaqueDrawings />}
      <p>{t(l.body)}</p>
      <section class="stack" aria-labelledby="lsrc-h">
        <h2 id="lsrc-h">{t('detail_sources')}</h2>
        <SourceQuotes claimIds={l.claims} />
      </section>
    </article>
  );
}
