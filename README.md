# Blood Lipids Explained: pilot web app

Offline web app (PWA). Health data stays in the browser on the person's phone; after loading, the app makes no network requests. Built from the project's product, design, architecture and QA notes (kept in the project, not in this repository).

## What is built (7 Oct 2026)

- Welcome (also the landing screen for a shared link), "Whose results?" with helper mode
- Entry with LT lab names, comma or dot, per-field unit prompt (missing decimal first, then the other unit, nothing pre-selected, panel unit never changes from one field, TG 10–100 always asks), cross-field check, lab-sheet guide (generic drawing)
- Four optional safety questions, confirm screen with "converted from … mg/dL" and calculated non-HDL / atherogenic index
- Consent before the first save, IndexedDB storage, persistent-storage request, "Delete all my data"
- Backup file save and restore (re-validated on restore), saving on/off
- Sources screen, About with the intended-purpose sentence, trust line, Share sheet (link + text only, `?lang` only)
- LT and EN, three text sizes, dark mode, strict CSP, self-hosted fonts, service worker for offline use
- Preview banner while the content pack is not signed

## Rules engine (8 Oct 2026)

`src/lib/rules.ts` is one pure function, `runRules(panel)`: comparisons only, no score or risk. It reads the zones and flags from the content pack.

- Flags are evaluated in pack order (`flag(...)`, `any_flag_of(...)` work). A value typed in mg/dL fires a flag if either the mg/dL or the converted mmol/L cut-off is crossed, and its bar zone is the more serious of the two readings (`units.mg_dl_rule`). The two triglyceride cards never show together.
- Results: doctor cards first (max 2, rest listed), then the headline, the "not a medical advisor" statement, LDL and non-HDL on guideline range bars with the guideline text, other numbers as rows. No status labels or verdicts (`status_labels: false`, permanent).
- Marker detail: bar, the guideline's own zone names, guideline text, quoted source lines with links.
- Doctor summary: own language, thresholds and questions only (max 5), print or save as PDF, version in the footer.
- Known heart disease, stroke, diabetes or kidney disease: LDL and non-HDL show "your doctor sets your target" instead of a bar. Pregnancy hides the habit plan.
- `note_doctor_sets_target_lower_goals` is not wired in (waits for the clinician). The test-to-test variation line stays hidden.
- Values show with the decimals typed (at least 1) and mg/dL conversions with 2, so a value just under a guideline level never displays as that level (QA R1).
- Tests: `tests/rules.test.ts` covers QA golden cases G1–G14, G18, G21, G22, the mg/dL rule and QA R1; `tests/habits.test.ts` covers habits, the calendar file, backup and before/after.

## Habits (8 Oct 2026)

- If-then builder (up to 3 habits), Today check-ins (Done / Not today), progress (days done, 4-week dots, this week), re-test date the person picks with a calendar file (.ics) and a backup prompt, before and after (both numbers and the difference only).
- Offered only when a value is outside its guideline range, for the person's own results, never in pregnancy. Saving a habit keeps data on the phone (stated next to the button). Habits travel in the backup file.
- **Habit options** come from `levers` in the content pack, ranked by `rankLevers` (out-of-range marker order, then `rank_last`, then effect size, then effort; never supplements; at most 5). `show_only_when_out_of_range` gates both options and the plan offer (HDL alone brings up neither). Each option shows its source quotes. Re-test: the person picks the date; quick picks are 1, 2 and 3 months, never a suggested interval.
- People can also write their own habit instead of choosing an option.

## Habit questionnaire and feedback (9 Oct 2026)

- Six optional questions (fats, fibre, sugar, alcohol, activity, smoking), one per screen, each skippable, with "Previous question". Answers only add suggested moments to the if-then builder (`src/lib/questionnaire.ts`); habit options never see them (`levers_config.use_answers: false`). Weight and waist are left out (nothing would use them). "Good to know" facts are left out until the evidence pack has them.
- Feedback: a plain email link on About with an empty two-question template (no values, no doctor question, QA L1). Address: `feedback_email` in `app-text.json` (Justina's, given 9 Oct 2026); null hides the link.

- Lab-sheet help: "Other names for this" lists the names and abbreviations labs print for each value in LT and EN (sheet layouts differ by lab, so no drawing or photos).
- Hosting: all paths are relative, so the build works unchanged at `jusani.github.io/blood-lipids-explained/`.

## Not built yet

- "Good to know" lines in the questionnaire (need sourced fact strings).
- Accounts: `features.accounts: false` until a legal entity exists.

## Content

The app reads one pack, `src/content/pack.json`, generated by `npm run import-pack` from two inputs:

- the evidence pack (owned by the evidence thread; never edited here). By default the import takes the **newest approved** `../evidence/content-pack-*.yaml` (one with `approved_by` and `released` set). A draft can still be loaded by path (`npm run import-pack -- <draft.yaml>`); the app then shows the test-version banner on every screen. Never ship a build made that way;
- `src/content/app-text.json` (owned by the app): screen text in LT and EN, lab names, input sanity ranges, lint word lists. No medical claims.

The import fails if a claim, flag or zone points at a missing source or string, or a quote lacks its number. Run it again whenever the evidence pack changes, then `npm test`.

Currently loaded: **2026.3** (approved by Justina, 9 Oct 2026; supersedes 2026.1). It carries Lithuanian explanations (not yet reviewed by a native writer) and the sourced habit options. Every results screen, marker detail and doctor summary shows "Content version 2026.3".

## Run

```
npm install
npm run dev        # local development
npm test           # unit tests: units, backup/store, string completeness, stay-educational lint
npm run e2e        # phone-sized browser tests against the production build
npm run build      # static site in dist/, deployable to any static host from any path
```

`dist/` in this folder is a ready-built copy.

## Publishing

The site is served by GitHub Pages from the `gh-pages` branch at https://jusani.github.io/blood-lipids-explained/. To publish an update: `npm ci && npm test && npm run build`, then put the contents of `dist/` on `gh-pages`.

Content: this repository carries approved content packs only, in `content/`. `npm run import-pack` reads the newest approved pack there (or the project's evidence folder when it sits next to the app).
