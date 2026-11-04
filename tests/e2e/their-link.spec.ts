import { expect, test, type Page } from '@playwright/test';
import { FLOW_PATH } from './helpers.ts';

const open = async (page: Page, search = '') => {
	await page.goto(`${FLOW_PATH}?mode=advanced${search}`);
	await page.locator('.workspace[data-ready="true"]').waitFor();
};
const row = (page: Page, step: string) => page.locator(`[data-step="${step}"]`);
const detail = (page: Page) => page.getByTestId('step-detail');

test.describe('a login link of theirs (#33)', () => {
	test('is only on offer with an attacker, and then the app has no part in it', async ({
		page
	}) => {
		await open(page);
		await expect(page.locator('[data-setting="attackerGets"]')).toHaveCount(0);
		await open(page, '&attacker=1');
		await page.locator('[data-setting="attackerGets"] input[value="link"]').check();
		await expect(page).toHaveURL(/gets=link/);
		await expect(row(page, 'attacker-makes-link')).toHaveCount(1);
		await expect(row(page, 'open-app')).toHaveCount(0);
		await expect(row(page, 'callback')).toHaveCount(0);
		await expect(page.locator('[data-lifeline="attacker"]')).toContainText('Someone else');
	});

	test('is refused at the start, until the app registered *', async ({ page }) => {
		await open(page, '&attacker=1&gets=link&step=authorize');
		await expect(row(page, 'address-refused')).toHaveCount(1);
		await expect(row(page, 'login-page')).toHaveCount(0);
		await page.locator('[data-setting="registered"] input[value="any"]').check();
		await expect(page).toHaveURL(/registered=any/);
		await expect(row(page, 'address-refused')).toHaveCount(0);
		await expect(row(page, 'login-page')).toHaveCount(1);
		await expect(row(page, 'code-to-attacker')).toHaveCount(1);
	});

	test('is not stopped by PKCE, and a secret only stops the trade', async ({ page }) => {
		const trade = '&attacker=1&gets=link&registered=any&step=attacker-token-response';
		await open(page, `${trade}&client=public&pkce=1`);
		await expect(detail(page)).toContainText('200 with tokens');
		await expect(detail(page)).toContainText('PKCE and all');
		await open(page, trade);
		await expect(detail(page)).toContainText('401 unauthorized_client');
		await expect(detail(page)).toContainText(/code still went to them/);
	});

	test('takes handing the code to the real app off the table', async ({ page }) => {
		await open(page, '&attacker=1&uses=real-app');
		await page.locator('[data-setting="attackerGets"] input[value="link"]').check();
		await expect(page).toHaveURL(/gets=link/);
		await expect(page).not.toHaveURL(/uses=real-app/);
		await expect(page.locator('[data-setting="attackerUses"]')).toHaveCount(0);
	});

	test('shows the * in the setup', async ({ page }) => {
		await page.goto(
			`${FLOW_PATH}setup/?mode=advanced&attacker=1&gets=link&registered=any&step=register-client`
		);
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect(detail(page)).toContainText('redirect_uris=*');
	});
});
