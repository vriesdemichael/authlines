import { expect, test, type Page } from '@playwright/test';
import { FLOW_PATH } from './helpers.ts';

const openSetup = async (page: Page, search = '') => {
	await page.goto(`${FLOW_PATH}setup/?mode=advanced${search}`);
	await page.locator('.workspace[data-ready="true"]').waitFor();
};
const row = (page: Page, step: string) => page.locator(`[data-step="${step}"]`);
const choose = (page: Page, value: string) =>
	page.locator(`[data-setting="registration"] input[value="${value}"]`).check();

test.describe('how the provider learns about the app', () => {
	test('turns the hand-offs into a request when an app registers itself', async ({ page }) => {
		await openSetup(page);
		await expect(row(page, 'create-client')).toHaveCount(1);
		await choose(page, 'dcr');
		await expect(row(page, 'create-client')).toHaveCount(0);
		await expect(row(page, 'dcr-request')).toHaveCount(1);
		await expect(page).toHaveURL(/register=dcr/);
		// It does not take the people away, because a real server still wanted a token from an admin.
		await expect(row(page, 'dcr-hand-token')).toHaveCount(1);
		await expect(page.getByTestId('change-summary')).toContainText('steps added');
	});

	test('reaches the login when an app points at a document', async ({ page }) => {
		await openSetup(page);
		await choose(page, 'cimd');
		await expect(row(page, 'cimd-host')).toHaveCount(1);
		await expect(row(page, 'create-client')).toHaveCount(0);
		await page.getByRole('link', { name: 'User flow' }).click();
		await expect(row(page, 'cimd-fetch')).toHaveCount(1);
		await expect(row(page, 'consent-page')).toHaveCount(1);
	});

	test('brings what it needs along, and comes back without it', async ({ page }) => {
		await openSetup(page);
		await choose(page, 'cimd');
		await expect(page).toHaveURL(/client=public/);
		await expect(page).toHaveURL(/pkce=1/);
		await choose(page, 'manual');
		await expect(row(page, 'create-client')).toHaveCount(1);
		await expect(row(page, 'cimd-host')).toHaveCount(0);
	});

	test('says its status, on the option it is about', async ({ page }) => {
		await openSetup(page);
		await expect(page.locator('[data-flag="cimd"]')).toContainText('experimental');
	});

	test('is not offered in simple mode', async ({ page }) => {
		await page.goto(`${FLOW_PATH}setup/?mode=simple`);
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect(page.locator('[data-setting="registration"]')).toHaveCount(0);
	});
});
