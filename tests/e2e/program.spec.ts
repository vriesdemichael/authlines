import { expect, test, type Page } from '@playwright/test';
import { FLOW_PATH } from './helpers.ts';

const open = async (page: Page, search = '') => {
	await page.goto(`${FLOW_PATH}?${search}`);
	await page.locator('.workspace[data-ready="true"]').waitFor();
};
const row = (page: Page, step: string) => page.locator(`[data-step="${step}"]`);
const option = (page: Page) => page.locator('[data-setting="appRuns"] input[value="program"]');

// #178: a command-line tool or a desktop app, hearing the answer on 127.0.0.1.
test.describe('a program on the user’s computer', () => {
	test('is offered in advanced mode, and draws the program opening the browser', async ({
		page
	}) => {
		await open(page, 'mode=simple');
		await expect(option(page)).toHaveCount(0);
		await open(page, 'mode=advanced');
		await option(page).check();
		await expect(page).toHaveURL(/runs=program/);
		await expect(row(page, 'program-starts')).toHaveCount(1);
		await expect(row(page, 'program-opens-browser')).toHaveCount(1);
		await expect(row(page, 'open-app')).toHaveCount(0);
		await expect(page.locator('[data-lifeline="app"]')).toContainText('Program');
	});

	test('stays on screen in simple mode when a link has it on', async ({ page }) => {
		await open(page, 'mode=simple&runs=program&client=public&pkce=1');
		await expect(option(page)).toBeChecked();
	});

	test('shows the code coming back on a port nobody registered', async ({ page }) => {
		await open(page, 'mode=advanced&runs=program&client=public&pkce=1&step=redirect-with-code');
		await expect(page.getByTestId('payload')).toContainText('http://127.0.0.1:');
		await expect(page.locator('[data-note="loopback-redirects"]')).toHaveCount(0);
		await open(page, 'mode=advanced&runs=program&client=public&pkce=1&step=authorize');
		await expect(page.locator('[data-note="loopback-redirects"]')).toHaveCount(1);
		await expect(page.locator('[data-note="valid-redirect-uris"]')).toHaveCount(0);
	});
});
