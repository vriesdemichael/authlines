import { expect, test, type Page } from '@playwright/test';
import { expectMatchesModel, open, watchForErrors } from './helpers.ts';

const row = (page: Page, id: string) => page.locator(`[data-step="${id}"]`);
const current = (page: Page) => page.locator('[data-state="current"]');
const detail = (page: Page) => page.getByTestId('step-detail');
const payload = (page: Page) => page.getByTestId('payload');
const held = (page: Page, line: string, artifact: string) =>
	page.locator(`[data-held="${line}:${artifact}"]`);
const note = (page: Page, id: string) => page.locator(`[data-note="${id}"]`);

test.describe('logging out', () => {
	test('walks from the button to what is left', async ({ page }) => {
		const check = watchForErrors(page);
		await open(page, 'oidc=1&logout=1&step=api-response');
		await expectMatchesModel(page, 'oidc=1&logout=1&step=api-response');
		for (const step of [
			'logout-start',
			'app-forgets',
			'logout-redirect',
			'end-session',
			'session-ended',
			'logout-redirect-back',
			'logged-out',
			'token-after-logout',
			'token-after-logout-response',
			'asks-after-logout',
			'introspect',
			'introspect-response',
			'asks-after-logout-response',
			'refresh-after-logout',
			'refresh-after-logout-response'
		]) {
			await page.getByTestId('next').click();
			await expect(current(page)).toHaveAttribute('data-step', step);
		}
		await expect(page.getByTestId('next')).toBeDisabled();
		check();
	});

	test('takes the session away, and leaves the tokens', async ({ page }) => {
		await open(page, 'oidc=1&logout=1&step=end-session');
		await expect(held(page, 'browser', 'session')).toBeVisible();
		await expect(held(page, 'idp', 'session')).toBeVisible();
		await page.getByTestId('next').click();
		await expect(current(page)).toHaveAttribute('data-step', 'session-ended');
		await expect(held(page, 'browser', 'session')).toHaveCount(0);
		await expect(held(page, 'idp', 'session')).toHaveCount(0);
		await expect(held(page, 'app', 'access-token')).toBeVisible();
		await expect(held(page, 'app', 'refresh-token')).toBeVisible();
		await expect(detail(page)).toContainText('The tokens are still there');
	});

	test('gives it back on the way back', async ({ page }) => {
		await open(page, 'oidc=1&logout=1&step=session-ended');
		await expect(held(page, 'browser', 'session')).toHaveCount(0);
		await page.getByTestId('back').click();
		await expect(held(page, 'browser', 'session')).toBeVisible();
	});

	test('gives the same token two answers, from real calls', async ({ page }) => {
		await open(page, 'oidc=1&logout=1&step=token-after-logout-response');
		await expect(row(page, 'token-after-logout-response')).toContainText('200 with the resource');
		await expect(payload(page)).toContainText('HTTP 200');
		await open(page, 'oidc=1&logout=1&step=introspect-response');
		await expect(payload(page)).toContainText('"active": false');
		await open(page, 'oidc=1&logout=1&step=asks-after-logout-response');
		await expect(row(page, 'asks-after-logout-response')).toContainText('401 invalid_token');
		await expect(payload(page)).toContainText('HTTP 401');
	});

	test('refuses the refresh token, as a real server said', async ({ page }) => {
		await open(page, 'oidc=1&logout=1&step=refresh-after-logout-response');
		await expect(payload(page)).toContainText('Session not active');
	});

	test('says what if the app stops at its own session, or sends no ID token', async ({ page }) => {
		await open(page, 'oidc=1&logout=1&step=app-forgets');
		await expect(page.getByTestId('step-pitfall')).toContainText('What if it stops here?');
		await open(page, 'oidc=1&logout=1&step=logout-redirect');
		const pitfall = page.getByTestId('step-pitfall');
		await expect(pitfall).toContainText('What if the app sends no ID token?');
		await pitfall.locator('summary').click();
		await expect(pitfall).toContainText('has to ask the user');
	});

	test('says where the addresses are set, in the notes', async ({ page }) => {
		await open(page, 'oidc=1&logout=1&step=logout-redirect');
		const address = note(page, 'post-logout-address');
		await address.locator('summary').click();
		await expect(address).toContainText('Valid post logout redirect URIs');
		await open(page, 'oidc=1&sso=1&logout=1&step=backchannel-logout');
		const delivery = note(page, 'backchannel-logout-url');
		await delivery.locator('summary').click();
		await expect(delivery).toContainText('Logout settings › Backchannel logout URL');
	});

	test('says why the server may not answer the app that asks', async ({ page }) => {
		await open(page, 'oidc=1&logout=1&step=introspect-response');
		const who = note(page, 'who-may-ask');
		await who.locator('summary').click();
		await expect(who).toContainText('does not name in aud');
	});

	test('needs OpenID Connect, and says so', async ({ page }) => {
		await open(page, '');
		await expect(page.locator('[data-setting="logout"] input')).toBeDisabled();
		await expect(page.locator('[data-setting="logout"]')).toContainText('OpenID Connect');
	});
});

test.describe('with a second app', () => {
	test('tells it directly, from a real delivery', async ({ page }) => {
		await open(page, 'oidc=1&sso=1&logout=1&step=backchannel-logout');
		await expect(row(page, 'backchannel-logout')).toContainText('POST logout_token');
		await expect(payload(page)).toContainText('logout_token');
		await expect(detail(page)).toContainText('registered an address');
	});

	test('still never hands the session to an app', async ({ page }) => {
		await open(page, 'oidc=1&sso=1&logout=1&step=end-session');
		await expect(held(page, 'second-app', 'session')).toHaveCount(0);
		await expect(held(page, 'app', 'session')).toHaveCount(0);
	});
});

test.describe('in simple mode', () => {
	test('stays in plain words, and the setting stays on to be removed', async ({ page }) => {
		await page.goto('authorization-code/token-after-logout/');
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect(page.getByTestId('title')).toHaveText('I logged out. Does the token still work?');
		await expect(current(page)).toHaveAttribute('data-step', 'token-after-logout-response');
		await expect(row(page, 'token-after-logout-response')).toContainText('It still works');
		await expect(payload(page)).toHaveCount(0);
		await expect(page.locator('[data-remove]').first()).toBeVisible();
	});
});

test.describe('from the map', () => {
	for (const [id, title, step] of [
		['what-log-out-does', 'What does log out actually do?', 'session-ended'],
		['logged-out-of-other-apps', 'Am I logged out of my other apps too?', 'backchannel-logout']
	]) {
		test(`${id} opens at the answer`, async ({ page }) => {
			await page.goto(`authorization-code/${id}/`);
			await page.locator('.workspace[data-ready="true"]').waitFor();
			await expect(page.getByTestId('title')).toHaveText(title);
			await expect(current(page)).toHaveAttribute('data-step', step);
		});
	}
});
