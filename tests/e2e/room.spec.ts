import { expect, test, type Page } from '@playwright/test';
import { open } from './helpers.ts';

// The named state with the most rows there is, and a test holds the rest to fitting too.
const LONGEST = 'mode=advanced&oidc=1&sso=1&logout=1&step=token-request';
const wholeButton = (page: Page) => page.getByTestId('whole-flow');
const large = (page: Page) => page.getByTestId('raw-large');
const stepAt = (page: Page) => page.locator('[data-state="current"]');

test.describe('in front of a room, the whole flow', () => {
	test('fits on a small projector, every row, with one control', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 });
		await open(page, LONGEST);
		await wholeButton(page).click();
		await expect(page).toHaveURL(/whole=1/);
		await expect(page.getByTestId('diagram')).toHaveAttribute('data-animating', 'false');
		await expect
			.poll(() =>
				page
					.locator('.scroller')
					.evaluate((scroller) => scroller.scrollHeight <= scroller.clientHeight + 1)
			)
			.toBe(true);
		const rows = page.locator('[data-step]');
		const count = await rows.count();
		expect(count).toBeGreaterThan(30);
		await expect(rows.last()).toBeInViewport();
		await expect(rows.first()).toBeInViewport();
	});

	test('has words that can be read, not just a shape', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 });
		await open(page, `${LONGEST}&whole=1`);
		const heights = await page
			.locator('[data-step] .label')
			.evaluateAll((labels) =>
				labels.map((label) => Number.parseFloat(getComputedStyle(label).fontSize))
			);
		expect(heights.length).toBeGreaterThan(20);
		expect(Math.min(...heights)).toBeGreaterThanOrEqual(11);
	});

	test('has the words for what is still to come, because the whole shape is the point', async ({
		page
	}) => {
		await open(page, 'mode=simple&whole=1&step=open-app');
		const ahead = page.locator('[data-step="token-request"] .label').first();
		await expect(ahead).toContainText('trades the code');
		const opacity = await ahead.evaluate((label) => getComputedStyle(label).opacity);
		expect(Number(opacity)).toBeGreaterThan(0.5);
		await page.getByTestId('whole-flow').click();
		await expect(page).not.toHaveURL(/whole=1/);
		await expect(ahead).toHaveCSS('opacity', '0');
	});

	test('gives the diagram the room, and keeps the way to move through it', async ({ page }) => {
		await open(page, 'mode=simple&whole=1');
		await expect(page.getByRole('complementary', { name: 'Settings' })).toBeHidden();
		await expect(page.getByRole('complementary', { name: 'The current step' })).toBeHidden();
		await expect(page.getByTestId('next')).toBeVisible();
		await page.getByTestId('next').click();
		await expect(stepAt(page)).toHaveAttribute('data-step', 'redirect-to-idp');
	});

	test('keeps its place on a reload', async ({ page }) => {
		await open(page, 'mode=simple&whole=1&step=authorize');
		await page.reload();
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect(page.getByRole('complementary', { name: 'Settings' })).toBeHidden();
		await expect(stepAt(page)).toHaveAttribute('data-step', 'authorize');
	});

	test('a clicker goes on working', async ({ page }) => {
		await open(page, 'mode=simple&whole=1');
		await page.keyboard.press('PageDown');
		await expect(stepAt(page)).toHaveAttribute('data-step', 'redirect-to-idp');
		await page.keyboard.press('PageUp');
		await expect(stepAt(page)).toHaveAttribute('data-step', 'open-app');
	});

	test('goes back with Escape, or the same button', async ({ page }) => {
		await open(page, 'mode=advanced&whole=1');
		await page.keyboard.press('Escape');
		await expect(page).not.toHaveURL(/whole=1/);
		await expect(page.getByRole('complementary', { name: 'The current step' })).toBeVisible();

		await wholeButton(page).click();
		await expect(page).toHaveURL(/whole=1/);
		await wholeButton(page).click();
		await expect(page).not.toHaveURL(/whole=1/);
	});

	test('is not a page of its own, so a step can still be chosen on it', async ({ page }) => {
		await open(page, 'mode=simple&whole=1');
		await page.locator('[data-step="token-request"]').click();
		await expect(stepAt(page)).toHaveAttribute('data-step', 'token-request');
		await expect(page).toHaveURL(/whole=1/);
	});
});

test.describe('in front of a room, raw traffic', () => {
	test('can be read large, with whole values', async ({ page }) => {
		await open(page, 'mode=advanced&step=token-response');
		await page.getByTestId('read-large').click();
		await expect(large(page)).toBeVisible();
		await expect(page).toHaveURL(/raw=1/);

		const size = await large(page)
			.locator('.raw')
			.evaluate((raw) => Number.parseFloat(getComputedStyle(raw).fontSize));
		expect(size).toBeGreaterThanOrEqual(16);

		const token = large(page).locator('button.long[data-artifact="access-token"]');
		await expect(token).toHaveClass(/open/);
		const shows = await token.evaluate((value) => value.scrollWidth <= value.clientWidth + 1);
		expect(shows).toBe(true);
	});

	test('is wider than the panel it came from', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 });
		await open(page, 'mode=advanced&step=token-response&raw=1');
		const box = await large(page).boundingBox();
		expect(box?.width).toBeGreaterThan(700);
	});

	test('keeps its place on a reload', async ({ page }) => {
		await open(page, 'mode=advanced&step=token-response&raw=1');
		await page.reload();
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect(large(page)).toBeVisible();
	});

	test('a clicker moves through the messages, and it follows', async ({ page }) => {
		await open(page, 'mode=advanced&step=token-request&raw=1');
		await expect(large(page)).toContainText('grant_type');
		await page.keyboard.press('PageDown');
		await expect(stepAt(page)).toHaveAttribute('data-step', 'token-response');
		await expect(large(page)).toContainText('access_token');
	});

	test('says so on a step with nothing on the wire', async ({ page }) => {
		await open(page, 'mode=advanced&step=api-check-token&raw=1');
		await expect(large(page)).toContainText('Nothing goes over the wire');
	});

	test('goes with Escape, and is not there in simple mode', async ({ page }) => {
		await open(page, 'mode=advanced&step=token-response&raw=1');
		await page.keyboard.press('Escape');
		await expect(large(page)).toHaveCount(0);
		await expect(page).not.toHaveURL(/raw=1/);
		await open(page, 'mode=simple&step=token-response&raw=1');
		await expect(large(page)).toHaveCount(0);
	});
});
