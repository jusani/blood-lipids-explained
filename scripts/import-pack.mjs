// Builds src/content/pack.json, the one content pack the app reads (architect.md §4).
//
// Two inputs:
//   1. The evidence pack (YAML), owned by the evidence thread: manifest, units, sources,
//      guideline ranges, doctor flags, claims with quotes, and the strings that carry claims.
//      Default: the newest APPROVED pack in ../evidence/ (i.e. /mnt/project-files/evidence/),
//      so a build never ships an unapproved version by accident. Pass a path to try a draft;
//      the app then shows its "test version" banner on every screen.
//   2. src/content/app-text.json, owned by the app: screen text (LT + EN), input sanity
//      ranges, lab names, lint word lists. It carries no medical claims.
//
// Usage: node scripts/import-pack.mjs [path/to/content-pack.yaml]
// Fails (exit 1) when the evidence pack doesn't fit the app's format.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// The project's evidence folder when it is next to the app; the approved packs copied into
// content/ otherwise (the public repository carries approved packs only, never drafts).
const evidenceDir = process.env.EVIDENCE_DIR
  ?? (existsSync(resolve(root, '../evidence')) ? resolve(root, '../evidence') : resolve(root, 'content'));
const evidencePath = resolve(process.argv[2] ?? newestApproved(evidenceDir));
const ev = YAML.parse(readFileSync(evidencePath, 'utf8'));
const app = JSON.parse(readFileSync(resolve(root, 'src/content/app-text.json'), 'utf8'));

const errors = [];
const warnings = [];
const need = (cond, msg) => { if (!cond) errors.push(msg); };

need(ev?.manifest?.version, 'manifest.version missing');
need(Array.isArray(ev?.sources), 'sources missing');
need(Array.isArray(ev?.markers), 'markers missing');
need(Array.isArray(ev?.flags), 'flags missing');
need(Array.isArray(ev?.claims), 'claims missing');
need(ev?.strings && typeof ev.strings === 'object', 'strings missing');
need(ev?.units?.chol_mg_dl_per_mmol > 0 && ev?.units?.tg_mg_dl_per_mmol > 0, 'units conversion factors missing');
if (errors.length) fail();

const sourceIds = new Set(ev.sources.map((s) => s.id));
const claimIds = new Set(ev.claims.map((c) => c.id));
const strings = ev.strings;

// Claims: sources exist, quotes carry their numbers, text strings exist.
const cited = new Set();
for (const c of ev.claims) {
  if (c.status === 'blocked_no_quote') continue;
  for (const s of c.sources ?? []) { need(sourceIds.has(s), `claim ${c.id}: unknown source ${s}`); cited.add(s); }
  need((c.quotes ?? []).length > 0, `claim ${c.id}: no quote`);
  for (const q of c.quotes ?? []) {
    need(sourceIds.has(q.source), `claim ${c.id}: quote from unknown source ${q.source}`);
    if (q.number_in_quote) need(String(q.quote).includes(String(q.number_in_quote)), `claim ${c.id}: "${q.number_in_quote}" not in its quote`);
  }
  // `text` is one string key or a list of them (draft 4 onwards).
  for (const key of [c.text ?? []].flat()) need(strings[key], `claim ${c.id}: string ${key} missing`);
}
// Flags and zones point at claims and strings that exist (architect §17.2: a flag always has a quote or cautious default).
for (const f of ev.flags) {
  need(claimIds.has(f.claim), `flag ${f.id}: claim ${f.claim} missing`);
  need(strings[f.card], `flag ${f.id}: card string ${f.card} missing`);
  if (f.time_frame) need(strings[f.time_frame], `flag ${f.id}: time frame ${f.time_frame} missing`);
}
for (const m of ev.markers) {
  for (const z of m.zones ?? []) {
    need(claimIds.has(z.claim), `marker ${m.id}: zone claim ${z.claim} missing`);
    need(strings[z.label], `marker ${m.id}: zone label ${z.label} missing`);
  }
  if (m.guideline_text) need(strings[m.guideline_text], `marker ${m.id}: ${m.guideline_text} missing`);
}

// Markers: the app's lab names and input heuristics, the evidence pack's factors and plausible ranges.
const evMarker = Object.fromEntries(ev.markers.map((m) => [m.id, m]));
const markers = app.markers.map((m) => {
  const e = evMarker[m.id];
  need(e, `marker ${m.id} missing from evidence pack`);
  return {
    ...m,
    mg_dl_factor: m.id === 'tg' ? ev.units.tg_mg_dl_per_mmol : ev.units.chol_mg_dl_per_mmol,
    plausible: e?.plausible ?? m.plausible,
  };
});

// Habit options (architect §4 levers; QA M2) and the re-test block, when the pack has them.
for (const l of ev.levers ?? []) {
  need(l.id && l.helps && typeof l.helps === 'object', `lever ${l.id}: helps missing`);
  need(['small', 'medium', 'large'].includes(l.effort), `lever ${l.id}: effort must be small, medium or large`);
  need(strings[l.title], `lever ${l.id}: title ${l.title} missing`);
  need(strings[l.text], `lever ${l.id}: text ${l.text} missing`);
  for (const c of [l.claim].flat()) need(claimIds.has(c), `lever ${l.id}: claim ${c} missing`);
  const never = ev.levers_config?.never_offer ?? [];
  need(!never.includes(l.id) && !(l.category && never.includes(l.category)), `lever ${l.id}: listed in never_offer, so it must not be a lever`);
}
if (ev.levers_config) {
  for (const k of ['heading', 'note_with_doctor_flag', 'note_on_medicine']) {
    if (ev.levers_config[k]) need(strings[ev.levers_config[k]], `levers_config.${k}: ${ev.levers_config[k]} missing`);
  }
  need(ev.levers_config.use_answers === false, 'levers_config.use_answers must be false (QA M2)');
}
if (ev.retest?.text) need(strings[ev.retest.text], `retest: ${ev.retest.text} missing`);

// Strings: app screen text plus evidence strings. A key in both is an error.
for (const k of Object.keys(strings)) need(!app.strings[k], `string ${k} is in both packs`);
const missingLt = Object.keys(strings).filter((k) => !strings[k].lt);
if (missingLt.length) warnings.push(`${missingLt.length} evidence strings have no LT text yet (native writer)`);

// Sources the content actually relies on (architect §15). Uncited ones are background only.
const sources = ev.sources.filter((s) => cited.has(s.id)).map((s) => ({
  id: s.id,
  citation: s.citation,
  correction_note: s.correction_note ?? null,
  type: s.type,
  doi: s.doi ?? null,
  open_link: s.open_link,
  full_text_free: !!s.full_text_free,
  summary: s.summary ?? null,
  checked: s.stored_copy?.retrieved ?? null,
}));
const uncited = ev.sources.filter((s) => !cited.has(s.id)).map((s) => s.id);
if (uncited.length) warnings.push(`not listed (cited by no claim): ${uncited.join(', ')}`);
const noSummary = sources.filter((s) => !s.summary).map((s) => s.id);
if (noSummary.length) warnings.push(`sources without a plain-language summary: ${noSummary.join(', ')}`);

if (errors.length) fail();

const pack = {
  manifest: {
    ...ev.manifest,
    placeholder: false,
    ui_languages: app.manifest.languages,
    lt_native_review: app.manifest.lt_native_review,
    imported_from: evidencePath.split('/').slice(-2).join('/'),
  },
  display: { ...app.display, ...ev.display },
  features: app.features,
  official_address: app.official_address,
  feedback_email: app.feedback_email ?? null,
  markers,
  calculated: app.calculated,
  // Display scale per bar: the evidence pack's where it gives one, the app's otherwise.
  bar_scale: { ...app.bar_scale, ...Object.fromEntries(ev.markers.filter((m) => m.bar_scale).map((m) => [m.id, m.bar_scale])) },
  source_types: app.source_types,
  sources,
  rules: {
    units: ev.units, markers: ev.markers, flags: ev.flags, flags_display: ev.flags_display, claims: ev.claims,
    levers: ev.levers ?? [], levers_config: ev.levers_config ?? null, retest: ev.retest ?? null,
  },
  lint: app.lint,
  strings: { ...app.strings, ...strings },
};

writeFileSync(resolve(root, 'src/content/pack.json'), JSON.stringify(pack, null, 2) + '\n');
console.log(`pack.json written from ${pack.manifest.imported_from} (version ${pack.manifest.version})`);
for (const w of warnings) console.log(`note: ${w}`);

function newestApproved(dir) {
  const candidates = readdirSync(dir)
    .filter((f) => /^content-pack-.*\.ya?ml$/.test(f))
    .map((f) => ({ f, m: YAML.parse(readFileSync(resolve(dir, f), 'utf8'))?.manifest }))
    .filter(({ m }) => m?.approved_by && m?.released)
    .sort((a, b) => String(b.m.version).localeCompare(String(a.m.version), 'en', { numeric: true }));
  if (!candidates.length) { console.error(`No approved content pack in ${dir}`); process.exit(1); }
  return resolve(dir, candidates[0].f);
}

function fail() {
  console.error('The evidence pack does not fit the app format:');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
