import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function dragDate(page: Page, timeline: Locator, key: string, date: string, cancel = false) {
  const marker = timeline.locator(`button[data-task-key="${key}"]`);
  await marker.scrollIntoViewIfNeeded();
  const from = (await marker.boundingBox())!;
  const plot = (await timeline.locator('[data-timeline-plot]').boundingBox())!;
  const range = timeline.locator('[data-zoomed]');
  const low = Number(await range.getAttribute('data-visible-start'));
  const high = Number(await range.getAttribute('data-visible-end'));
  const destination = plot.x + plot.width * (0.1 + 0.8 * (Date.parse(`${date}T00:00:00Z`) - low) / (high - low));
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(destination, from.y + from.height / 2, { steps: 10 });
  expect(Math.abs((await timeline.locator('[data-timeline-plot]').boundingBox())!.y - plot.y)).toBeLessThan(1);
  if (cancel) await page.keyboard.press('Escape');
  await page.mouse.up();
}

test('drags editable dates, pans through detailed divisions, and exports student information', async ({ page, context }) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(15_000);
  await page.goto('/graduates');
  await page.getByRole('button', { name: 'Add MSc student' }).click();
  await page.getByLabel('Student name', { exact: true }).fill('Timeline Export Student');
  await page.getByLabel('Student ID', { exact: true }).fill('EXPORT-1');
  await page.getByLabel('Supervisor account', { exact: true }).selectOption({ label: 'Dr. Alex Mercer' });
  await page.getByLabel('Start semester').selectOption('Fall');
  await page.getByLabel('Start year').fill('2024');
  await page.getByRole('button', { name: 'Save student', exact: true }).click();
  const courses = page.getByRole('region', { name: 'Coursework timeline', exact: true });
  await courses.getByLabel('Semester: Fall 2024', { exact: true }).dblclick({ position: { x: 5, y: 5 } });
  await page.getByRole('button', { name: 'Assign course', exact: true }).click();
  await dragDate(page, courses, 'course:1', '2025-07-15');
  await expect(courses.locator('button[data-task-key="course:1"]')).toHaveAttribute('aria-label', /Aug 31, 2025/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await courses.locator('button[data-task-key="course:1"]').click();
  await expect(page.getByLabel('Course semester', { exact: true })).toHaveValue('2025-05-01');
  await page.getByLabel('Task notes / reference').fill('Preserve this course note');
  await page.getByRole('button', { name: 'Save task', exact: true }).click();
  await dragDate(page, courses, 'course:1', '2025-11-15', true);
  await expect(courses.locator('button[data-task-key="course:1"]')).toHaveAttribute('aria-label', /Aug 31, 2025/);
  await dragDate(page, courses, 'course:1', '2025-11-15');
  await expect(courses.locator('button[data-task-key="course:1"]')).toHaveAttribute('aria-label', /Dec 31, 2025/);

  const overview = page.getByRole('region', { name: 'All deadlines timeline', exact: true });
  const plot = overview.locator('[data-timeline-plot]');
  const frame = overview.locator('[data-zoomed]');
  await overview.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await overview.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(plot).toHaveAttribute('data-detail', 'month');
  await expect(overview.locator('[aria-label^="month division:"]').first()).toBeVisible();
  await plot.scrollIntoViewIfNeeded();
  const box = (await plot.boundingBox())!;
  const before = Number(await frame.getAttribute('data-visible-start'));
  await page.mouse.move(box.x + box.width * 0.55, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.40, box.y + 20, { steps: 10 });
  await page.mouse.up();
  expect(Number(await frame.getAttribute('data-visible-start'))).toBeGreaterThan(before);
  for (let i = 0; i < 4; i++) await overview.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(plot).toHaveAttribute('data-detail', 'week');
  await expect(overview.locator('[aria-label^="week division:"]').first()).toBeVisible();
  for (let i = 0; i < 4; i++) await overview.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(plot).toHaveAttribute('data-detail', 'day');
  await expect(overview.locator('[aria-label^="day division:"]').first()).toBeVisible();
  await overview.screenshot({ path: 'test-results/msc-day-zoom.png' });
  await overview.getByRole('button', { name: 'Reset zoom', exact: true }).click();

  const planning = page.getByRole('region', { name: 'Thesis/Defence planning timeline', exact: true });
  await dragDate(page, planning, 'chapter:literature', '2024-09-16');
  await expect(planning.getByRole('alert')).toContainText('cannot precede the program start');
  await expect(planning.locator('button[data-task-key="chapter:literature"]')).toHaveAttribute('aria-label', /Dec 31, 2024/);
  await dragDate(page, planning, 'chapter:results', '2026-07-08');
  await expect(planning.locator('button[data-task-key="chapter:results"]')).toHaveAttribute('aria-label', /Jul 6, 2026/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Category', exact: true }).click();
  await page.getByLabel('Category name').fill('Export notes');
  await page.getByRole('button', { name: 'Save category', exact: true }).click();
  const area = page.getByRole('region', { name: 'Export notes', exact: true });
  await area.getByRole('button', { name: 'Deadline', exact: true }).click();
  await page.getByLabel('Deadline name').fill('Custom deadline');
  await page.getByLabel('Expected date', { exact: true }).fill('2026-02-01');
  await page.getByRole('button', { name: 'Save deadline', exact: true }).click();
  const custom = area.getByRole('region', { name: 'Export notes timeline', exact: true });
  const customKey = (await custom.locator('button[data-task-key]').getAttribute('data-task-key'))!;
  await dragDate(page, custom, customKey, '2026-02-18');
  await expect(custom.locator('button[data-task-key]')).toHaveAttribute('aria-label', /Feb 16, 2026/);
  for (let i = 0; i < 18; i++) {
    await custom.locator('button[data-task-key]').hover();
    await page.mouse.wheel(0, -100);
  }
  await expect(custom.locator('[data-timeline-plot]')).toHaveAttribute('data-detail', 'day');
  await dragDate(page, custom, customKey, '2026-02-18');
  await expect(custom.locator('button[data-task-key]')).toHaveAttribute('aria-label', /Feb 18, 2026/);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export MSc student information' });
  for (const [label, extension, expected] of [['Text (.txt)', 'txt', 'Preserve this course note'], ['Spreadsheet (.csv)', 'csv', 'Course requirement 1'], ['Calendar (.ics)', 'ics', 'BEGIN:VCALENDAR']]) {
    const downloading = page.waitForEvent('download');
    await dialog.getByRole('button', { name: label, exact: true }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${extension}$`));
    expect(await readFile((await download.path())!, 'utf8')).toContain(expected);
  }
  await context.addInitScript(() => { window.print = () => {}; });
  const opening = page.waitForEvent('popup');
  await dialog.getByRole('button', { name: 'PDF (Print / Save as PDF)', exact: true }).click();
  const report = await opening;
  await expect(report.getByRole('heading', { name: 'MSc student progress', exact: true })).toBeVisible();
  await expect(report.getByRole('cell', { name: /Course requirement 5/ })).toBeVisible();
  await expect(report.getByText('Preserve this course note', { exact: false })).toBeVisible();
  await expect(report.getByRole('img', { name: /Overall student timeline showing today/ })).toBeVisible();
  await report.pdf({ path: 'test-results/msc-export.pdf', preferCSSPageSize: true });
  await report.screenshot({ path: 'test-results/msc-export-report.png', fullPage: true });
  await report.close();
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
});
