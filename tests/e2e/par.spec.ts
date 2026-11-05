import { expect, test, type Page } from '@playwright/test';
import { FLOW_PATH } from './helpers.ts';

const open = async (page: Page, search = '') => {
	await page.goto(`${FLOW_PATH}?mode=advanced${search}`);
	await page.locator('.workspace[data-ready="true"]').waitFor();
};
const row = (page: Page, step: string) => page.locator(`[data-step="${step}"]`);
const detail = (page: Page) => page.getByTestId('step-detail');

test.describe('the request pushed first (#13)', () => {
	test('pushes the request before the browser goes, and the browser carries a reference', async ({
		page
	}) => {
		await open(page);
		await page.locator('[data-setting="par"] input').check();
		await expect(page).toHaveURL(/par=1/);
		await expect(row(page, 'push-request')).toHaveCount(1);
		await expect(row(page, 'push-response')).toHaveCount(1);
		await expect(page.locator('[data-chip="authorize:request_uri"]')).toBeVisible();
		await expect(page.locator('[data-chip^="authorize:redirect_uri"]')).toHaveCount(0);
	});

	test('leaves the browser holding the reference, and never the challenge', async ({ page }) => {
		await open(page, '&par=1&client=public&pkce=1&step=token-response');
		const held = page.locator('[data-lifeline="browser"] [data-artifact]');
		await expect(held.filter({ hasText: 'request URI' })).toBeVisible();
		await expect(held.filter({ hasText: 'challenge' })).toHaveCount(0);
	});

	test('shows what a real server answered the push with', async ({ page }) => {
		await open(page, '&par=1&step=push-response');
		await expect(page.getByTestId('payload')).toContainText('urn:ietf:params:oauth:request_uri:');
		await expect(detail(page)).toContainText(
			'Lifetime of the Request URI for Pushed Authorization Request'
		);
	});

	test('is not on offer with another provider, and says why', async ({ page }) => {
		await open(page, '&broker=1');
		await expect(page.locator('[data-setting="par"] input')).toBeDisabled();
		await expect(page.locator('[data-setting="par"]')).toContainText(
			'Drawn so far with nothing else on but'
		);
	});

	test('has a question of its own, which opens where the answer is', async ({ page }) => {
		await page.goto('authorization-code/pushed-first/');
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect(page.locator('[data-state="current"]')).toHaveAttribute('data-step', 'authorize');
		await expect(row(page, 'push-request')).toHaveCount(1);
	});
});
