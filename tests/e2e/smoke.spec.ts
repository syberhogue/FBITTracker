import { expect, test } from '@playwright/test';

test('dashboard and grade analytics render from the preserved prototype flow', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Process Dashboard|Welcome back/ })).toBeVisible();
  if (await page.getByRole('heading', { name: 'Welcome back' }).isVisible()) {
    await page.getByLabel('Email').fill('morgan.ellis@ontariotechu.ca');
    await page.getByLabel('Password').fill('LocalDemo2026!');
    await page.getByRole('button', { name: 'Sign in' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Process Dashboard' })).toBeVisible();
  await expect(page.getByText('Active trackers', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Fall 2026 Grade Submission Portal' }).click();
  await expect(page.getByRole('heading', { name: 'Fall 2026 Grade Submission Portal' })).toBeVisible();
  await page.getByRole('link', { name: 'Grade analytics' }).click();
  await expect(page.getByText('Historical course trend')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Upload grades for F26' })).toBeVisible();
});
