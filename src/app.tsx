import { createContext } from 'preact';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { packSigned } from './content';
import type { Lang, Mode } from './content/types';
import { emptyDraft, type Draft } from './lib/entry';
import { detectLanguage, translate, type Vars } from './lib/i18n';
import { defaultSettings, emptyPlan, type Panel, type Plan, type Settings } from './lib/model';
import * as store from './lib/store';
import { TopBar } from './components/TopBar';
import { Welcome } from './screens/Welcome';
import { Whose } from './screens/Whose';
import { Entry } from './screens/Entry';
import { SafetyQuestions } from './screens/Safety';
import { Confirm } from './screens/Confirm';
import { Consent } from './screens/Consent';
import { Results } from './screens/Results';
import { More } from './screens/More';
import { About } from './screens/About';
import { Sources } from './screens/Sources';
import { Share } from './screens/Share';
import { MarkerDetail } from './screens/MarkerDetail';
import { DoctorSummary } from './screens/DoctorSummary';
import type { ValueId } from './lib/rules';
import { Plan as PlanScreen } from './screens/Plan';
import { Retest } from './screens/Retest';
import { Today } from './screens/Today';
import { Progress } from './screens/Progress';
import { HabitQuestions } from './screens/HabitQuestions';

export type Screen =
  | 'welcome' | 'whose' | 'entry' | 'safety' | 'confirm' | 'consent' | 'results'
  | 'more' | 'about' | 'sources' | 'share' | 'detail' | 'summary' | 'plan' | 'retest' | 'today' | 'progress' | 'habitq';

export interface AppCtx {
  lang: Lang;
  mode: Mode;
  settings: Settings;
  t: (key: string, vars?: Vars) => string;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  screen: Screen;
  go: (s: Screen) => void;
  back: () => void;
  backTo: (s: Screen) => void;
  draft: Draft;
  setDraft: (d: Draft | ((d: Draft) => Draft)) => void;
  resetDraft: () => void;
  /** The panel shown on Results: saved, or held in memory only. */
  current: Panel | null;
  setCurrent: (p: Panel | null) => void;
  saved: Panel[];
  refreshSaved: () => Promise<void>;
  isSaved: (id: string) => boolean;
  /** Save a panel and record consent to keep data on this phone. */
  keepPanel: (p: Panel) => Promise<void>;
  /** Which value the marker detail screen shows. */
  detail: ValueId | null;
  setDetail: (id: ValueId | null) => void;
  /** Habits, check-ins and re-test date. Saved only while the person keeps data on this phone. */
  plan: Plan;
  setPlan: (p: Plan) => Promise<void>;
  reloadPlan: () => Promise<void>;
  flash: string | null;
  setFlash: (s: string | null) => void;
}

const Ctx = createContext<AppCtx>(null as unknown as AppCtx);
export const useApp = () => useContext(Ctx);

const screens: Record<Screen, () => preact.JSX.Element> = {
  welcome: Welcome, whose: Whose, entry: Entry, safety: SafetyQuestions, confirm: Confirm, consent: Consent,
  results: Results, more: More, about: About, sources: Sources, share: Share,
  detail: MarkerDetail, summary: DoctorSummary, plan: PlanScreen, retest: Retest, today: Today, progress: Progress, habitq: HabitQuestions,
};

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [stack, setStack] = useState<Screen[]>(['welcome']);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [current, setCurrent] = useState<Panel | null>(null);
  const [saved, setSaved] = useState<Panel[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [detail, setDetail] = useState<ValueId | null>(null);
  const [plan, setPlanState] = useState<Plan>(emptyPlan);
  const settingsRef = useRef<Settings>(defaultSettings);

  // Load settings and saved results once.
  useEffect(() => {
    (async () => {
      const s = await store.loadSettings();
      const lang = detectLanguage(location.search, s.language, navigator.language);
      const merged = { ...s, language: lang };
      settingsRef.current = merged;
      setSettings(merged);
      setSaved(await store.listPanels());
      setPlanState(await store.loadPlan());
      try {
        if (sessionStorage.getItem('deleted') === '1') {
          sessionStorage.removeItem('deleted');
          setFlash('deleted_done');
        }
      } catch { /* storage unavailable */ }
    })();
    history.replaceState({ i: 0 }, '');
    const onPop = (e: PopStateEvent) => {
      const i = typeof e.state?.i === 'number' ? e.state.i : 0;
      setStack((st) => st.slice(0, Math.max(1, Math.min(st.length, i + 1))));
    };
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  const lang: Lang = settings?.language ?? 'lt';
  const mode: Mode = settings?.mode ?? 'self';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dataset.size = String(settings?.textSize ?? 1);
    document.title = translate(lang, mode, 'app_name');
  }, [lang, mode, settings?.textSize]);

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    try { await store.saveSettings(next); } catch { /* storage unavailable: keep in memory */ }
  }, []);

  const setPlan = useCallback(async (p: Plan) => {
    setPlanState(p);
    if (settingsRef.current.storageConsent === 'keep') {
      try { await store.savePlan(p); } catch { /* storage unavailable: keep in memory */ }
    }
  }, []);
  const reloadPlan = useCallback(async () => setPlanState(await store.loadPlan()), []);

  const refreshSaved = useCallback(async () => setSaved(await store.listPanels()), []);

  const stackRef = useRef<Screen[]>(stack);
  stackRef.current = stack;
  const go = useCallback((s: Screen) => {
    history.pushState({ i: stackRef.current.length }, '');
    setStack((st) => [...st, s]);
  }, []);
  const back = useCallback(() => history.back(), []);
  /** Go back to the last time `s` was shown (history stays in step); start over if it never was. */
  const backTo = useCallback((s: Screen) => {
    const st = stackRef.current;
    const idx = st.lastIndexOf(s);
    if (idx < 0) {
      if (st.length > 1) history.go(-(st.length - 1));
      setStack([s]);
      return;
    }
    const delta = st.length - 1 - idx;
    if (delta > 0) history.go(-delta);
  }, []);

  const keepPanel = useCallback(async (p: Panel) => {
    await store.savePanel(p);
    if (settingsRef.current.storageConsent !== 'keep') {
      await updateSettings({ storageConsent: 'keep', consentAt: new Date().toISOString() });
    }
    void store.requestPersist();
    await refreshSaved();
  }, [updateSettings, refreshSaved]);

  const screen = stack[stack.length - 1];

  // Move focus to the new screen's heading and to the top of the page.
  useEffect(() => {
    scrollTo(0, 0);
    const h = document.querySelector<HTMLElement>('main h1');
    h?.focus({ preventScroll: true });
  }, [screen, stack.length]);

  const ctx = useMemo<AppCtx | null>(() => {
    if (!settings) return null;
    return {
      lang, mode, settings,
      t: (key, vars) => translate(lang, mode, key, vars),
      updateSettings, screen, go, back, backTo,
      draft, setDraft, resetDraft: () => setDraft(emptyDraft()),
      current, setCurrent, saved, refreshSaved,
      isSaved: (id) => saved.some((p) => p.id === id),
      keepPanel, flash, setFlash, detail, setDetail, plan, setPlan, reloadPlan,
    };
  }, [settings, lang, mode, screen, draft, current, saved, flash, detail, plan, setPlan, reloadPlan, updateSettings, go, back, backTo, refreshSaved, keepPanel]);

  if (!ctx) return null;
  const View = screens[screen];
  return (
    <Ctx.Provider value={ctx}>
      <div class={`shell s-${screen}`}>
        <TopBar canGoBack={stack.length > 1} />
        {!packSigned && (
          <p class="banner noprint" role="note">{ctx.t('preview_banner')}</p>
        )}
        <main key={`${screen}-${stack.length}`}>
          <View />
        </main>
      </div>
    </Ctx.Provider>
  );
}
