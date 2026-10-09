import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const SHOTS = process.env.SHOTS_DIR;
const shot = async (page: Page, name: string) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };

/** Fails the test if any request leaves the app's own origin (architect §16.3, QA privacy test). */
function watchNetwork(page: Page) {
  const outside: string[] = [];
  page.on('request', (r) => { if (!r.url().startsWith('http://localhost:4173/') && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) outside.push(r.url()); });
  return outside;
}

async function startEn(page: Page) {
  await page.goto('./?lang=en');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Understand your cholesterol results in plain words.');
}

async function enterExample(page: Page, values: Record<string, string>) {
  await page.getByRole('button', { name: 'Explain my results' }).click();
  await page.getByRole('button', { name: /My own results/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  for (const [label, v] of Object.entries(values)) await page.getByLabel(label).fill(v);
}

test('full flow: per-field unit prompt, safety questions, consent, saved after reload', async ({ page }) => {
  const outside = watchNetwork(page);
  await startEn(page);
  await shot(page, '01-welcome-en');
  await enterExample(page, { 'LDL cholesterol': '4,1', 'Total cholesterol': '6.3', 'HDL cholesterol': '1,3', Triglycerides: '194' });

  // TG 194 is held: decimal first, then mg/dL, nothing pre-selected; LDL keeps mmol/L.
  const ask = page.getByRole('group', { name: 'Triglycerides' });
  await expect(ask).toContainText('194 is unusual for Triglycerides in mmol/L.');
  await expect(ask).toContainText('Your other numbers look like mmol/L.');
  await expect(ask.getByRole('button')).toHaveText(['1.94 mmol/L', '194 mg/dL (2.19 mmol/L)', 'Neither, let me retype']);
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await shot(page, '02-unit-prompt-en');
  await ask.getByRole('button', { name: /194 mg\/dL/ }).click();
  await expect(page.getByText('Read as 4.1')).toBeVisible();
  await page.getByRole('button', { name: /Continue with/ }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A few quick questions');
  await page.getByRole('group', { name: /medicine to lower cholesterol/ }).getByLabel('No', { exact: true }).check();
  await page.getByRole('group', { name: /heart disease before 60/ }).getByLabel("Don't know").check();
  await shot(page, '03-safety-en');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByText('converted from 194 mg/dL')).toBeVisible();
  await expect(page.getByText('2.19')).toBeVisible();
  await expect(page.getByText('Non-HDL cholesterol')).toBeVisible();
  await shot(page, '04-confirm-en');
  await page.getByRole('button', { name: 'Show the explanation' }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Keep these results on this phone?');
  await page.getByRole('button', { name: 'Keep on this phone' }).click();
  await expect(page.getByText('Saved on this phone.')).toBeVisible();
  await expect(page.getByText('not reviewed by a doctor')).toBeVisible();
  // No doctor card; neutral headline; the statement shows; values on guideline range bars.
  await expect(page.getByText('Here is where the numbers sit against published guideline ranges.')).toBeVisible();
  await expect(page.getByText('This app is not a medical advisor.')).toBeVisible();
  await expect(page.locator('.dcard')).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'LDL cholesterol 4.1 on the guideline range bar' })).toBeVisible();
  await expect(page.getByText('Content version 2026.3')).toBeVisible();
  await shot(page, '05-results-en');

  await page.reload();
  await page.getByRole('button', { name: /Test of/ }).click();
  await expect(page.getByText('2.19 mmol/L (194 mg/dL)')).toBeVisible();
  expect(outside).toEqual([]);
});

test('TG 25 always asks, and keeping 25 mmol/L is offered', async ({ page }) => {
  await startEn(page);
  await enterExample(page, { Triglycerides: '25' });
  const ask = page.getByRole('group', { name: 'Triglycerides' });
  await expect(ask).toContainText('could be in mmol/L or in mg/dL');
  await ask.getByRole('button', { name: '25 mmol/L, as typed' }).click();
  await expect(page.getByRole('button', { name: 'Continue with Triglycerides' })).toBeEnabled();
});

test('values that do not fit together are held until confirmed', async ({ page }) => {
  await startEn(page);
  await enterExample(page, { 'LDL cholesterol': '6,5', 'Total cholesterol': '5,0' });
  await expect(page.getByText('Could two of them be swapped?')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await page.getByRole('button', { name: "They're right as typed" }).click();
  await expect(page.getByRole('button', { name: /Continue with/ })).toBeEnabled();
});

test('helper mode saves nothing unless chosen', async ({ page }) => {
  await startEn(page);
  await page.getByRole('button', { name: 'Explain my results' }).click();
  await page.getByRole('button', { name: /Someone I'm helping/ }).click();
  await page.getByLabel('Their first name (optional)').fill('Aldona');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('LDL cholesterol').fill('4.1');
  await page.getByRole('button', { name: /Continue with/ }).click();
  await expect(page.getByRole('group', { name: /Are they taking a medicine to lower cholesterol/ })).toBeVisible();
  await page.getByRole('button', { name: 'Skip these' }).click();
  await page.getByRole('button', { name: 'Show the explanation' }).click();
  await expect(page.getByText('Not saved.')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Saved on this phone')).toHaveCount(0);
});

test('backup, delete everything, restore', async ({ page }) => {
  await startEn(page);
  await enterExample(page, { 'LDL cholesterol': '4,1' });
  await page.getByRole('button', { name: /Continue with/ }).click();
  await page.getByRole('button', { name: 'Skip these' }).click();
  await page.getByRole('button', { name: 'Show the explanation' }).click();
  await page.getByRole('button', { name: 'Keep on this phone' }).click();

  await page.getByRole('button', { name: 'More', exact: true }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save a backup file' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^backup-\d{4}-\d{2}-\d{2}\.json$/);
  const path = await download.path();
  const backup = JSON.parse(readFileSync(path!, 'utf8'));
  expect(backup.panels).toHaveLength(1);
  await shot(page, '06-more-en');

  await page.getByRole('button', { name: 'Delete all my data' }).click();
  await page.getByRole('button', { name: 'Delete everything' }).click();
  await expect(page.getByText('Everything is removed from this phone.')).toBeVisible();
  await expect(page.getByText('Saved on this phone')).toHaveCount(0);
  const left = await page.evaluate(() => new Promise<number>((resolve) => {
    const req = indexedDB.open('lipids');
    req.onsuccess = () => {
      const c = req.result.transaction('panels').objectStore('panels').count();
      c.onsuccess = () => resolve(c.result);
    };
  }));
  expect(left).toBe(0);
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);

  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles(path!);
  await expect(page.getByText('Results restored: 1.')).toBeVisible();
  await page.getByRole('button', { name: /Back/ }).click();
  await expect(page.getByRole('button', { name: /Test of/ })).toBeVisible();
});

test('share sends only a link and text, never values', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await startEn(page);
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Share this app' }).click();
  await page.getByRole('button', { name: 'Lietuvių' }).click();
  await page.getByRole('button', { name: 'Copy message and link' }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toMatch(/^Ši nemokama programėlė .* http:\/\/localhost:4173\/\?lang=lt$/);
  await shot(page, '07-share-en');
});

test.describe('Lithuanian phone', () => {
  test.use({ locale: 'lt-LT' });
  test('Lithuanian by default, sources and about screens', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Supraskite savo cholesterolio tyrimo rezultatus paprastais žodžiais.');
  await shot(page, '08-welcome-lt');
  await page.getByRole('button', { name: 'Daugiau' }).click();
  await page.getByRole('button', { name: 'Šaltiniai' }).click();
  await expect(page.getByText('Šios bandomosios versijos šaltinių juodraštis')).toHaveCount(0); // approved pack: no draft note
  await expect(page.getByRole('heading', { name: 'Klinikinės gairės' })).toBeVisible();
  await expect(page.getByText(/^Mach F, Baigent C/)).toBeVisible();
  await expect(page.getByText('Whitehead')).toHaveCount(0);
  await shot(page, '09-sources-lt');
  await page.getByRole('button', { name: /Atgal/ }).click();
  await page.getByRole('button', { name: 'Apie programėlę' }).click();
  await expect(page.getByText('Ji nediagnozuoja ligų')).toBeVisible();
  const mail = page.getByRole('link', { name: 'Siųsti atsiliepimą el. paštu' });
  await expect(mail).toHaveAttribute('href', /^mailto:justina\.aniulyte@gmail\.com\?subject=/);
  });
});

test('LT entry screen at 320 px with larger text has no sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('./?lang=lt');
  await page.getByRole('button', { name: /Teksto dydis/ }).click();
  await page.getByRole('button', { name: /Teksto dydis/ }).click();
  await page.getByRole('button', { name: 'Paaiškinti mano rezultatus' }).click();
  await page.getByRole('button', { name: /Mano rezultatai/ }).click();
  await page.getByRole('button', { name: 'Toliau' }).click();
  await page.getByLabel('Triacilgliceroliai').fill('194');
  await expect(page.getByText('neįprasta reikšmė')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await shot(page, '10-entry-lt-320-largest');
});

test('works offline after the first visit', async ({ page, context }) => {
  await page.goto('./?lang=en');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  // Open the link again, as a person would (a fresh navigation, not a reload).
  const again = await context.newPage();
  const failed: string[] = [];
  again.on('requestfailed', (r) => failed.push(`${r.failure()?.errorText} ${r.url()}`));
  await again.goto('./?lang=en');
  await expect.soft(failed).toEqual([]);
  await expect(again.getByRole('heading', { level: 1 })).toHaveText('Understand your cholesterol results in plain words.');
  await context.setOffline(false);
});

test('doctor cards first, marker detail with quotes, doctor summary in its own language', async ({ page }) => {
  const outside = watchNetwork(page);
  await startEn(page);
  await expect(page.getByText('This app is not a medical advisor.')).toBeVisible();
  await enterExample(page, { 'LDL cholesterol': '5,5', Triglycerides: '12' });
  await page.getByRole('group', { name: 'Triglycerides' }).getByRole('button', { name: '12 mmol/L, as typed' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('This app is not a medical advisor.')).toBeVisible();
  await page.getByRole('button', { name: 'Show the explanation' }).click();
  await page.getByRole('button', { name: "Don't keep anything" }).click();

  const cards = page.locator('.dcard h2');
  await expect(cards).toHaveText(['Please contact a doctor soon about your triglycerides', 'Please talk to a doctor about your LDL']);
  await expect(page.getByText('Today or tomorrow. If you have strong belly pain, call 112.')).toBeVisible();
  await expect(page.getByText('Guidelines suggest talking to a doctor about some of these results.')).toBeVisible();
  await expect(page.getByText(/this LDL figure may be less accurate/)).toBeVisible();
  await shot(page, '10-results-doctor-en');

  await page.getByRole('button', { name: 'Details and sources' }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('LDL cholesterol');
  await expect(page.getByText('Where this value sits: 4.9 or higher: guidelines suggest talking to a doctor')).toBeVisible();
  await expect(page.locator('figure.quote').first()).toContainText('From 2019 ESC/EAS Guidelines');
  await shot(page, '11-ldl-detail-en');
  await page.goBack();

  await page.getByRole('button', { name: 'Get a summary for my doctor' }).click();
  await expect(page.getByRole('heading', { name: 'Cholesterol test summary' })).toBeVisible();
  const sheet = page.locator('.docsheet');
  await expect(sheet).toContainText('Triglycerides 12.0 mmol/L. Guideline level for talking to a doctor: 10.0 mmol/L or higher.');
  await expect(sheet).toContainText('Would a direct LDL or ApoB test help?');
  await expect(sheet).toContainText('Content version 2026.3');
  await expect(sheet).not.toContainText(/your|my /i);
  await shot(page, '12-summary-en');
  await page.getByRole('button', { name: 'Lietuvių' }).click();
  await expect(sheet).toContainText('Cholesterolio tyrimo');
  await shot(page, '13-summary-lt');
  expect(outside).toEqual([]);
});

test('mg/dL rule: TG 497 mg/dL gets the doctor card', async ({ page }) => {
  await startEn(page);
  await enterExample(page, { Triglycerides: '497' });
  await page.getByRole('group', { name: 'Triglycerides' }).getByRole('button', { name: /497 mg\/dL/ }).click();
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Show the explanation' }).click();
  await page.getByRole('button', { name: "Don't keep anything" }).click();
  await expect(page.locator('.dcard h2')).toHaveText(['Please talk to a doctor about your triglycerides']);
});

test('plan: if-then habit, Today check-in, progress, re-test calendar file, before and after', async ({ page }) => {
  const outside = watchNetwork(page);
  await startEn(page);
  // An earlier test first, then today's.
  await enterExample(page, { 'LDL cholesterol': '4,5' });
  await page.getByLabel('Test date').fill('2026-06-01');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Skip these' }).click();
  await page.getByRole('button', { name: 'Show the explanation' }).click();
  await page.getByRole('button', { name: 'Keep on this phone' }).click();
  await page.getByRole('button', { name: 'Enter other results' }).click();
  await enterExample(page, { 'LDL cholesterol': '4,1' });
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Skip these' }).click();
  await page.getByRole('button', { name: 'Show the explanation' }).click();

  await expect(page.getByText(/LDL cholesterol: 4\.1 mmol\/L, 0\.4 lower than on 1 June 2026 \(4\.5 mmol\/L\)\./)).toBeVisible();
  await shot(page, '14-results-before-after-en');

  await page.getByRole('button', { name: 'Make a plan' }).click();
  // Approved 2026.3: sourced options, LDL levers first, trans fats last, never supplements.
  await expect(page.getByRole('heading', { name: 'Options that often help people with results like these' })).toBeVisible();
  const titles = await page.locator('article.card h3').allTextContents();
  expect(titles[0]).toBe('Swap butter and lard for plant oils');
  expect(titles[titles.length - 1]).toBe('Avoid trans fats and hard margarine');
  await page.getByRole('button', { name: 'Where this comes from' }).first().click();
  await expect(page.locator('figure.quote').first()).toBeVisible();
  await page.getByRole('button', { name: 'What about supplements?' }).click();
  await expect(page.getByText(/do not recommend dietary supplements/)).toBeVisible();
  await page.getByRole('button', { name: 'I have my morning coffee' }).click();
  await page.getByLabel('then I will…').fill('go for a 10-minute walk');
  await shot(page, '15-plan-en');
  await page.getByRole('button', { name: 'Save this habit' }).click();
  await expect(page.getByText('When I have my morning coffee, I will go for a 10-minute walk.')).toBeVisible();
  await expect(page.getByText('1 of 3 habits')).toBeVisible();

  await page.getByRole('button', { name: 'Set a re-test date' }).click();
  await page.getByRole('button', { name: 'In 3 months' }).click();
  await page.getByRole('button', { name: 'Save the date' }).click();
  await expect(page.getByText(/^Re-test on /)).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Add to my calendar' }).click();
  const ics = readFileSync(await (await download).path(), 'utf8');
  expect(ics).toContain('SUMMARY:Blood test');
  await shot(page, '16-retest-en');

  await page.goBack();
  await page.getByRole('button', { name: "Today's habits" }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('Done today.')).toBeVisible();
  await expect(page.getByText(/\d+ days left/)).toBeVisible();
  await shot(page, '17-today-en');

  // Survives a reload once the check-in is written; Today is offered first on the welcome screen.
  await expect.poll(() => page.evaluate(() => new Promise<number>((resolve) => {
    const req = indexedDB.open('lipids');
    req.onsuccess = () => {
      const get = req.result.transaction('settings').objectStore('settings').get('plan');
      get.onsuccess = () => { resolve(get.result?.checkins?.length ?? 0); req.result.close(); };
    };
  }))).toBe(1);
  await page.reload();
  await page.getByRole('button', { name: "Today's habits" }).click();
  await expect(page.getByText('Done today.')).toBeVisible();
  await page.getByRole('button', { name: 'See progress' }).click();
  await expect(page.getByText('Days done: 1')).toBeVisible();
  await shot(page, '18-progress-en');
  expect(outside).toEqual([]);
});

test('no plan offered when every value is inside the guideline ranges', async ({ page }) => {
  await startEn(page);
  await enterExample(page, { 'LDL cholesterol': '2,4' });
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Skip these' }).click();
  await page.getByRole('button', { name: 'Show the explanation' }).click();
  await page.getByRole('button', { name: "Don't keep anything" }).click();
  await expect(page.getByText('Here is where the numbers sit')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Make a plan' })).toHaveCount(0);
});

test('Lithuanian results use the approved Lithuanian explanations (2026.3)', async ({ page }) => {
  await page.goto('./?lang=lt');
  await page.getByRole('button', { name: 'Paaiškinti mano rezultatus' }).click();
  await page.getByRole('button', { name: /Mano rezultatai/ }).click();
  await page.getByRole('button', { name: 'Toliau' }).click();
  await page.getByLabel('MTL cholesterolis').fill('5,3');
  await page.getByRole('button', { name: 'Toliau' }).click();
  await page.getByRole('button', { name: 'Praleisti' }).click();
  await page.getByRole('button', { name: 'Rodyti paaiškinimą' }).click();
  await page.getByRole('button', { name: 'Nieko neišsaugoti' }).click();
  await expect(page.getByText(/Gairės siūlo pasitarti su gydytoju, kai MTL yra 4,9 mmol\/l ar daugiau/)).toBeVisible();
  await expect(page.getByText(/Europos gairės siekia/)).toBeVisible();
  await expect(page.getByText('Kai kurie paaiškinimai kol kas pateikiami tik anglų kalba.', { exact: false })).toHaveCount(0);
  await expect(page.getByText('Ši programėlė nėra medicinos patarėja.', { exact: false })).toBeVisible();
  await shot(page, '20-results-doctor-lt');
  await page.getByRole('button', { name: 'Kurti planą' }).click();
  await expect(page.getByRole('heading', { name: 'Galimybės, kurios dažnai padeda žmonėms su tokiais rezultatais' })).toBeVisible();
  await shot(page, '21-plan-options-lt');
});

test('habit questionnaire: skippable, one per screen, suggests moments, options unchanged', async ({ page }) => {
  await startEn(page);
  await enterExample(page, { 'LDL cholesterol': '4,1' });
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Skip these' }).click();
  await page.getByRole('button', { name: 'Show the explanation' }).click();
  await page.getByRole('button', { name: 'Keep on this phone' }).click();
  await page.getByRole('button', { name: 'Make a plan' }).click();
  const before = await page.locator('article.card h3').allTextContents();

  await page.getByRole('button', { name: 'Answer the questions' }).click();
  await expect(page.getByText('Question 1 of 6')).toBeVisible();
  await page.getByRole('button', { name: 'Most days' }).click();       // fats
  await page.getByRole('button', { name: 'Skip' }).click();            // fibre
  await expect(page.getByText('Question 3 of 6')).toBeVisible();
  await page.getByRole('button', { name: 'Previous question' }).click();
  await expect(page.getByText('Question 2 of 6')).toBeVisible();
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('button', { name: 'Rarely' }).click();          // sweet
  await page.getByRole('button', { name: 'Never' }).click();           // alcohol
  await shot(page, '22-habit-question-en');
  await page.getByRole('button', { name: 'A few times a week' }).click(); // activity
  await page.getByRole('button', { name: 'No', exact: true }).click(); // smoking

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your plan');
  expect(await page.locator('article.card h3').allTextContents()).toEqual(before);
  const chips = await page.locator('.chips .pill').allTextContents();
  expect(chips.slice(0, 3)).toEqual(['I cook dinner', 'I want a snack', 'I finish lunch']);
  expect(chips).not.toContain("I'm offered a drink");
  await expect(page.getByRole('button', { name: /Habit questions answered/ })).toBeVisible();
  await page.reload();
});

test('lab names help lists the names labs print, the asked value first', async ({ page }) => {
  await startEn(page);
  await page.getByRole('button', { name: 'Explain my results' }).click();
  await page.getByRole('button', { name: /My own results/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Other names for this' }).nth(3).click();
  const dialog = page.getByRole('dialog', { name: 'Names labs use for these values' });
  await expect(dialog.locator('dt').first()).toHaveText('Triglycerides');
  await expect(dialog).toContainText('Trigliceridai');
  await expect(dialog).toContainText('MTL-C');
  await expect(dialog.getByRole('heading', { name: 'Names labs use for these values' })).toBeInViewport();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/23-lab-names-en.png` }); // phone viewport, not full page
  await dialog.getByRole('button', { name: 'Got it' }).click();
  await expect(dialog).toBeHidden();
});
