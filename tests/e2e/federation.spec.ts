import { expect, test, type Page } from '@playwright/test';
import { FLOW_PATH } from './helpers.ts';

const open = async (page: Page, search = '') => {
	await page.goto(`${FLOW_PATH}?mode=advanced${search}`);
	await page.locator('.workspace[data-ready="true"]').waitFor();
};
const row = (page: Page, step: string) => page.locator(`[data-step="${step}"]`);
const toggle = (page: Page, setting: string) =>
	page.locator(`[data-setting="${setting}"] input[type="checkbox"]`);

test.describe('users in a directory', () => {
	test('adds a lookup on the server, and nothing the browser takes part in', async ({ page }) => {
		await open(page);
		await expect(row(page, 'directory-bind')).toHaveCount(0);
		await toggle(page, 'federation').check();
		await expect(page).toHaveURL(/directory=1/);
		await expect(row(page, 'directory-search')).toHaveCount(1);
		await expect(row(page, 'directory-bind')).toHaveCount(1);
		await expect(page.getByTestId('change-summary')).toContainText('steps added');
	});

	test('flips with another provider, on the same diagram', async ({ page }) => {
		await open(page, '&broker=1');
		await expect(row(page, 'redirect-to-upstream')).toHaveCount(1);
		await toggle(page, 'federation').check();
		await expect(row(page, 'redirect-to-upstream')).toHaveCount(0);
		await expect(row(page, 'directory-bind')).toHaveCount(1);
		await expect(page).not.toHaveURL(/broker=1/);
		await toggle(page, 'broker').check();
		await expect(row(page, 'directory-bind')).toHaveCount(0);
		await expect(row(page, 'redirect-to-upstream')).toHaveCount(1);
		await expect(page).not.toHaveURL(/directory=1/);
	});

	test('shows the password reaching the directory, and what it answers', async ({ page }) => {
		await open(page, '&directory=1&step=directory-bind');
		await expect(page.getByTestId('on-the-wire')).toContainText('mech=SIMPLE');
		await open(page, '&directory=1&step=directory-bound');
		await expect(page.getByTestId('on-the-wire')).toContainText('RESULT tag=97 err=0');
		await expect(page.getByTestId('on-the-wire')).toContainText('From the log, not the wire');
		await expect(page.getByTestId('on-the-wire')).toContainText('ssf=0');
	});

	test('offers no command for what is not HTTP', async ({ page }) => {
		await open(page, '&directory=1&step=directory-bind');
		await expect(page.getByTestId('copy-request')).toHaveCount(0);
	});

	test('is a question on the map, and search finds it', async ({ page }) => {
		await page.goto(`${FLOW_PATH}users-in-a-directory/`);
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect(
			page.locator(
				'[data-step="directory-bind"] [aria-current="step"], [data-step="directory-bind"][aria-current="step"]'
			)
		).toHaveCount(1);
	});

	test('stays on as a chip in simple mode', async ({ page }) => {
		await page.goto(`${FLOW_PATH}?mode=simple&directory=1`);
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect(page.locator('[data-setting="federation"]')).toHaveCount(0);
		await expect(page.getByText('Users in a directory')).toBeVisible();
	});
});
