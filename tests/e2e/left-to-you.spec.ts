import { expect, test, type Page } from '@playwright/test';
import { open } from './helpers.ts';

const panel = (page: Page) => page.getByTestId('left-to-you');
const opener = (page: Page) => page.getByTestId('to-list');
const current = (page: Page) => page.locator('[data-step][data-state="current"]');

test.describe('what is left to you', () => {
	test('is one list, from any step that says something about it', async ({ page }) => {
		await open(page, 'mode=simple&oidc=1&step=token-request');
		await page.getByTestId('step-what-to-do').locator('summary').click();
		await opener(page).click();
		await expect(panel(page)).toBeVisible();
		await expect(panel(page).getByRole('heading', { level: 2 })).toBeFocused();
		await expect(page).toHaveURL(/list=1/);
		await expect(panel(page).locator('[data-group="before"]')).toContainText(
			'Before anything runs'
		);
		await expect(panel(page).locator('[data-group="app"]')).toContainText('In your app');
		await expect(panel(page).locator('[data-group="api"]')).toContainText('In your API');
		await expect(panel(page).locator('[data-group="wrong"]')).toContainText(
			'What if the address does not match?'
		);
	});

	test('says plainly what the largest part is', async ({ page }) => {
		await open(page, 'mode=simple&oidc=1&list=1');
		await expect(page.getByTestId('left-larger')).toContainText('own session');
		await expect(page.getByTestId('left-larger')).toContainText('logging out');
	});

	test('keeps its place on a reload', async ({ page }) => {
		await open(page, 'mode=simple&oidc=1&list=1');
		await page.reload();
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect(panel(page)).toBeVisible();
	});

	test('takes someone to the step, in whichever diagram it is', async ({ page }) => {
		await open(page, 'mode=simple&oidc=1&list=1');
		await panel(page).locator('[data-left="token-request"] .step').first().click();
		await expect(current(page)).toHaveAttribute('data-step', 'token-request');
		await panel(page).locator('[data-left="register-client"] .step').click();
		await expect(page.locator('.workspace')).toHaveAttribute('data-diagram', 'setup');
		await expect(current(page)).toHaveAttribute('data-step', 'register-client');
		await expect(panel(page)).toBeVisible();
	});

	test('goes with Escape or Close, back to what opened it', async ({ page }) => {
		await open(page, 'mode=advanced&oidc=1&step=token-request');
		await opener(page).click();
		await page.keyboard.press('Escape');
		await expect(panel(page)).toHaveCount(0);
		await expect(page).not.toHaveURL(/list=1/);
		await expect(opener(page)).toBeFocused();

		await opener(page).click();
		await page.getByTestId('left-close').click();
		await expect(panel(page)).toHaveCount(0);
		await expect(opener(page)).toBeFocused();
	});

	test('can be read by keyboard alone', async ({ page }) => {
		await open(page, 'mode=advanced&oidc=1&step=token-request');
		await opener(page).focus();
		await page.keyboard.press('Enter');
		await expect(panel(page).getByRole('heading', { level: 2 })).toBeFocused();
		await page.keyboard.press('Tab');
		await expect(page.getByTestId('left-close')).toBeFocused();
		await page.keyboard.press('Tab');
		await expect(panel(page).locator('.step').first()).toBeFocused();
	});

	test('follows the settings', async ({ page }) => {
		await open(page, 'mode=simple&list=1');
		await expect(panel(page).locator('[data-left="validate-id-token"]')).toHaveCount(0);
		await open(page, 'mode=simple&oidc=1&list=1');
		await expect(panel(page).locator('[data-left="validate-id-token"]').first()).toBeVisible();
	});

	test('explains a word in it, as anywhere else', async ({ page }) => {
		await open(page, 'mode=simple&oidc=1&list=1');
		await panel(page).getByRole('button', { name: 'library', exact: true }).first().click();
		await expect(page).toHaveURL(/explain=term\.library/);
	});

	test('prints as the list and nothing else', async ({ page }) => {
		await open(page, 'mode=simple&oidc=1&list=1');
		await page.emulateMedia({ media: 'print' });
		await expect(panel(page)).toBeVisible();
		await expect(panel(page).locator('[data-group="wrong"]')).toBeVisible();
		await expect(page.getByTestId('diagram')).toBeHidden();
		await expect(page.getByRole('complementary', { name: 'Settings' })).toBeHidden();
		await expect(page.getByTestId('left-close')).toBeHidden();
	});

	test('still prints the diagram when it is not open', async ({ page }) => {
		await open(page, 'mode=simple&oidc=1');
		await page.emulateMedia({ media: 'print' });
		await expect(page.getByTestId('diagram')).toBeVisible();
	});

	test('is offered to someone who says they have to add login', async ({ page }) => {
		await page.goto('authorization-code/adding-login/');
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await page.getByTestId('answer-list').click();
		await expect(panel(page)).toBeVisible();
		await expect(page).toHaveURL(/adding-login\/\?.*list=1/);
	});

	test('is not offered on a step with nothing to say about it', async ({ page }) => {
		await open(page, 'mode=simple&step=authorize');
		await expect(opener(page)).toHaveCount(0);
	});
});
