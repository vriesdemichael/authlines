import { expect, test, type Page } from '@playwright/test';
import { FLOW_PATH, open } from './helpers.ts';

const term = (page: Page, id: string) => page.locator(`[data-term="${id}"]`).first();
const explanation = (page: Page) => page.getByTestId('explanation');

test.describe('a word on screen', () => {
	test('can be selected, and says what it means', async ({ page }) => {
		await open(page, 'mode=simple&step=authorize');
		await term(page, 'identity-provider').click();
		await expect(explanation(page)).toContainText('logs users in');
		await expect(page.getByTestId('explanation-also-called')).toContainText('authorization server');
		await expect(page).toHaveURL(/explain=term\.identity-provider/);
	});

	test('is only marked the first time on a step', async ({ page }) => {
		await open(page, 'mode=simple&step=token-response');
		const marks = await page
			.locator('[data-term]')
			.evaluateAll((all) => all.map((mark) => mark.getAttribute('data-term')));
		expect(new Set(marks).size).toBe(marks.length);
	});

	test('lights up where it is, when that is on screen', async ({ page }) => {
		await open(page, 'mode=simple&step=authorize');
		await term(page, 'identity-provider').click();
		await expect(page.locator('[data-lifeline="idp"]')).toHaveClass(/lit/);
		await expect(page.getByTestId('explanation-see-it')).toHaveCount(0);
	});

	test('links to where it is, when that is not on screen', async ({ page }) => {
		await open(page, 'mode=simple&explain=term.consent');
		await expect(page.locator('[data-step="consent-page"]')).toHaveCount(0);
		await page.getByTestId('explanation-see-it').click();
		await expect(page.locator('[data-step="consent-page"]')).toHaveClass(/lit/);
		await expect(page.locator('[data-state="current"]')).toHaveAttribute(
			'data-step',
			'consent-page'
		);
	});

	test('works by keyboard, and comes back the same from its address', async ({ page }) => {
		await open(page, 'mode=simple&step=authorize');
		await term(page, 'redirect-uri').or(term(page, 'identity-provider')).first().focus();
		await page.keyboard.press('Enter');
		await expect(explanation(page)).toBeVisible();
		await expect(page).toHaveURL(/explain=term\./);
		const url = page.url();
		await page.goto(url);
		await expect(explanation(page)).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(explanation(page)).toHaveCount(0);
	});

	test('in an answer can be selected too', async ({ page }) => {
		await page.goto(`${FLOW_PATH}who-logged-in/`);
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await page.getByTestId('answer').locator('[data-term="openid-connect"]').click();
		await expect(explanation(page)).toContainText('tells the app who logged in');
	});

	test('reads as plain text when printed', async ({ page }) => {
		await open(page, 'mode=simple&step=authorize');
		await page.emulateMedia({ media: 'print' });
		const mark = term(page, 'identity-provider');
		const decoration = await mark.evaluate(
			(element) => getComputedStyle(element).textDecorationLine
		);
		expect(decoration).toBe('none');
	});
});

test.describe('how to read the diagram', () => {
	test('is there on both diagrams, and every part lights up', async ({ page }) => {
		for (const diagram of ['flow', 'setup'] as const) {
			await open(page, 'mode=simple', diagram);
			await page.getByTestId('how-to-read').click();
			const parts = page.getByTestId('explanation-parts').getByRole('button');
			const count = await parts.count();
			expect(count).toBeGreaterThan(5);
			for (let i = 0; i < count; i++) {
				const part = page.getByTestId('explanation-parts').getByRole('button').nth(i);
				const id = await part.getAttribute('data-part');
				await part.click();
				await expect(page.getByTestId('diagram')).toHaveAttribute('data-lit', id!);
				await expect(explanation(page).locator('p').first()).not.toBeEmpty();
			}
		}
	});

	test('a part that names colour or shape changes what is drawn', async ({ page }) => {
		await open(page, 'mode=simple&step=api-response');
		const width = () =>
			page
				.locator('.row.request:not(.future) line')
				.first()
				.evaluate((line) => getComputedStyle(line).strokeWidth);
		const before = await width();
		await page.getByTestId('how-to-read').click();
		await page.locator('[data-part="part-arrow"]').click();
		expect(await width()).not.toBe(before);
	});
});

test.describe('Keycloak', () => {
	test('is defined where it is first named', async ({ page }) => {
		await page.goto('./');
		await expect(page.getByTestId('source-link')).toContainText(
			'a free identity provider you can run yourself'
		);
		await open(page, 'mode=advanced');
		await page.getByTestId('server-notes-quick').click();
		await expect(explanation(page)).toContainText('A free identity provider');
		await expect(explanation(page)).toContainText('the same on other identity providers');
	});

	test('can be left out from there, and then cannot be asked about', async ({ page }) => {
		await open(page, 'mode=simple&explain=term.keycloak');
		await page.getByTestId('leave-out-server').click();
		await expect(page).toHaveURL(/keycloak=off/);
		await expect(explanation(page)).toHaveCount(0);
		await open(page, 'mode=simple&keycloak=off&explain=term.keycloak');
		await expect(explanation(page)).toHaveCount(0);
		await expect(page.locator('body')).not.toContainText('Keycloak');
	});
});
