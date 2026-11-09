import { expect, test, type Page } from '@playwright/test';
import { FLOW_PATH } from './helpers.ts';

// A short explanation where the pointer rests, or the keyboard is (the maintainer, 2026-11-10), that
// does not ask for attention when the pointer only passes over.
const open = async (page: Page, search = '') => {
	await page.goto(`${FLOW_PATH}?${search}`);
	await page.locator('.workspace[data-ready="true"]').waitFor();
};
const hint = (page: Page) => page.getByTestId('hint');

test.describe('a hint', () => {
	test.use({ viewport: { width: 1440, height: 900 } });

	test('shows nothing while the pointer only passes over a word', async ({ page }) => {
		await open(page, 'step=redirect-to-idp');
		const word = page.locator('aside.detail button.term').first();
		await word.hover();
		await page.mouse.move(0, 0);
		await page.waitForTimeout(800);
		await expect(hint(page)).toBeHidden();
	});

	test('says what a word is once the pointer rests on it, and goes when it leaves', async ({
		page
	}) => {
		await open(page, 'step=redirect-to-idp');
		const word = page.locator('aside.detail button.term[data-term="identity-provider"]').first();
		await word.hover();
		await expect(hint(page)).toBeVisible();
		await expect(hint(page)).toContainText('.');
		await expect(word).toHaveAttribute('aria-describedby', /hint/);
		await page.mouse.move(0, 0);
		await expect(hint(page)).toBeHidden();
	});

	test('is on the diagram too: a party, a chip, and a part of the timeline', async ({ page }) => {
		await open(page, 'oidc=1&step=token-response');
		// On its name, above the chips under it, which have hints of their own.
		await page.locator('[data-lifeline="idp"]').hover({ position: { x: 30, y: 12 } });
		await expect(hint(page)).toBeVisible();
		// Keeps what already described the head, and adds itself.
		await expect(page.locator('[data-lifeline="idp"]')).toHaveAttribute(
			'aria-describedby',
			/seen-idp hint/
		);
		await page.mouse.move(0, 0);
		await page.locator('[data-chip][data-artifact="id-token"]').first().hover();
		await expect(hint(page)).toContainText('who');
		await page.mouse.move(0, 0);
		await page.locator('[data-part="Trade"]').hover();
		await expect(hint(page)).toContainText('trade');
	});

	test('comes at once by the keyboard, and Escape takes it away', async ({ page }) => {
		await open(page, 'step=redirect-to-idp');
		const word = page.locator('aside.detail button.term').first();
		await word.focus();
		await page.keyboard.press('Shift+Tab');
		await page.keyboard.press('Tab');
		await expect(hint(page)).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(hint(page)).toBeHidden();
	});

	test('gives way to the full explanation when the word is clicked', async ({ page }) => {
		await open(page, 'step=redirect-to-idp');
		const word = page.locator('aside.detail button.term[data-term="identity-provider"]').first();
		await word.hover();
		await expect(hint(page)).toBeVisible();
		await word.click();
		await expect(page.getByTestId('explanation')).toBeVisible();
		await expect(hint(page)).toBeHidden();
	});
});
