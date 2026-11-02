import { expect, test, type Page } from '@playwright/test';
import { expectMatchesModel, lifelineIds, open, watchForErrors } from './helpers.ts';

const row = (page: Page, id: string) => page.locator(`[data-step="${id}"]`);
const current = (page: Page) => page.locator('[data-state="current"]');
const detail = (page: Page) => page.getByTestId('step-detail');
const payload = (page: Page) => page.getByTestId('payload');
const held = (page: Page, line: string, artifact: string) =>
	page.locator(`[data-held="${line}:${artifact}"]`);
const choice = (page: Page, value: string) =>
	page.locator(`[data-setting="ssoAsks"] input[value="${value}"]`);

test.describe('a second app', () => {
	test('walks the login with the login missing', async ({ page }) => {
		const check = watchForErrors(page);
		await open(page, 'sso=1&oidc=1&step=api-response');
		await expectMatchesModel(page, 'sso=1&oidc=1&step=api-response');
		expect(await lifelineIds(page)).toContain('second-app');
		for (const step of [
			'second-open-app',
			'second-redirect-to-idp',
			'second-authorize',
			'idp-recognises',
			'second-redirect-with-code',
			'second-callback',
			'second-token-request',
			'second-token-response'
		]) {
			await page.getByTestId('next').click();
			await expect(current(page)).toHaveAttribute('data-step', step);
		}
		check();
	});

	test('shows who has the session, and that neither app does', async ({ page }) => {
		await open(page, 'sso=1&oidc=1&step=second-token-response');
		await expect(row(page, 'second-token-response')).toBeAttached();
		await expect(held(page, 'browser', 'session')).toBeVisible();
		await expect(held(page, 'idp', 'session')).toBeVisible();
		await expect(held(page, 'app', 'session')).toHaveCount(0);
		await expect(held(page, 'second-app', 'session')).toHaveCount(0);
	});

	test('sends the cookie the login set, recorded from a real run', async ({ page }) => {
		await open(page, 'sso=1&oidc=1&step=redirect-with-code');
		await expect(payload(page)).toContainText(/set-cookie/i);
		await open(page, 'sso=1&oidc=1&step=second-authorize');
		await expect(payload(page)).toContainText(/cookie: KEYCLOAK_IDENTITY/i);
		await expect(payload(page).locator('[data-from="redirect-with-code"]')).toBeAttached();
	});

	test('explains the session, wherever it is selected', async ({ page }) => {
		await open(page, 'mode=simple&sso=1&oidc=1&step=idp-recognises');
		await expect(detail(page)).toContainText('single sign-on');
		await held(page, 'browser', 'session').click();
		await expect(page.getByTestId('explanation')).toContainText('no app ever sees it');
	});

	test('has a note on how long the session lasts, and where it is set', async ({ page }) => {
		await open(page, 'sso=1&oidc=1&step=idp-recognises');
		const note = page.locator('[data-note="sso-session-max"]');
		await note.locator('summary').click();
		await expect(note).toContainText('Realm settings › Sessions › SSO Session Max');
	});
});

test.describe('what the second app asks for', () => {
	test('turning off the insisting takes the login away, as a visible change', async ({ page }) => {
		await open(page, 'sso=1&oidc=1&second=insists&step=second-redirect-with-code');
		await expect(row(page, 'second-login-page')).toBeAttached();
		await expect(row(page, 'second-submit-credentials')).toBeAttached();
		await choice(page, 'remembered').check();
		await expect(page.getByTestId('change-summary')).toContainText('removed');
		await expect(row(page, 'second-login-page')).toHaveCount(0);
		await expect(row(page, 'second-submit-credentials')).toHaveCount(0);
		await expectMatchesModel(page, 'sso=1&oidc=1&step=second-redirect-with-code');
	});

	test('insisting shows the form though it knows the browser', async ({ page }) => {
		await open(page, 'sso=1&oidc=1&second=insists&step=second-authorize');
		await expect(payload(page)).toContainText('prompt');
		await expect(payload(page)).toContainText(/cookie: KEYCLOAK_IDENTITY/i);
		await expect(row(page, 'idp-recognises')).toContainText('Session, but the app insists');
	});

	test('in a new browser, it says login_required, with no code and no tokens', async ({ page }) => {
		await open(page, 'sso=1&oidc=1&second=fresh&step=second-redirect-with-code');
		await expect(row(page, 'second-redirect-with-code')).toContainText('error=login_required');
		await expect(payload(page)).toContainText('login_required');
		await expect(row(page, 'second-token-request')).toHaveCount(0);
		await expect(held(page, 'second-app', 'access-token')).toHaveCount(0);
	});

	test('changes the answer on the same arrow', async ({ page }) => {
		await open(page, 'sso=1&oidc=1&step=second-redirect-with-code');
		const answer = row(page, 'second-redirect-with-code');
		await answer.evaluate((element) => element.setAttribute('data-kept', 'yes'));
		await choice(page, 'fresh').check();
		await expect(answer).toContainText('error=login_required');
		await expect(answer).toHaveAttribute('data-kept', 'yes');
	});
});

test.describe('in simple mode', () => {
	test('is reached through a question, with no sixth setting on offer', async ({ page }) => {
		await page.goto('authorization-code/single-sign-on/');
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect(page.getByTestId('title')).toHaveText(
			"What is single sign-on? Why don't I log in twice?"
		);
		await expect(current(page)).toHaveAttribute('data-step', 'idp-recognises');
		await expect(page.locator('[data-remove]')).toHaveCount(1);
		await expect(payload(page)).toHaveCount(0);
		await expect(page.locator('[data-setting="sso"]')).toHaveCount(0);
	});
});

test.describe('from the map', () => {
	for (const [id, title, step] of [
		['force-a-login', 'How do I make someone log in again?', 'second-authorize'],
		['login-required', 'Why do I get login_required?', 'second-redirect-with-code']
	]) {
		test(`${id} opens at the answer`, async ({ page }) => {
			await page.goto(`authorization-code/${id}/`);
			await page.locator('.workspace[data-ready="true"]').waitFor();
			await expect(page.getByTestId('title')).toHaveText(title);
			await expect(current(page)).toHaveAttribute('data-step', step);
		});
	}
});
