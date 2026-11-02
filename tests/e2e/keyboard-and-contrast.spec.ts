import { expect, test, type Locator, type Page } from '@playwright/test';
import { FLOW_PATH, open } from './helpers.ts';

const background = (locator: Locator) =>
	locator.evaluate((element) => getComputedStyle(element).backgroundColor);
const focusIsLost = (page: Page) => page.evaluate(() => document.activeElement === document.body);

test.describe('with forced colours', () => {
	test.use({ forcedColors: 'active' });
	test.skip(({ browserName }) => browserName === 'webkit', 'WebKit cannot emulate this');

	test('a switch looks different on and off', async ({ page }) => {
		await open(page, 'oidc=1');
		const on = await background(page.getByRole('checkbox', { name: /OpenID Connect/ }));
		const off = await background(page.getByRole('checkbox', { name: /PKCE/ }));
		expect(on).not.toBe(off);
	});

	test('the selected mode looks different', async ({ page }) => {
		await open(page, '');
		const selected = await background(page.locator('[data-mode="advanced"]'));
		const other = await background(page.locator('[data-mode="simple"]'));
		expect(selected).not.toBe(other);
	});

	test('the selected diagram looks different', async ({ page }) => {
		await open(page, '');
		const tabs = page.getByTestId('diagram-switch');
		const selected = await background(tabs.locator('[data-diagram="flow"]'));
		const other = await background(tabs.locator('[data-diagram="setup"]'));
		expect(selected).not.toBe(other);
	});

	test('progress is still there', async ({ page }) => {
		await open(page, 'step=token-request');
		const timeline = page.getByTestId('timeline');
		await expect(timeline).toBeVisible();
		const looks = (tick: string) =>
			timeline
				.locator(`[data-tick="${tick}"]`)
				.evaluate((element) => getComputedStyle(element).background);
		expect(await looks('open-app')).not.toBe(await looks('api-request'));
	});
});

test.describe('the keyboard stays somewhere sensible', () => {
	test('Next at the last step keeps the focus', async ({ page }) => {
		await open(page, '');
		await page.keyboard.press('End');
		await page.keyboard.press('ArrowLeft');
		const next = page.getByTestId('next');
		await next.focus();
		await page.keyboard.press('Enter');
		await expect(next).toHaveAttribute('aria-disabled', 'true');
		await expect(next).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(next).toBeFocused();
	});

	test('Back at the first step keeps the focus', async ({ page }) => {
		await open(page, 'step=redirect-to-idp');
		const back = page.getByTestId('back');
		await back.focus();
		await page.keyboard.press('Enter');
		await expect(back).toHaveAttribute('aria-disabled', 'true');
		await expect(back).toBeFocused();
	});

	test('Next at the end of a question stays, and never leaves it', async ({
		page,
		browserName
	}) => {
		await page.goto(`${FLOW_PATH}how-access-works/`);
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await page.keyboard.press('End');
		await page.keyboard.press('ArrowLeft');
		const next = page.getByTestId('next');
		await expect(page.getByTestId('next-question')).toHaveCount(0);
		const where = await next.boundingBox();
		await next.focus();
		await page.keyboard.press('Enter');
		await expect(next).toHaveAttribute('aria-disabled', 'true');
		await expect(next).toHaveText('Next');
		await expect(next).toBeFocused();
		expect(await next.boundingBox()).toEqual(where);
		await expect(page.getByTestId('next-question')).toBeVisible();
		for (const key of ['Enter', 'Enter', 'PageDown', 'ArrowRight']) {
			await page.keyboard.press(key);
		}
		await expect(page).toHaveURL(/how-access-works/);
		await expect(next).toBeFocused();
		// WebKit leaves links out of Tab unless someone has asked for them.
		if (browserName !== 'webkit') {
			await page.keyboard.press('Tab');
			await expect(page.getByTestId('next-question')).toBeFocused();
		}
	});

	test('turning off a setting left on goes to the next one, then the panel', async ({ page }) => {
		await open(page, 'mode=simple&binding=dpop&client=public');
		await page.locator('[data-remove]').first().focus();
		await page.keyboard.press('Enter');
		await expect(page.locator('[data-remove]')).toHaveCount(1);
		await expect(page.locator('[data-remove]').first()).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(page.locator('[data-remove]')).toHaveCount(0);
		expect(await focusIsLost(page)).toBe(false);
	});

	test('switching diagram keeps the focus on the switch', async ({ page }) => {
		await open(page, '');
		const setup = page.getByTestId('diagram-switch').locator('[data-diagram="setup"]');
		await setup.focus();
		await page.keyboard.press('Enter');
		await expect(page).toHaveURL(/setup\//);
		await expect(setup).toBeFocused();
	});

	test('the first press of Tab offers the way to the controls', async ({ page }) => {
		await open(page, '');
		await page.keyboard.press('Tab');
		const skip = page.getByTestId('skip-to-controls');
		await expect(skip).toBeFocused();
		await expect(skip).toBeInViewport();
		await page.keyboard.press('Enter');
		await expect(page.getByTestId('next')).toBeFocused();
	});

	test('a decoded token can be scrolled with the keyboard', async ({ page }) => {
		await page.goto(`${FLOW_PATH}what-is-in-my-token/`);
		await page.locator('.workspace[data-ready="true"]').waitFor();
		const token = page.getByTestId('jwt').first();
		await token.locator('summary').click();
		const claims = token.locator('pre').last();
		await claims.focus();
		await expect(claims).toBeFocused();
	});
});
