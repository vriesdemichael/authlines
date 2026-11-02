import { expect, test, type Page } from '@playwright/test';
import { currentSearch, open } from './helpers.ts';

const words = (page: Page, step: string) => page.locator(`[data-step="${step}"] .label`).first();
const opacity = (page: Page, step: string) =>
	words(page, step).evaluate((label) => Number(getComputedStyle(label).opacity));
const rows = (page: Page) =>
	page
		.locator('[data-step]')
		.evaluateAll((all) =>
			all.map((row) => [row.getAttribute('data-step'), row.getBoundingClientRect().y])
		);

test.describe('showing every label', () => {
	for (const [name, diagram, here, ahead] of [
		['the flow', 'flow', 'redirect-to-idp', 'token-response'],
		['the setup', 'setup', 'hand-over-credentials', 'configure-app']
	] as const) {
		test(`gives ${name} its words, and leaves everything else as it was`, async ({ page }) => {
			await open(page, `mode=advanced&step=${here}`, diagram);
			await expect.poll(() => opacity(page, ahead)).toBe(0);
			const before = await rows(page);
			const detail = await page.locator('aside.detail h2').first().textContent();
			await page.getByTestId('every-label').check();

			await expect.poll(() => opacity(page, ahead)).toBe(1);
			await expect.poll(() => currentSearch(page)).toContain('labels=1');
			await expect.poll(() => currentSearch(page)).toContain(`step=${here}`);
			await expect(page.locator('aside.detail h2').first()).toHaveText(detail!);
			expect(await rows(page)).toEqual(before);

			await page.getByTestId('every-label').uncheck();
			await expect.poll(() => opacity(page, ahead)).toBe(0);
			expect(await rows(page)).toEqual(before);
		});
	}

	test('survives a reload, and stepping', async ({ page }) => {
		await open(page, 'labels=1&step=redirect-to-idp');
		await expect(page.getByTestId('every-label')).toBeChecked();
		await expect.poll(() => opacity(page, 'token-response')).toBe(1);
		await page.getByTestId('next').click();
		await expect.poll(() => currentSearch(page)).toContain('labels=1');
		await expect.poll(() => opacity(page, 'token-response')).toBe(1);
	});

	test('is off to begin with, and in advanced mode unless an address has it on', async ({
		page
	}) => {
		await open(page, 'mode=advanced');
		await expect(page.getByTestId('every-label')).not.toBeChecked();
		await open(page, 'mode=simple');
		await expect(page.getByTestId('every-label')).toHaveCount(0);
		await open(page, 'mode=simple&labels=1');
		await expect(page.getByTestId('every-label')).toBeChecked();
	});
});
