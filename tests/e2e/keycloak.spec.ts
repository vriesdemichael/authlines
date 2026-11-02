import { expect, test, type Page } from '@playwright/test';
import { authorizationCodeBase as base } from '../../src/lib/flow/index.ts';
import { evaluate } from '../../src/lib/flow/model.ts';
import { presetSearch } from '../../src/lib/flow/state.ts';
import { settingsOf } from '../../src/lib/recordings/known.ts';
import { currentSearch, open, SETUP_PATH } from './helpers.ts';

const note = (page: Page, id: string) => page.locator(`[data-note="${id}"]`);
const notes = (page: Page) => page.getByTestId('keycloak-note');
const serverNotes = (page: Page) => page.locator('[data-testid="server-notes"] input');

test.describe('a note on a message', () => {
	test('names the setting, closed, and opens to say where it is', async ({ page }) => {
		await open(page, 'step=authorize');
		const redirect = note(page, 'valid-redirect-uris');
		await expect(redirect.locator('summary')).toHaveText('In Keycloak: Valid redirect URIs');
		await expect(page.getByTestId('note-path').first()).toBeHidden();

		await redirect.locator('summary').click();
		await expect(redirect).toContainText('Invalid parameter: redirect_uri');
		await expect(redirect).toContainText(
			'Clients › your client › Settings › Access settings › Valid redirect URIs'
		);
		await expect(redirect).toContainText(/the answer changed, on Keycloak \d+\.\d+\.\d+/);
	});

	test('explains the claims a token has on a default client', async ({ page }) => {
		await open(page, 'step=token-response');
		const scopes = note(page, 'client-scopes');
		await scopes.locator('summary').click();
		await expect(scopes).toContainText("the client's default client scopes");
		await expect(scopes).toContainText('Clients › your client › Client scopes');
	});

	test('explains why the audience is not the API', async ({ page }) => {
		await open(page, 'step=api-check-token');
		const audience = note(page, 'audience');
		await audience.locator('summary').click();
		await expect(audience).toContainText('names account as its audience');
	});

	test('follows the settings', async ({ page }) => {
		await open(page, 'step=token-request');
		await expect(note(page, 'require-dpop')).toHaveCount(0);
		await page.locator('[data-setting="binding"] input[value="dpop"]').check();
		await expect(note(page, 'require-dpop')).toBeVisible();
	});

	test('changes what it says with the client type', async ({ page }) => {
		await open(page, 'step=token-request');
		const auth = note(page, 'client-authentication');
		await auth.locator('summary').click();
		await expect(auth).toContainText('which makes this a confidential client');
		await page.locator('[data-setting="clientType"] input[value="public"]').check();
		await expect(auth).toContainText('which makes this a public client');
	});

	test('says when something is a server option, and shows the flag as a badge', async ({
		page
	}) => {
		await open(page, 'broker=1&upstream=v2&step=retrieve-upstream-token');
		const flags = note(page, 'brokering-api-flags');
		await flags.locator('summary').click();
		await expect(flags).toContainText('--features=identity-brokering-api:v2');
		const external = note(page, 'allow-external-tokens');
		await external.locator('summary').click();
		await expect(external.locator('[data-flag]')).toContainText('supported, off by default');
	});

	test('is there in setup as well', async ({ page }) => {
		await open(page, 'step=create-client', 'setup');
		await expect(note(page, 'valid-redirect-uris')).toBeVisible();
		await expect(note(page, 'client-authentication')).toBeVisible();
	});

	test('is not there on a step it says nothing about', async ({ page }) => {
		await open(page, 'step=open-app');
		await expect(notes(page)).toHaveCount(0);
	});

	test('is not in simple mode, which is for the concept', async ({ page }) => {
		await open(page, 'mode=simple&step=authorize');
		await expect(notes(page)).toHaveCount(0);
	});
});

test.describe('the switch', () => {
	test('is on by default and leaves the address alone', async ({ page }) => {
		await open(page, 'step=authorize');
		await expect(serverNotes(page)).toBeChecked();
		expect(new URL(page.url()).searchParams.has('keycloak')).toBe(false);
	});

	test('takes the notes away, in the address, and Back brings them back', async ({ page }) => {
		await open(page, 'step=authorize');
		await expect(notes(page)).not.toHaveCount(0);

		await serverNotes(page).uncheck();
		await expect(notes(page)).toHaveCount(0);
		await expect.poll(() => currentSearch(page)).toContain('keycloak=off');

		await page.goBack();
		await expect(notes(page)).not.toHaveCount(0);
	});

	test('survives a reload and a change of mode', async ({ page }) => {
		await open(page, 'keycloak=off&step=authorize');
		await page.reload();
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect(serverNotes(page)).not.toBeChecked();
		await page.locator('[data-mode="simple"]').click();
		await expect.poll(() => currentSearch(page)).toContain('keycloak=off');
	});

	test('hides the flags too', async ({ page }) => {
		await open(page, 'keycloak=off&broker=1');
		await expect(page.locator('[data-flag]')).toHaveCount(0);
	});

	test('does not open a vendor source from a link', async ({ page }) => {
		await open(page, 'keycloak=off&broker=1&source=keycloak-brokering&for=broker');
		await expect(page.getByTestId('source-panel')).toHaveCount(0);
	});
});

test.describe('with the switch off, the word is not on the screen', () => {
	const noWord = async (page: Page, where: string) => {
		const text = await page.locator('body').innerText();
		expect(text.match(/keycloak/gi), where).toBeNull();
	};

	for (const preset of base.presets) {
		test(`in ${preset.title}, on every step`, async ({ page }) => {
			const search = presetSearch(base, preset.settings);
			const { steps } = evaluate(base.diagrams.flow, settingsOf(preset));
			await open(page, `keycloak=off${search ? `&${search}` : ''}`);
			for (const step of steps) {
				await expect(page.locator('[data-state="current"]')).toHaveAttribute('data-step', step.id);
				await expect(page.getByTestId('recording-loading')).toHaveCount(0);
				await noWord(page, step.id);
				if (step !== steps.at(-1)) await page.getByTestId('next').click();
			}
		});
	}

	test('in setup', async ({ page }) => {
		const { steps } = evaluate(base.diagrams.setup, settingsOf(base.presets[0]));
		await open(page, 'keycloak=off', 'setup');
		for (const step of steps) {
			await noWord(page, step.id);
			if (step !== steps.at(-1)) await page.getByTestId('next').click();
		}
	});

	test('in simple mode', async ({ page }) => {
		await page.goto(`${SETUP_PATH}?keycloak=off`);
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await noWord(page, 'setup in simple mode');
		await page.goto('authorization-code/?keycloak=off&step=token-request');
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await noWord(page, 'the user flow in simple mode');
	});

	test('in what a setting says about itself', async ({ page }) => {
		await open(page, 'keycloak=off&broker=1&explain=setting.broker');
		await expect(page.getByTestId('explanation')).toBeVisible();
		await noWord(page, 'an explanation of a setting');
	});
});
