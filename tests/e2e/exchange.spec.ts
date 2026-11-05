import { expect, test, type Page } from '@playwright/test';
import { FLOW_PATH } from './helpers.ts';

const open = async (page: Page, search = '') => {
	await page.goto(`${FLOW_PATH}?mode=advanced${search}`);
	await page.locator('.workspace[data-ready="true"]').waitFor();
};
const row = (page: Page, step: string) => page.locator(`[data-step="${step}"]`);
const detail = (page: Page) => page.getByTestId('step-detail');

test.describe('an API that trades the token (#13)', () => {
	test('brings the second API onto the diagram, and the trade before it', async ({ page }) => {
		await open(page);
		await page.locator('[data-setting="exchange"] input').check();
		await expect(page).toHaveURL(/exchange=1/);
		await expect(page.locator('[data-lifeline="second-api"]')).toHaveCount(1);
		for (const step of [
			'exchange-request',
			'exchange-response',
			'second-api-request',
			'second-api-response'
		]) {
			await expect(row(page, step)).toHaveCount(1);
		}
	});

	test('leaves the second API with the exchanged token, and not the app’s', async ({ page }) => {
		await open(page, '&exchange=1&step=api-response');
		const held = page.locator('[data-lifeline="second-api"] [data-artifact]');
		await expect(held.filter({ hasText: 'exchanged' })).toBeVisible();
		await expect(
			page.locator('[data-lifeline="second-api"] [data-artifact="access-token"]')
		).toHaveCount(0);
	});

	test('shows what a real server answered the trade with', async ({ page }) => {
		await open(page, '&exchange=1&step=exchange-response');
		await expect(page.getByTestId('payload')).toContainText(
			'urn:ietf:params:oauth:token-type:access_token'
		);
		await expect(detail(page)).toContainText('Client scopes');
	});

	test('says where the switch is, with the flag it needs', async ({ page }) => {
		await open(page, '&exchange=1&step=exchange-request');
		await expect(detail(page)).toContainText('Standard Token Exchange');
		await expect(page.locator('[data-flag="token-exchange-standard:v2"]').first()).toBeAttached();
	});

	test('is not on offer with another provider, and says why', async ({ page }) => {
		await open(page, '&broker=1');
		await expect(page.locator('[data-setting="exchange"] input')).toBeDisabled();
		await expect(page.locator('[data-setting="exchange"]')).toContainText(
			'Drawn so far with nothing else on but'
		);
	});

	test('has a question of its own, which opens where the answer is', async ({ page }) => {
		await page.goto('authorization-code/passed-on/');
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect(page.locator('[data-state="current"]')).toHaveAttribute(
			'data-step',
			'exchange-request'
		);
		await expect(page.locator('[data-lifeline="second-api"]')).toHaveCount(1);
	});
});
