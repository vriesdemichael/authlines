import { expect, test, type Page } from '@playwright/test';
import { expectMatchesModel, open, watchForErrors } from './helpers.ts';

const row = (page: Page, id: string) => page.locator(`[data-step="${id}"]`);
const current = (page: Page) => page.locator('[data-state="current"]');
const detail = (page: Page) => page.getByTestId('step-detail');
const payload = (page: Page) => page.getByTestId('payload');
const note = (page: Page, id: string) => page.locator(`[data-note="${id}"]`);

test.describe('when the token runs out', () => {
	test('walks through the refusal and the new token, back to the API', async ({ page }) => {
		const check = watchForErrors(page);
		await open(page, 'refresh=1&step=api-response');
		await expectMatchesModel(page, 'refresh=1&step=api-response');
		for (const step of [
			'token-runs-out',
			'api-request-again',
			'api-refused',
			'refresh-request',
			'refresh-response',
			'api-request-new',
			'api-response-new',
			'refresh-again',
			'refresh-again-response'
		]) {
			await page.getByTestId('next').click();
			await expect(current(page)).toHaveAttribute('data-step', step);
		}
		await expect(page.getByTestId('next')).toBeDisabled();
		check();
	});

	test('draws time passing as such, with nothing sent', async ({ page }) => {
		await open(page, 'refresh=1&step=token-runs-out');
		const time = row(page, 'token-runs-out');
		await expect(time).toHaveClass(/\btime\b/);
		await expect(time.locator('.gap')).toBeAttached();
		await expect(time.locator('polygon')).toHaveCount(0);
		await expect(time).toContainText('Later');
		await expect(detail(page)).toContainText('Nothing is sent');
		await expect(payload(page)).toHaveCount(0);
	});

	test('shows the 401 and the new tokens, from a recording', async ({ page }) => {
		await open(page, 'refresh=1&step=api-refused');
		await expect(row(page, 'api-refused')).toContainText('401 invalid_token');
		await expect(payload(page)).toContainText(/www-authenticate/i);
		await open(page, 'refresh=1&step=refresh-response');
		await expect(payload(page)).toContainText('refresh_token');
		await expect(page.locator('[data-held="app:refresh-token"]')).toBeVisible();
	});

	test('sends the refresh token that came back with the login', async ({ page }) => {
		await open(page, 'refresh=1&step=refresh-request');
		await expect(payload(page).locator('[data-from="token-response"]').first()).toBeAttached();
		await expect(payload(page)).toContainText('grant_type');
	});

	test('Execute moves to the answer', async ({ page }) => {
		await open(page, 'refresh=1&step=refresh-request');
		await page.getByTestId('execute').click();
		await expect(current(page)).toHaveAttribute('data-step', 'refresh-response');
		await expect(page.getByTestId('answer-to')).toBeVisible();
	});

	test('says why the recording shows 3, with the real answer beside it', async ({ page }) => {
		await open(page, 'refresh=1&step=token-runs-out');
		const short = note(page, 'short-for-this-recording');
		await short.locator('summary').click();
		await expect(short).toContainText('five minutes');
		await expect(short).toContainText('three seconds');
	});

	test('cannot be turned on with what would get in the way', async ({ page }) => {
		// Another provider is fine, and the tokens it stores are not drawn with this yet (#186).
		await open(page, 'broker=1');
		await expect(page.locator('[data-setting="refresh"] input')).toBeEnabled();
		await open(page, 'broker=1&upstream=v1');
		await expect(page.locator('[data-setting="refresh"] input')).toBeDisabled();
		await open(page, 'send=expired');
		await expect(page.locator('[data-setting="refresh"] input')).toBeDisabled();
		await open(page, 'refresh=1');
		await page.locator('[data-setting="attacker"] input').check();
		await expect(page.getByTestId('change-summary')).toContainText('was reset');
	});
});

test.describe('using one twice', () => {
	test('still works on a default server, and the note says what changes that', async ({ page }) => {
		await open(page, 'refresh=1&step=refresh-again-response');
		await expect(row(page, 'refresh-again-response')).toContainText('200 with new tokens');
		await expect(row(page, 'refresh-newest')).toHaveCount(0);
		const revoke = note(page, 'revoke-refresh-token');
		await revoke.locator('summary').click();
		await expect(revoke).toContainText('Realm settings › Tokens › Revoke Refresh Token');
		await expect(revoke).toContainText('Off by default');
	});

	test('changes the answer on the same arrow', async ({ page }) => {
		await open(page, 'refresh=1&step=refresh-again-response');
		const answer = row(page, 'refresh-again-response');
		await answer.evaluate((element) => element.setAttribute('data-kept', 'yes'));
		await page.locator('[data-setting="reuse"] input[value="ends"]').check();
		await expect(answer).toContainText('400 invalid_grant');
		await expect(answer).toHaveAttribute('data-kept', 'yes');
		await expect(row(page, 'refresh-newest-response')).toBeAttached();
	});

	test('then stops the newest one too, as a real server said', async ({ page }) => {
		await open(page, 'refresh=1&reuse=ends&step=refresh-again-response');
		await expect(payload(page)).toContainText('Maximum allowed refresh token reuse exceeded');
		await open(page, 'refresh=1&reuse=ends&step=refresh-newest-response');
		await expect(payload(page)).toContainText("Session doesn't have required client");
		await expect(detail(page)).toContainText('cannot tell which of the two');
	});

	test('takes the secret as well from an app that has one', async ({ page }) => {
		await open(page, 'refresh=1&step=refresh-again');
		await expect(detail(page)).toContainText('need the secret as well');
		await expect(payload(page)).toContainText(/authorization/i);
		await open(page, 'refresh=1&client=public&pkce=1&step=refresh-again');
		await expect(detail(page)).toContainText('this request is all they need');
		await expect(payload(page)).not.toContainText(/authorization/i);
	});

	test('is what the attacker gets, in the same words', async ({ page }) => {
		const words = 'new access tokens without the user';
		await open(page, 'client=public&attacker=1&step=attacker-token-response');
		await expect(detail(page)).toContainText(words);
		await open(page, 'refresh=1&client=public&pkce=1&step=refresh-again-response');
		await expect(detail(page)).toContainText(words);
	});
});

test.describe('in simple mode', () => {
	test('stays in plain words, and the setting stays on to be removed', async ({ page }) => {
		await open(page, 'mode=simple&refresh=1&step=refresh-request');
		await expect(row(page, 'refresh-request')).toContainText('The app sends its refresh token');
		await expect(detail(page)).toContainText('no redirect');
		await expect(payload(page)).toHaveCount(0);
		await expect(page.locator('[data-remove]')).toHaveCount(1);
	});
});

test.describe('from the map', () => {
	for (const [id, title, step] of [
		['token-runs-out', 'What happens when the token runs out?', 'token-runs-out'],
		['stolen-refresh-token', 'What is a stolen refresh token worth?', 'refresh-again'],
		[
			'refresh-token-reuse',
			'Why do I get Maximum allowed refresh token reuse exceeded?',
			'refresh-again-response'
		]
	]) {
		test(`${id} opens at the answer`, async ({ page }) => {
			await page.goto(`authorization-code/${id}/`);
			await page.locator('.workspace[data-ready="true"]').waitFor();
			await expect(page.getByTestId('title')).toHaveText(title);
			await expect(current(page)).toHaveAttribute('data-step', step);
		});
	}
});
