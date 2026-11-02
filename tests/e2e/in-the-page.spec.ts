import { expect, test } from '@playwright/test';
import { FLOW_PATH, open } from './helpers.ts';

const lifeline = (id: string) => `[data-lifeline="${id}"]`;

test.describe('an app that runs in the page', () => {
	test('is one question in simple mode, and the app joins the browser', async ({ page }) => {
		await open(page, 'mode=simple&step=token-response');
		await expect(page.locator(lifeline('app'))).toHaveCount(1);
		await page.locator('[data-setting="appRuns"] input[value="page"]').check();
		await expect(page).toHaveURL(/runs=page/);
		await expect(page.locator(lifeline('app'))).toHaveCount(0);
		await expect(page.locator(lifeline('browser'))).toContainText('Browser and app');
		// Nobody asked for a public client, so there is no chip to take it off with.
		await expect(page.locator('[data-remove="clientType"]')).toHaveCount(0);
	});

	test('goes back, with the secret back too', async ({ page }) => {
		await open(page, 'mode=simple&runs=page&client=public&pkce=1');
		await page.locator('[data-setting="appRuns"] input[value="server"]').check();
		await expect(page.locator(lifeline('app'))).toHaveCount(1);
		await expect(page).not.toHaveURL(/runs=/);
		await expect(page).not.toHaveURL(/client=public/);
	});

	test('shows the tokens under the browser, from a real page', async ({ page }) => {
		await open(page, 'mode=advanced&runs=page&client=public&pkce=1&step=token-response');
		const held = page.locator('[data-holdings="browser"], [data-lifeline="browser"]').first();
		await expect(held).toBeVisible();
		await expect(page.locator('[data-chip-holder="browser"], .lane-head').first()).toBeVisible();
		await expect(page.getByTestId('payload')).toContainText('access-control-allow-origin');
		await expect(page.getByTestId('payload-origin')).not.toContainText('standing in');
	});

	test('sends the token request with where it came from', async ({ page }) => {
		await open(page, 'mode=advanced&runs=page&client=public&pkce=1&step=token-request');
		await expect(page.getByTestId('payload')).toContainText('origin');
		await expect(page.locator('[data-state="current"]')).toHaveAttribute('data-channel', 'front');
	});

	test('still has an address for the question about it', async ({ page }) => {
		await page.goto(`${FLOW_PATH}browser-app/`);
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect(page.locator(lifeline('app'))).toHaveCount(0);
	});
});
