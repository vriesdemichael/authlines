import { expect, test, type Page } from '@playwright/test';
import { FLOW_PATH } from './helpers.ts';

const open = async (page: Page, search = '') => {
	await page.goto(`${FLOW_PATH}?mode=advanced${search}`);
	await page.locator('.workspace[data-ready="true"]').waitFor();
};
const row = (page: Page, step: string) => page.locator(`[data-step="${step}"]`);

test.describe('a stolen DPoP token (#33)', () => {
	test('is only on offer with DPoP, and brings someone else onto the diagram', async ({ page }) => {
		await open(page);
		await expect(page.locator('[data-setting="tokenThief"]')).toHaveCount(0);
		await open(page, '&binding=dpop');
		await page.locator('[data-setting="tokenThief"] input[type="checkbox"]').check();
		await expect(page).toHaveURL(/thief=1/);
		await expect(row(page, 'thief-api-request')).toHaveCount(1);
		await expect(page.locator('[data-lifeline="attacker"]')).toContainText('Someone else');
	});

	test('gets a different answer on the same arrow by what the API checks', async ({ page }) => {
		await open(page, '&binding=dpop&thief=1&step=thief-api-response');
		await expect(page.getByTestId('step-detail')).toContainText('401 invalid_token');
		await page.locator('[data-setting="apiChecks"] input[value="bearer"]').check();
		await expect(page).toHaveURL(/checks=bearer/);
		await expect(row(page, 'thief-api-response')).toHaveCount(1);
		await expect(page.getByTestId('step-detail')).toContainText('200 with the resource');
		await expect(page.getByTestId('step-detail')).toContainText('whatever checks its tokens');
	});

	test('goes when DPoP does, and takes the choice with it', async ({ page }) => {
		await open(page, '&binding=dpop&thief=1&checks=bearer');
		await page.locator('[data-setting="binding"] input[value="bearer"]').check();
		await expect(page).not.toHaveURL(/thief=1/);
		await expect(page).not.toHaveURL(/checks=bearer/);
		await expect(row(page, 'thief-api-request')).toHaveCount(0);
	});
});
