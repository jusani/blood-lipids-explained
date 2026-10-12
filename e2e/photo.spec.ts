import { expect, test, type Page } from '@playwright/test';

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
