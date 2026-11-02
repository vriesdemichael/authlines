import { expect, test, type Page } from '@playwright/test';
import { expectMatchesModel, onTheMap, open, watchForErrors } from './helpers.ts';

const diagram = (page: Page) => page.getByTestId('diagram');
const row = (page: Page, id: string) => page.locator(`[data-step="${id}"]`);
const eyes = (page: Page) => page.getByTestId('eyes');

test.describe('seeing it as one party', () => {
	test('does not say an app in the browser kept something from the browser', async ({ page }) => {
		await open(page, 'client=public&pkce=1&eyes=browser&step=token-request');
		await expect(page.getByTestId('unseen')).toBeVisible();
		await expect(page.getByTestId('unseen-in-the-page')).toContainText('comes from the page');
		await open(page, 'eyes=browser&step=token-request');
		await expect(page.getByTestId('unseen')).toBeVisible();
		await expect(page.getByTestId('unseen-in-the-page')).toHaveCount(0);
	});

	test('hides what the browser was not sent, and keeps what it was', async ({ page }) => {
		const check = watchForErrors(page);
		await open(page, 'mode=simple&eyes=browser&step=token-response');
		// What it was part of still says what it said.
		await expect(row(page, 'redirect-with-code')).toContainText('one-time code');
		await expect(
			page.locator('[data-chip^="redirect-with-code"][data-artifact="code"]')
		).toBeVisible();
		// What it was not part of says nothing, and is not on the page to be selected or read out.
		await expect(row(page, 'token-request').locator('.label')).toHaveCount(0);
		await expect(row(page, 'token-request').locator('.bar')).not.toHaveCount(0);
		await expect(page.locator('[data-chip^="token-response"]')).toHaveCount(0);
		await expect(diagram(page)).not.toContainText('access token');
		await expect(diagram(page)).not.toContainText('client secret');
		check();
	});

	test('hides what the browser never held under the others too', async ({ page }) => {
		await open(page, 'mode=simple&eyes=browser&step=token-response');
		await expect(page.locator('[data-held="app:access-token"]')).toHaveCount(0);
		await expect(page.locator('[data-held="app:secret"]')).toHaveCount(0);
		await expect(page.locator('[data-held="browser:code"]')).toBeVisible();
		await expect(page.locator('[data-held="app:code"]')).toBeVisible();
		await expect(page.locator('[data-hidden-held]')).not.toHaveCount(0);
	});

	test('leaves the app without the password', async ({ page }) => {
		await open(page, 'mode=simple&eyes=app&step=submit-credentials');
		await expect(row(page, 'submit-credentials').locator('.label')).toHaveCount(0);
		await expect(diagram(page)).not.toContainText('password');
		await expect(row(page, 'open-app')).toContainText('opens the app');
	});

	test('shows what an attacker got, in each answer', async ({ page }) => {
		await open(
			page,
			'mode=simple&client=public&attacker=1&eyes=attacker&step=attacker-api-response'
		);
		await expect(row(page, 'attacker-token-response')).toContainText('tokens');
		await expect(page.locator('[data-held="attacker:access-token"]')).toBeVisible();
		await expect(row(page, 'submit-credentials').locator('.label')).toHaveCount(0);

		await open(
			page,
			'mode=simple&client=public&pkce=1&attacker=1&eyes=attacker&step=attacker-token-response'
		);
		await expect(row(page, 'attacker-token-response')).toContainText('Refused');
		await expect(page.locator('[data-held="attacker:code"]')).toBeVisible();
		await expect(page.locator('[data-held="attacker:access-token"]')).toHaveCount(0);
	});

	test('says what seeing means, and how much of it there is', async ({ page }) => {
		await open(page, 'mode=simple&eyes=browser');
		const note = page.getByTestId('eyes-note');
		await expect(note).toContainText("Seen as: User's browser");
		await expect(note).toContainText('sent or sent itself');
		await expect(note).toContainText('7 of the 12 steps');
		await expect(note).toContainText('could work out');
	});

	test('says so on a step it was not part of, without what it says', async ({ page }) => {
		await open(page, 'mode=simple&eyes=browser&step=token-response');
		const detail = page.getByTestId('step-detail');
		await expect(page.getByTestId('unseen')).toHaveText("Not seen by User's browser");
		await expect(detail).toContainText("User's browser was not sent it");
		await expect(detail).not.toContainText('access token');
		await expect(page.getByTestId('step-carried')).toHaveCount(0);
	});

	test('explains a step as usual when it was part of it', async ({ page }) => {
		await open(page, 'mode=simple&eyes=browser&step=redirect-with-code');
		await expect(page.getByTestId('unseen')).toHaveCount(0);
		await expect(page.getByTestId('step-detail')).toContainText('one-time code');
	});

	test('moves nothing for a message it was not part of', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await open(page, 'mode=simple&eyes=browser&step=callback');
		await page.getByTestId('next').click();
		await expect(page.locator('[data-state="current"]')).toHaveAttribute(
			'data-step',
			'token-request'
		);
		await expect(page.locator('.packet')).toHaveCount(0);
	});
});

test.describe('in advanced mode', () => {
	const payload = (page: Page) => page.getByTestId('payload');

	test('blacks out the values of a message it never saw', async ({ page }) => {
		await open(page, 'mode=advanced&eyes=browser&step=token-response');
		await expect(payload(page)).toContainText('access_token');
		await expect(payload(page).locator('[data-hidden]').first()).toBeVisible();
		await expect(payload(page)).not.toContainText('eyJ');
		await expect(page.getByTestId('jwt')).toHaveCount(0);
	});

	test('shows the values of a message it was sent', async ({ page }) => {
		await open(page, 'mode=advanced&eyes=browser&step=redirect-with-code');
		await expect(payload(page).locator('[data-hidden]')).toHaveCount(0);
		await expect(payload(page).locator('[data-artifact="code"]').first()).toBeVisible();
	});

	test('leaves out of what the run has so far what it never saw', async ({ page }) => {
		await open(page, 'mode=advanced&eyes=browser&step=api-response');
		const values = page.getByTestId('run-values');
		await expect(values.locator('[data-value="code"]')).toBeVisible();
		await expect(values.locator('[data-value="access_token"]')).toHaveCount(0);

		await open(page, 'mode=advanced&step=api-response');
		await expect(values.locator('[data-value="access_token"]')).toBeVisible();
	});
});

test.describe('getting there', () => {
	test('is in the address, and comes back on a reload', async ({ page }) => {
		await open(page, 'mode=advanced');
		await eyes(page).selectOption('browser');
		await expect(page).toHaveURL(/eyes=browser/);
		await page.reload();
		await expect(eyes(page)).toHaveValue('browser');
		await expect(page.getByTestId('eyes-note')).toBeVisible();
	});

	test('changes no flow', async ({ page }) => {
		await open(page, 'oidc=1&eyes=browser');
		await expectMatchesModel(page, 'oidc=1&eyes=browser');
	});

	test('can be done from what a lifeline says about itself, and undone', async ({ page }) => {
		await open(page, 'mode=simple');
		await page.locator('[data-lifeline="browser"]').click();
		await page.getByTestId('see-only').click();
		await expect(page).toHaveURL(/eyes=browser/);
		await expect(page.getByTestId('see-only')).toHaveText('See everything again');
		await page.getByTestId('see-only').click();
		await expect(page).not.toHaveURL(/eyes=/);
	});

	test('comes off from the note', async ({ page }) => {
		await open(page, 'mode=simple&eyes=browser');
		await page.getByTestId('eyes-off').click();
		await expect(page).not.toHaveURL(/eyes=/);
		await expect(page.getByTestId('eyes-note')).toHaveCount(0);
	});

	test('works from the keyboard, and the arrow keys stay with the list', async ({ page }) => {
		await open(page, 'mode=advanced&step=authorize');
		await eyes(page).focus();
		await page.keyboard.press('ArrowDown');
		await expect(eyes(page)).toHaveValue('browser');
		await expect(page.getByTestId('position')).toContainText('Step 3');
	});

	test('lets go when a setting takes that party off the diagram', async ({ page }) => {
		await open(page, 'attacker=1&eyes=attacker');
		await page.locator('[data-setting="attacker"] input').uncheck();
		await expect(page).not.toHaveURL(/eyes=/);
		await expect(eyes(page)).toHaveValue('');
	});

	test('tells a screen reader who was not part of a message', async ({ page }) => {
		await open(page, 'mode=simple&eyes=browser&step=token-response');
		await expect(row(page, 'token-request').locator('desc')).toContainText(
			"User's browser was not part of this."
		);
	});

	test('prints as it looks', async ({ page }) => {
		await open(page, 'mode=simple&eyes=browser&step=token-response');
		await page.emulateMedia({ media: 'print' });
		await expect(row(page, 'token-request').locator('.bar').first()).toBeVisible();
		await expect(diagram(page)).not.toContainText('access token');
	});
});

test.describe('the question on the map', () => {
	test('opens as the browser, on the answer it never saw', async ({ page }) => {
		const check = watchForErrors(page);
		await page.goto('authorization-code/what-the-browser-sees/');
		await expect(eyes(page)).toHaveValue('browser');
		await expect(page.locator('[data-state="current"]')).toHaveAttribute(
			'data-step',
			'token-response'
		);
		await expect(page.getByTestId('title')).toHaveText('What can the browser see?');
		check();
	});

	test('keeps a way back once someone sees it as everyone', async ({ page }) => {
		await page.goto('authorization-code/what-the-browser-sees/');
		await page.getByTestId('eyes-off').click();
		await expect(page.getByTestId('from-question')).toContainText('What can the browser see?');
	});

	test('is what pointing at it shows on the home screen', async ({ page }) => {
		await page.goto('./');
		await (await onTheMap(page, 'what-the-browser-sees')).hover();
		await expect(page.getByTestId('living')).toHaveAttribute('data-node', 'what-the-browser-sees');
		await expect(page.getByTestId('living').locator('.bar').first()).toBeAttached();
	});
});
