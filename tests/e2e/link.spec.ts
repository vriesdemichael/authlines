import { expect, test, type Page } from '@playwright/test';
import { FLOW_PATH } from './helpers.ts';

const open = async (page: Page, search = '') => {
	await page.goto(`${FLOW_PATH}?mode=advanced${search}`);
	await page.locator('.workspace[data-ready="true"]').waitFor();
};
const row = (page: Page, step: string) => page.locator(`[data-step="${step}"]`);

// #179: logged in, the user links an account at another provider.
test.describe('linking another account', () => {
	test('is a choice in advanced mode, and brings the other provider onto the diagram', async ({
		page
	}) => {
		await open(page);
		await page.locator('[data-setting="linkAccount"] input[type="checkbox"]').check();
		await expect(page).toHaveURL(/link=1/);
		await expect(page.locator('[data-lifeline="upstream"]')).toHaveCount(1);
		for (const step of ['link-ask', 'link-confirm-page', 'link-upstream-sign-in', 'link-store']) {
			await expect(row(page, step)).toHaveCount(1);
		}
		await expect(page.getByTestId('timeline')).toContainText('Link');
	});

	test('shows what a real server sent back, and where it kept the tokens', async ({ page }) => {
		await open(page, '&link=1&step=link-done');
		await expect(page.getByTestId('payload')).toContainText('kc_action_status=success');
		await expect(
			page.locator('[data-lifeline="idp"] [data-artifact="upstream-token"]')
		).toBeAttached();
		await expect(
			page.locator('[data-lifeline="app"] [data-artifact="upstream-token"]')
		).toHaveCount(0);
	});

	test('goes back to the app when the user cancels', async ({ page }) => {
		await open(page, '&link=1&linkends=cancelled&step=link-done');
		await expect(page.getByTestId('payload')).toContainText('kc_action_status=cancelled');
		await expect(row(page, 'link-to-upstream')).toHaveCount(0);
	});

	test('is found by the words someone brings', async ({ page }) => {
		await page.goto('./');
		await page.getByTestId('open-search').click();
		for (const words of ['link account', 'connect account', 'account linking']) {
			await page.getByTestId('search-input').fill(words);
			await expect(
				page.getByTestId('search').locator('[data-result]').first(),
				words
			).toBeVisible();
			await expect(page.getByTestId('search'), words).toContainText('link');
		}
	});
});
