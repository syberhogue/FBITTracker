import { expect, test } from '@playwright/test';

test('faculty can validate and submit a grade file from the public page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Submit final grades in a few minutes.' })).toBeVisible();
  await page.getByLabel('Course code / number').fill('INFT1020');
  await page.getByLabel('Faculty full name').fill('Dr. Alex Mercer');
  await page.getByLabel('Faculty email').fill('alex.mercer@ontariotechu.ca');
  await page.getByLabel('Grade file').setInputFiles({
    name: 'inft-1020u-final-grades.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Semester ID,Course Code,Last Name,Section,Student ID,Final Grade (%),Final Letter Grade\nFall 2026,INFT 1020U,Doe,001,1001,88,A\nF2026,INFT 1020U,Roe,001,1002,72,B'),
  });
  await expect(page.getByText('File validated')).toBeVisible();
  await expect(page.getByText('2 grades', { exact: true })).toBeVisible();
  await page.getByLabel(/I confirm that these grades are final/).check();
  await page.getByRole('button', { name: 'Submit final grades' }).click();
  await expect(page.getByRole('heading', { name: 'Your grades were received.' })).toBeVisible();
  await expect(page.getByText(/Intro to Data Structures & Algorithms/)).toBeVisible();
  await expect(page.getByText(/F26 · 2 grades/)).toBeVisible();
});

test('dashboard and grade analytics remain available at the staff route', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Process Dashboard' })).toBeVisible();
  await expect(page.getByText('Active trackers', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Fall 2026 Grade Submission Portal' }).click();
  await expect(page.getByRole('heading', { name: 'Fall 2026 Grade Submission Portal' })).toBeVisible();
  await page.getByRole('link', { name: 'Grade analytics' }).click();
  await expect(page.getByText('Historical course trend')).toBeVisible();
  await expect(page.getByText('Failure rate (%)', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Active term')).toBeVisible();
  const templateDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV template' }).click();
  await expect((await templateDownload).suggestedFilename()).toBe('Final_Grades_Template_F26.csv');
  await page.getByRole('button', { name: 'Create term' }).click();
  await page.getByLabel('Term code').fill('S27');
  await page.getByLabel('Term name').fill('Spring/Summer 2027');
  await page.getByLabel('Start date').fill('2027-05-03');
  await page.getByLabel('End date').fill('2027-08-27');
  await page.getByLabel('Create academic term').getByRole('button', { name: 'Create term', exact: true }).click();
  await expect(page.getByLabel('Active term')).toHaveValue('S27');
  await expect(page.getByRole('status')).toContainText('Academic term S27 created and selected.');
  await expect(page.getByRole('button', { name: 'Delete current-term data' })).toBeDisabled();
  await page.getByLabel('Active term').selectOption('F26');
  await page.getByRole('button', { name: 'Delete current-term data' }).click();
  await expect(page.getByText(/permanently removes all uploaded grade versions/)).toBeVisible();
  await page.getByRole('button', { name: 'Delete grade data' }).click();
  await expect(page.getByText('No grade submission for INFT 1020U in F26.')).toBeVisible();
  await page.getByRole('button', { name: 'Upload grades', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'winter-grades.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Semester ID,Course Code,Last Name,Section,Student ID,Final Grade (%),Final Letter Grade\nW 2026,INFT1020,Doe,001,1001,91,A+\nWinter 2026,INFT 1020U,Roe,001,1002,81,A-'),
  });
  await expect(page.getByText(/destination term W26/)).toBeVisible();
  await page.getByRole('button', { name: 'Submit de-identified grades' }).click();
  await expect(page.getByLabel('Active term')).toHaveValue('W26');
  await expect(page.getByRole('status')).toContainText('for W26');
});

test('a stage accepts multiple URL attachments and allows individual removal', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('link', { name: 'Fall 2026 Grade Submission Portal' }).click();
  const stage = page.getByRole('listitem').filter({ hasText: 'Initial Reminder Email' });
  await stage.getByRole('button', { name: 'Attach' }).click();
  await page.getByRole('button', { name: 'Specify URL' }).click();
  await page.getByLabel('Link name').fill('Faculty guide');
  await page.getByLabel('URL').fill('https://example.test/faculty-guide');
  await page.getByRole('button', { name: 'Add link' }).click();
  await expect(page.getByText('Link attached. You can add another link or close this window.')).toBeVisible();
  await page.getByLabel('Link name').fill('Submission portal');
  await page.getByLabel('URL').fill('https://example.test/submit');
  await page.getByRole('button', { name: 'Add link' }).click();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(stage.getByRole('link', { name: 'Faculty guide' })).toHaveAttribute('href', 'https://example.test/faculty-guide');
  await expect(stage.getByRole('link', { name: 'Submission portal' })).toHaveAttribute('href', 'https://example.test/submit');
  page.once('dialog', dialog => void dialog.accept());
  await stage.getByRole('button', { name: 'Remove link Faculty guide' }).click();
  await expect(stage.getByRole('link', { name: 'Faculty guide' })).toHaveCount(0);
  await expect(stage.getByRole('link', { name: 'Submission portal' })).toBeVisible();
});

test('a stage due date can be selected from the important dates for its term', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('link', { name: 'Fall 2026 Grade Submission Portal' }).click();
  await page.getByRole('button', { name: 'Initial Reminder Email Send instructions to all instructors.', exact: true }).click();
  const importantDate = page.getByLabel('Important date · F26');
  await expect(importantDate).toContainText('Sep 8, 2026 · Fall Lectures Begin');
  await expect(importantDate).toContainText('Oct 13, 2026 · Fall Study Week (through Oct 18, 2026)');
  await importantDate.selectOption('important-f26-study-week');
  await expect(page.getByLabel('Due date')).toHaveValue('2026-10-13');
  await expect(page.getByText('The milestone uses the first day of this date range.')).toBeVisible();
  await page.getByRole('button', { name: 'Save milestone' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Initial Reminder Email' })).toContainText('Oct 13, 2026');
});

test('a user can create a personal template and apply it to a new tracker', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Tracker templates' })).toBeVisible();
  await expect(page.getByText('End-of-term grade submission', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Important dates' })).toBeVisible();
  await expect(page.getByText('Choose an .xlsx file')).toBeVisible();
  await page.getByRole('button', { name: 'Create template' }).click();
  await page.getByLabel('Template name').fill('Committee review cycle');
  await page.getByLabel('Description', { exact: true }).fill('Reusable personal committee workflow.');
  await page.getByLabel('Stage 1 title').fill('Prepare review package');
  await page.getByLabel('Stage 1 description').fill('Collect the documents required for review.');
  await page.getByLabel('Days from anchor').fill('3');
  await page.getByRole('button', { name: 'Save template' }).click();
  await expect(page.getByText('Committee review cycle', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Dashboard Overview' }).click();
  await page.getByRole('button', { name: 'Add new tracker' }).click();
  await page.getByLabel('Start from').selectOption({ label: 'My template · Committee review cycle' });
  await page.getByLabel('Tracker title').fill('October committee review');
  await page.getByLabel('Schedule anchor date').fill('2026-10-01');
  await page.getByRole('button', { name: 'Create from template' }).click();
  await expect(page.getByRole('heading', { name: 'October committee review' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Prepare review package Collect the documents required for review.', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Oct 4, 2026 Prepare review package pending', exact: true })).toBeVisible();
});
