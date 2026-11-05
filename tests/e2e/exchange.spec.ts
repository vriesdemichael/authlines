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

// #185: a refresh token from the trade, so the API can keep going without the user.
test.describe('a refresh token from the trade', () => {
	test('is a choice that only comes with token exchange, and adds the API keeping going', async ({
		page
	}) => {
		await open(page);
		await expect(page.locator('[data-setting="exchangeGives"]')).toHaveCount(0);
		await page.locator('[data-setting="exchange"] input').check();
		await page.locator('[data-setting="exchangeGives"] input[value="refresh"]').check();
		await expect(page).toHaveURL(/trade=refresh/);
		for (const step of ['trade-runs-out', 'trade-refresh-request', 'trade-refresh-response']) {
			await expect(row(page, step)).toHaveCount(1);
		}
		await expect(page.getByTestId('timeline')).toContainText('Keep going');
	});

	test('shows what a real server sent, and says what ends it', async ({ page }) => {
		await open(page, '&exchange=1&trade=refresh&step=exchange-response');
		await expect(page.getByTestId('payload')).toContainText(
			'urn:ietf:params:oauth:token-type:refresh_token'
		);
		await open(page, '&exchange=1&trade=refresh&step=trade-refresh-request');
		await expect(page.getByTestId('payload')).toContainText('grant_type=refresh_token');
		await detail(page).getByText('What ends it?').click();
		await expect(detail(page)).toContainText('Session not active');
		await expect(detail(page)).toContainText('Allow refresh token in Standard Token Exchange');
	});
});
