import { devices, expect, test, type Page } from '@playwright/test';

const SHOTS = process.env.SHOTS_DIR;
const FIX = 'e2e/fixtures/';

/** Any request to another server, and any Content Security Policy complaint, fails the test. */
function watch(page: Page) {
  const problems: string[] = [];
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith('http://localhost:4174/') && !u.startsWith('blob:') && !u.startsWith('data:')) problems.push(u); });
  page.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) problems.push(m.text()); });
  return problems;
}

async function toEntry(page: Page) {
  await page.goto('./?lang=en');
  await page.getByRole('button', { name: 'Explain my results' }).click();
  await page.getByRole('button', { name: /My own results/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
}

async function read(page: Page, file: string) {
  await page.locator('input[type=file]').setInputFiles(FIX + file);
  await expect(page.getByText(/Read \d of 4 values|No values could be read|did not work/)).toBeVisible({ timeout: 90_000 });
}

const num = async (page: Page, label: string) => (await page.getByRole('textbox', { name: label }).inputValue()).replace(',', '.');

test('PDF lab report: text layer read exactly, values land in the form for checking', async ({ page }) => {
  const problems = watch(page);
  await toEntry(page);
  await read(page, 'lab-report.pdf');
  await expect(page.getByText('Read 4 of 4 values.')).toBeVisible();
  await expect(page.getByText('Photo reading is being tested. Please check every number against your sheet before you continue.')).toBeVisible();
  expect(await num(page, 'LDL cholesterol')).toBe('4.15');
  expect(await num(page, 'Total cholesterol')).toBe('6.32');
  expect(await num(page, 'HDL cholesterol')).toBe('1.28');
  expect(await num(page, 'Triglycerides')).toBe('1.94');
  await expect(page.getByText('Read from your sheet: please check.')).toHaveCount(4);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/30-read-pdf-en.png`, fullPage: true });
  // Editing a value drops its "please check" note; the usual checks and confirm screen follow.
  await page.getByRole('textbox', { name: 'LDL cholesterol' }).fill('4,2');
  await expect(page.getByText('Read from your sheet: please check.')).toHaveCount(3);
  await page.getByRole('button', { name: /Continue with/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('4.2', { exact: false }).first()).toBeVisible();
  // QA R1: the three values still as read are marked, and one tick is needed to go on.
  await expect(page.locator('.rows .fromsheet')).toHaveCount(3);
  await expect(page.getByText('Photo reading is being tested.', { exact: false })).toBeVisible();
  const show = page.getByRole('button', { name: 'Show the explanation' });
  await show.click();                                                   // stays on this screen and says why
  await expect(page.getByText('Tick the box above once the numbers are checked against the sheet.')).toBeVisible();
  await expect(page.getByLabel('I have checked these numbers against my sheet.')).toBeFocused();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Check the numbers');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/33-read-confirm-tick-en.png`, fullPage: true });
  await page.getByLabel('I have checked these numbers against my sheet.').check();
  await expect(page.getByText('Tick the box above once the numbers are checked against the sheet.')).toHaveCount(0);
  await show.click();
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Check the numbers');
  if (await page.getByRole('button', { name: "Don't keep anything" }).isVisible()) await page.getByRole('button', { name: "Don't keep anything" }).click();

  // One optional question after a reading; each answer is an email with that answer only.
  const fb = page.getByRole('region', { name: 'Did the photo reading get your numbers right?' });
  await expect(fb).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/34-read-feedback-en.png`, fullPage: true });
  const hrefs = await fb.getByRole('link').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
  expect(hrefs).toHaveLength(3);
  for (const h of hrefs) {
    expect(h).toMatch(/^mailto:bloodlipidsexplained@gmail\.com\?subject=Photo%20reading&body=Photo%20reading%3A%20/);
    expect(decodeURIComponent(h)).not.toMatch(/\d/);                   // no numbers of any kind
  }
  expect(decodeURIComponent(hrefs[1])).toContain('Photo reading: I fixed some');
  await fb.getByRole('button', { name: 'Skip' }).click();
  await expect(fb).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('clear photo: values read are right, nothing typed is overwritten, works offline afterwards', async ({ page, context }) => {
  const problems = watch(page);
  // A returning visit: the service worker is in charge, so the reader files it fetches are kept.
  await page.goto('./?lang=en');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await toEntry(page);
  await page.getByRole('textbox', { name: 'HDL cholesterol' }).fill('1,1');            // typed first: must stay
  await read(page, 'sheet04.jpg');                                   // truth: total 6.0, tg 3.05, ldl 3.5, hdl 0.9
  const truth: Record<string, string> = { 'LDL cholesterol': '3.5', 'Total cholesterol': '6', Triglycerides: '3.05' };
  for (const [label, v] of Object.entries(truth)) {
    const got = await num(page, label);
    if (got) expect(Number(got)).toBe(Number(v));                   // empty is fine, wrong is not
  }
  expect(await num(page, 'HDL cholesterol')).toBe('1.1');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/31-read-photo-en.png`, fullPage: true });
  expect(problems).toEqual([]);

  // The reader files are kept by the service worker: reading works with no connection.
  await context.setOffline(true);
  const offline = await context.newPage();
  await toEntry(offline);
  await read(offline, 'sheet04.jpg');
  await expect(offline.getByText(/Read [1-4] of 4 values/)).toBeVisible();
  await context.setOffline(false);

  // Whole-app test U3: the reader files sit in their own cache, which a release keeps unless the
  // reader files themselves change; the app's versioned cache holds none of them.
  const kept = await page.evaluate(async () => {
    const out: Record<string, string[]> = {};
    for (const k of await caches.keys()) out[k] = (await (await caches.open(k)).keys()).map((r) => new URL(r.url).pathname);
    return out;
  });
  const ocrCaches = Object.keys(kept).filter((k) => k.startsWith('ocr-'));
  expect(ocrCaches).toHaveLength(1);
  expect(kept[ocrCaches[0]].some((p) => p.endsWith('/ocr/lit.traineddata.gz'))).toBe(true);
  for (const k of Object.keys(kept).filter((k) => k.startsWith('app-'))) expect(kept[k].filter((p) => p.includes('/ocr/'))).toEqual([]);
});

test.describe('app left open while a release lands', () => {
  test.use({ serviceWorkers: 'block' });
  test('the old reader file is gone: the app reloads once onto the entry screen and reading works (U2)', async ({ page }) => {
    let gone = true;
    let refused = 0;
    await page.route(/\/assets\/sheetReader-[^/]+\.js$/, (route) => {
      if (gone) { refused++; return route.fulfill({ status: 404, body: '' }); }
      return route.continue();
    });
    page.on('framenavigated', () => { if (refused > 0) gone = false; });
    await toEntry(page);
    await page.locator('input[type=file]').setInputFiles(FIX + 'lab-report.pdf');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Type in the numbers from the lab sheet', { timeout: 30_000 });
    expect(refused).toBeGreaterThan(0);
    await read(page, 'lab-report.pdf');
    await expect(page.getByText('Read 4 of 4 values.')).toBeVisible();
  });

  test('with numbers already typed, nothing reloads and the usual message shows (U2)', async ({ page }) => {
    await page.route(/\/assets\/sheetReader-[^/]+\.js$/, (route) => route.fulfill({ status: 404, body: '' }));
    let loads = 0;
    page.on('load', () => loads++);
    await toEntry(page);
    await page.getByRole('textbox', { name: 'HDL cholesterol' }).fill('1,1');
    const before = loads;
    await read(page, 'lab-report.pdf');
    await expect(page.getByText('Reading did not work here. Please type the values in.')).toBeVisible();
    expect(loads).toBe(before);
    expect(await num(page, 'HDL cholesterol')).toBe('1.1');
  });
});

test('hard photo (tilt, shadow, blur): anything filled is right', async ({ page }) => {
  await toEntry(page);
  await read(page, 'sheet00.jpg');                                   // truth: hdl 2.25, tg 0.95, total 6.6, ldl 6.2
  const truth: Record<string, number> = { 'LDL cholesterol': 6.2, 'Total cholesterol': 6.6, 'HDL cholesterol': 2.25, Triglycerides: 0.95 };
  for (const [label, v] of Object.entries(truth)) {
    const got = await num(page, label);
    if (got) expect(Number(got)).toBe(v);
  }
});

test('a read value that would bring up a doctor card is asked about once (QA PR1-PR3)', async ({ page }) => {
  await toEntry(page);
  await read(page, 'lab-report-ldl-high.pdf');                       // LDL 5,5; total printed after its limit
  expect(await num(page, 'Total cholesterol')).toBe('7.4');            // "< 5,2" skipped; the ratio line filled nothing
  const ask = page.getByRole('group', { name: 'LDL cholesterol' });
  await expect(ask).toContainText('We read 5.5 mmol/L for LDL cholesterol. Is that what the sheet says?');
  await expect(page.getByRole('button', { name: /Continue/ })).toBeDisabled();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/32-read-confirm-en.png`, fullPage: true });
  await ask.getByRole('button', { name: 'No, let me type it' }).click();
  expect(await num(page, 'LDL cholesterol')).toBe('');
  await page.getByRole('textbox', { name: 'LDL cholesterol' }).fill('3,5');
  await expect(page.getByRole('button', { name: /Continue with/ })).toBeEnabled();

  await page.getByRole('textbox', { name: 'LDL cholesterol' }).fill('');
  await read(page, 'lab-report-ldl-high.pdf');                       // fills only the empty LDL field
  await ask.getByRole('button', { name: 'Yes, the sheet says that' }).click();
  await expect(ask).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Continue with/ })).toBeEnabled();
});

test.describe('on a computer', () => {
  const { defaultBrowserType: _ignored, ...desktop } = devices['Desktop Chrome'];
  test.use(desktop);
  test('the button opens a file picker for a saved photo or PDF (no camera needed)', async ({ page }) => {
    const problems = watch(page);
    await toEntry(page);
    const btn = page.getByRole('button', { name: 'Read the numbers from a photo or PDF' });
    await expect(page.locator('input[type=file]')).not.toHaveAttribute('capture', /.*/);
    for (const file of ['lab-report.pdf', 'sheet04.jpg']) {
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), btn.click()]);
      expect(chooser.isMultiple()).toBe(false);
      for (const id of ['LDL cholesterol', 'Total cholesterol', 'HDL cholesterol', 'Triglycerides']) await page.getByRole('textbox', { name: id }).fill('');
      await chooser.setFiles(FIX + file);
      await expect(page.getByText(/Read [1-4] of 4 values/)).toBeVisible({ timeout: 90_000 });
    }
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/35-read-desktop-en.png`, fullPage: true });
    expect(problems).toEqual([]);
  });
});
