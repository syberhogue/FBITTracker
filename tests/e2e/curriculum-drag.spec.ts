import { expect, test, type Locator, type Page } from '@playwright/test';

async function createProposal(page: Page, template = 'Major Program Modifications') {
  await page.goto('/curriculum');
  await page.getByRole('button', { name: 'Add curriculum change' }).click();
  await page.getByLabel('Change title').fill('Drag scheduling proposal');
  await page.getByLabel('Change template').selectOption(template);
  await page.getByLabel('Planning start date').fill('2026-09-01');
  await page.getByLabel('Implementation academic year').fill('2027');
  await page.getByRole('button', { name: 'Save curriculum change', exact: true }).click();
}

async function dragDate(page: Page, timeline: Locator, key: string, date: string, during?: () => Promise<void>, cancel = false) {
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
  await during?.();
  if (cancel) await page.keyboard.press('Escape');
  await page.mouse.up();
}

test('previews and saves dependent meeting moves from both curriculum timelines', async ({ page }) => {
  test.setTimeout(90_000);
  await createProposal(page);
  await page.getByRole('button', { name: 'Committee calendar', exact: true }).click();
  await page.getByLabel('Calendar committee').selectOption('FC');
  await page.getByLabel('FC meeting 3', { exact: true }).fill('2026-11-04');
  await page.getByRole('button', { name: 'Save committee calendar', exact: true }).click();
  const timeline = page.getByRole('region', { name: 'Overall curriculum timeline', exact: true });
  const marker = (key: string) => timeline.locator(`button[data-task-key="${key}"]`);
  await expect(marker('uec-approval')).toHaveAttribute('data-draggable', 'true');
  await expect(marker('uec-approval:agenda')).toHaveAttribute('data-draggable', 'false');
  await dragDate(page, timeline, 'uec-approval', '2026-10-10', async () => {
    await expect(marker('uec-approval')).toHaveAttribute('data-date', '2026-10-13');
    await expect(marker('uec-approval:agenda')).toHaveAttribute('data-date', '2026-10-08');
    await expect(marker('fc-approval')).toHaveAttribute('data-date', '2026-11-04');
    await expect(marker('fc-approval:agenda')).toHaveAttribute('data-date', '2026-10-28');
    await expect(marker('usc-approval')).toHaveAttribute('data-date', '2026-12-15');
    await expect(marker('ac-approval')).toHaveAttribute('data-date', '2027-01-26');
  });
  await expect(timeline.getByRole('status')).toContainText('rescheduled');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Update FC (Approval)', exact: true }).locator('..').locator('..')).toContainText('Nov 4, 2026');
  await dragDate(page, timeline, 'uec-approval', '2026-11-10', undefined, true);
  await expect(marker('uec-approval')).toHaveAttribute('data-date', '2026-10-13');
  await expect(marker('fc-approval')).toHaveAttribute('data-date', '2026-11-04');
  // Feb 23 is information-only: AC approval must snap to Mar 23.
  const ac = page.getByRole('region', { name: 'AC · University timeline', exact: true });
  await dragDate(page, ac, 'ac-approval', '2027-02-20');
  await expect(marker('ac-approval')).toHaveAttribute('data-date', '2027-03-23');
  // Returning UEC earlier replans the dependent chain without moving prerequisites.
  await dragDate(page, timeline, 'uec-approval', '2026-09-02');
  await expect(marker('fc-approval')).toHaveAttribute('data-date', '2026-10-06');
  await expect(marker('usc-approval')).toHaveAttribute('data-date', '2026-10-20');
  await expect(marker('ac-approval')).toHaveAttribute('data-date', '2026-11-24');
  await timeline.screenshot({ path: 'test-results/curriculum-drag-timeline.png' });
});

test('locks completed markers and blocks moves across recorded history', async ({ page }) => {
  await createProposal(page, 'New Courses');
  await page.getByRole('button', { name: 'Update FC (Approval)', exact: true }).click();
  await page.getByLabel('Outcome', { exact: true }).selectOption('approved');
  await page.getByLabel('Actual completion date').fill('2026-09-10');
  await page.getByLabel('Stage notes').fill('Keep the actual meeting record');
  await page.getByRole('button', { name: 'Save stage', exact: true }).click();
  const timeline = page.getByRole('region', { name: 'Overall curriculum timeline', exact: true });
  await expect(timeline.locator('button[data-task-key="fc-approval"]')).toHaveAttribute('data-draggable', 'false');
  await dragDate(page, timeline, 'uec-approval', '2026-10-10');
  await expect(timeline.getByRole('alert')).toContainText('recorded completion of FC');
  await expect(timeline.locator('button[data-task-key="uec-approval"]')).toHaveAttribute('data-date', '2026-09-08');
  await page.getByRole('button', { name: 'Update FC (Approval)', exact: true }).click();
  await expect(page.getByLabel('Actual completion date')).toHaveValue('2026-09-10');
  await expect(page.getByLabel('Stage notes')).toHaveValue('Keep the actual meeting record');
});

test('missing downstream meetings block the entire drag and retain saved dates', async ({ page }) => {
  test.setTimeout(60_000);
  await createProposal(page, 'New Courses');
  await page.getByRole('button', { name: 'Committee calendar', exact: true }).click();
  await page.getByLabel('Calendar committee').selectOption('USC');
  const deletes = page.getByRole('button', { name: /^Delete USC meeting / });
  const count = await deletes.count();
  expect(count).toBe(9);
  for (let i = 0; i < count; i++) await page.getByRole('button', { name: 'Delete USC meeting 1', exact: true }).click();
  await page.getByRole('button', { name: 'Save committee calendar', exact: true }).click();
  const timeline = page.getByRole('region', { name: 'Overall curriculum timeline', exact: true });
  await dragDate(page, timeline, 'uec-approval', '2026-10-10');
  await expect(timeline.getByRole('alert')).toContainText('No available USC');
  await expect(timeline.locator('button[data-task-key="uec-approval"]')).toHaveAttribute('data-date', '2026-09-08');
  await expect(timeline.locator('button[data-task-key="fc-approval"]')).toHaveAttribute('data-date', '2026-10-06');
  await expect(timeline.locator('button[data-task-key="usc-approval"]')).toHaveAttribute('data-date', '2026-10-20');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
