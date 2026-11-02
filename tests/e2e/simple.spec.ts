import { expect, test, type Page } from '@playwright/test';
import { settingDefs } from '../../src/lib/flow/settings.ts';
import { artifacts } from '../../src/lib/flow/vocabulary.ts';
import { expectMatchesModel, FLOW_PATH, SETUP_PATH } from './helpers.ts';

/** Opens exactly this address, in whatever mode it asks for. Simple is the default. */
async function visit(page: Page, path = FLOW_PATH) {
	await page.goto(path);
	await page.locator('.workspace[data-ready="true"]').waitFor();
}

const row = (page: Page, id: string) => page.locator(`[data-step="${id}"]`);
const explanation = (page: Page) => page.getByTestId('explanation');

test.describe('someone arriving for the first time', () => {
	test('is in simple mode, with nothing in the address about it', async ({ page }) => {
		await visit(page);
		await expect(page.locator('[data-mode="simple"]')).toHaveAttribute('aria-pressed', 'true');
		expect(new URL(page.url()).search).toBe('');
	});

	test('is told what this is for, and where to start', async ({ page }) => {
		await visit(page);
		await expect(page.getByTestId('intro')).toContainText('without ever seeing their password');
		await expect(page.getByTestId('intro')).toContainText('Press Next');
		await page.getByTestId('next').click();
		await expect(page.getByTestId('intro')).toHaveCount(0);
	});

	test('reads what happens in plain words', async ({ page }) => {
		await visit(page, `${FLOW_PATH}?step=redirect-to-idp`);
		const detail = page.getByTestId('step-detail');
		await expect(detail.getByRole('heading').first()).toHaveText('The app sends them to log in');
		await expect(row(page, 'redirect-to-idp').locator('.label')).toHaveText(
			'The app sends them to log in'
		);
		await expect(page.locator('[data-lifeline="idp"]')).toContainText('Identity provider');
		await expect(page.getByRole('main')).not.toContainText('302');
	});

	test('sees no parameters', async ({ page }) => {
		await visit(page, `${FLOW_PATH}?oidc=1&step=authorize`);
		await expect(page.getByTestId('step-detail')).not.toContainText('response_type');
		await expect(page.locator('[data-chip="authorize:scope=openid"]')).toHaveCount(0);
		await expect(page.locator('[data-chip="token-response:id_token"]')).toHaveCount(1);
	});

	test('is offered only a few settings', async ({ page }) => {
		await visit(page);
		await expect(page.locator('[data-setting]')).toHaveCount(6);
		await expect(page.locator('[data-setting="oidc"]')).toContainText('Know who logged in');
		await expect(page.locator('[data-setting="pkce"]')).toContainText(
			'Protect against a stolen code'
		);
		await expect(page.locator('[data-setting="binding"]')).toHaveCount(0);
		await expect(page.locator('[data-source-ref]')).toHaveCount(0);
	});
});

test.describe('switching mode', () => {
	test('changes how much is shown, never the flow', async ({ page }) => {
		await visit(page, `${FLOW_PATH}?oidc=1&step=token-request`);
		const positions = () =>
			page
				.locator('[data-step] line')
				.evaluateAll((lines) => lines.map((line) => line.getAttribute('y1')));
		const before = await positions();

		await page.locator('[data-mode="advanced"]').click();
		await expect(page.getByTestId('step-detail')).toContainText('grant_type=authorization_code');
		await expect(row(page, 'token-request').locator('.label')).toHaveText('POST /token');
		await expect(page.locator('[data-setting="binding"]')).toBeVisible();

		await expectMatchesModel(page, 'oidc=1&step=token-request');
		expect(await positions()).toEqual(before);
		await expect(page.getByTestId('diagram')).toHaveAttribute('data-animating', 'false');
	});

	test('goes in the address, and Back undoes it', async ({ page }) => {
		await visit(page);
		await page.locator('[data-mode="advanced"]').click();
		await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBe('advanced');
		await page.goBack();
		await expect(page.locator('[data-mode="simple"]')).toHaveAttribute('aria-pressed', 'true');
	});

	test('keeps an advanced setting on, as a chip that can be removed', async ({ page }) => {
		await visit(page, `${FLOW_PATH}?mode=advanced&binding=dpop`);
		await page.locator('[data-mode="simple"]').click();
		await expectMatchesModel(page, 'binding=dpop');
		const chips = page.getByTestId('also-on');
		await expect(chips).toContainText('Token type: DPoP');
		await expect(row(page, 'generate-key')).toHaveCount(1);

		await page.locator('[data-remove="binding"]').click();
		await expect(chips).toHaveCount(0);
		await expect(row(page, 'generate-key')).toHaveCount(0);
	});
});

test.describe('asking what something is', () => {
	test('a lifeline says what it is, and what it has seen', async ({ page }) => {
		await visit(page, `${FLOW_PATH}?step=token-response`);
		await page.locator('[data-lifeline="idp"]').click();
		await expect(explanation(page)).toContainText('Identity provider');
		await expect(explanation(page)).toContainText('issuer');
		await expect(page.getByTestId('explanation-seen')).toContainText('access token');
		await expect.poll(() => new URL(page.url()).searchParams.get('explain')).toBe('lifeline.idp');
	});

	test('this works by keyboard, and Escape closes it', async ({ page }) => {
		await visit(page);
		await page.locator('[data-lifeline="app"]').focus();
		await page.keyboard.press('Enter');
		await expect(explanation(page)).toContainText('never sees');
		await page.keyboard.press('Escape');
		await expect(explanation(page)).toHaveCount(0);
	});

	test('a token on a message says what it is, and who has seen it', async ({ page }) => {
		await visit(page, `${FLOW_PATH}?step=callback`);
		await page.locator('[data-chip="callback:code"]').click();
		await expect(explanation(page)).toContainText(artifacts.code.explains);
		await expect(page.getByTestId('explanation-seen-by')).toContainText("User's browser");
		await expect(page.getByTestId('explanation-seen-by')).toContainText('App');
		await expect(page.getByTestId('explanation-seen-by')).not.toContainText('API');
	});

	test('a setting says what problem it solves, and where to read more', async ({ page }) => {
		await visit(page);
		await page.locator('[data-why="oidc"]').click();
		await expect(explanation(page)).toContainText(settingDefs.oidc.why);
		await explanation(page).getByRole('button', { name: 'OpenID Connect Core' }).click();
		await expect(page.getByTestId('source-panel')).toBeVisible();
	});

	test('a link can open with it, on the step it names', async ({ page }) => {
		await visit(page, `${FLOW_PATH}?explain=artifact.code&step=callback`);
		await expect(explanation(page)).toContainText('one-time ticket');
		await expect(page.locator('[data-state="current"]')).toHaveAttribute('data-step', 'callback');
	});

	test('a link naming something unknown opens nothing', async ({ page }) => {
		await visit(page, `${FLOW_PATH}?explain=lifeline.nope`);
		await expect(explanation(page)).toHaveCount(0);
	});
});

test.describe('why it matters', () => {
	test('turning on OpenID Connect says what problem it solves', async ({ page }) => {
		await visit(page);
		await page.locator('[data-setting="oidc"] input').check();
		await expect(page.getByTestId('change-why')).toContainText('who the user is');
		await page.getByTestId('next').click();
		await expect(page.getByTestId('change-why')).toHaveCount(0);
	});

	test('the redirect URI check explains what a mismatch does', async ({ page }) => {
		await visit(page, `${FLOW_PATH}?step=authorize`);
		const pitfall = page.getByTestId('step-pitfall');
		await expect(pitfall).toContainText('What if the address does not match?');
		await pitfall.locator('summary').click();
		await expect(pitfall).toContainText('must not send the browser to that address');
	});

	test('setup says what each side has to learn', async ({ page }) => {
		await visit(page, SETUP_PATH);
		const intro = page.getByTestId('intro');
		await expect(intro).toContainText('where users may be sent back to');
		await expect(intro).toContainText('how to check its tokens');
	});
});

test.describe('a public client', () => {
	test('is not told the browser never sees the call', async ({ page }) => {
		await visit(page, `${FLOW_PATH}?mode=advanced&client=public&step=token-request`);
		const detail = page.getByTestId('step-detail');
		await expect(detail).toContainText('its own JavaScript');
		await expect(detail).toContainText('PKCE');
		await expect(detail).not.toContainText('never sees');
	});
});
