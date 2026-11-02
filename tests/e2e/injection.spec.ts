import { expect, test, type Page } from '@playwright/test';
import { open } from './helpers.ts';

const row = (page: Page, step: string) => page.locator(`[data-step="${step}"]`);
const detail = (page: Page) => page.getByTestId('step-detail');
const choice = (page: Page, value: string) =>
	page.locator(`[data-setting="attackerUses"] input[value="${value}"]`);

test.describe('a stolen code handed to the real app', () => {
	test('is a choice on the same diagram, only with a secret to get around', async ({ page }) => {
		await open(page, 'mode=advanced&attacker=1');
		await expect(row(page, 'attacker-token-request')).toBeVisible();
		await choice(page, 'real-app').check();
		await expect(row(page, 'attacker-hands-code')).toBeVisible();
		await expect(row(page, 'attacker-token-request')).toHaveCount(0);
		await expect(page).toHaveURL(/uses=real-app/);

		await open(page, 'mode=advanced&attacker=1&client=public');
		await expect(choice(page, 'real-app')).toHaveCount(0);
	});

	test('logs them in as the real user, with no PKCE, whatever the secret does', async ({
		page
	}) => {
		await open(page, 'mode=simple&attacker=1&uses=real-app&step=attacker-handed-answer');
		await expect(row(page, 'attacker-handed-answer')).toContainText(
			'They are logged in as the real user'
		);
		await expect(detail(page)).toContainText('The secret did nothing');
	});

	test('changes the answer on the same arrow, when PKCE is flipped', async ({ page }) => {
		await open(page, 'mode=simple&attacker=1&uses=real-app&step=handed-token-response');
		await expect(row(page, 'handed-token-response')).toContainText('Tokens for the real user');
		await page.locator('[data-setting="pkce"] input').check();
		await expect(row(page, 'handed-token-response')).toContainText(
			'Refused: the verifier does not match'
		);
		await expect(page.locator('[data-state="current"]')).toHaveAttribute(
			'data-step',
			'handed-token-response'
		);
	});

	test('shows what a real server said, in the raw view', async ({ page }) => {
		await open(page, 'mode=advanced&attacker=1&uses=real-app&pkce=1&step=handed-token-response');
		await expect(page.getByTestId('payload')).toContainText('PKCE verification failed');
		await open(page, 'mode=advanced&attacker=1&uses=real-app&step=handed-token-request');
		await expect(page.getByTestId('payload')).toContainText('authorization: Basic');
	});

	test('says why state does not stop it, and which spec it is from', async ({ page }) => {
		await open(page, 'mode=advanced&attacker=1&uses=real-app&step=attacker-hands-code');
		await expect(detail(page)).toContainText('So the state matches');
		await expect(page.locator('[data-step-source="rfc9700"]')).toHaveText('RFC 9700 §4.5');
	});

	test('with a nonce, the server still hands over the tokens, and the app stops it', async ({
		page
	}) => {
		await open(page, 'mode=advanced&attacker=1&uses=real-app&oidc=1&step=handed-nonce-check');
		await expect(row(page, 'handed-token-response')).toContainText('200 with tokens');
		await expect(row(page, 'attacker-handed-answer')).toHaveCount(1);
		await expect(detail(page)).toContainText('real user’s login');
	});

	test('shows on the arrow what the refusal is about, for someone new as well', async ({
		page
	}) => {
		await open(page, 'mode=simple&attacker=1&uses=real-app&pkce=1&step=handed-token-request');
		await expect(page.getByTestId('diagram').getByText('their verifier')).toBeVisible();
		await expect(page.getByTestId('diagram').getByText('their challenge')).toBeVisible();
	});

	test('leaves the real user with an error, whichever way it went', async ({ page }) => {
		for (const search of ['', '&pkce=1', '&oidc=1']) {
			await open(page, `mode=simple&attacker=1&uses=real-app${search}`);
			await expect(row(page, 'real-app-refused')).toHaveCount(1);
			await expect(row(page, 'api-request')).toHaveCount(0);
		}
	});

	test('draws their browser as a browser, and the app’s call to the server as direct', async ({
		page
	}) => {
		await open(page, 'mode=simple&attacker=1&uses=real-app');
		await expect(row(page, 'attacker-hands-code')).toHaveAttribute('data-channel', 'front');
		await expect(row(page, 'handed-token-request')).toHaveAttribute('data-channel', 'back');
	});

	test('a pasted error goes to where a real server said it', async ({ page }) => {
		await page.goto('./');
		await page.locator('main[data-ready="true"]').waitFor();
		await page.getByTestId('open-search').click();
		await page.getByTestId('search-input').fill('PKCE verification failed: Code mismatch');
		await page.getByTestId('search').locator('[data-result]').first().click();
		await expect(page).toHaveURL(/step=handed-token-response/);
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect(page.getByTestId('payload')).toContainText('PKCE verification failed');
	});

	for (const [id, step] of [
		['pkce-with-a-secret', 'attacker-handed-answer'],
		['pkce-at-the-app', 'handed-token-response'],
		['nonce-at-the-app', 'handed-nonce-check']
	]) {
		test(`the question ${id} opens where it is answered`, async ({ page }) => {
			await page.goto(`authorization-code/${id}/`);
			await page.locator('.workspace[data-ready="true"]').waitFor();
			await expect(page.locator('[data-state="current"]')).toHaveAttribute('data-step', step);
			await expect(page.getByTestId('answer')).toBeVisible();
		});
	}
});
