import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { open, pressRow } from './helpers.ts';

const row = (page: import('@playwright/test').Page, id: string) =>
	page.locator(`[data-step="${id}"]`);

test.describe('each step shows what is relevant at that point', () => {
	test('what has happened is spelled out, and what is ahead is only a shape', async ({ page }) => {
		await open(page, 'step=authorize');
		await expect(row(page, 'open-app').locator('.label')).toHaveCSS('opacity', '1');
		await expect(row(page, 'authorize').locator('.label')).toHaveCSS('opacity', '1');
		await expect(row(page, 'token-request').locator('.label')).toHaveCSS('opacity', '0');
		await expect(page.locator('[data-chip="token-response:access_token"]')).toHaveCSS(
			'opacity',
			'0'
		);
	});

	test('a message ahead can still be read by pointing at it', async ({ page }) => {
		await open(page);
		await row(page, 'token-request').hover();
		await expect(row(page, 'token-request').locator('.label')).toHaveCSS('opacity', '1');
	});

	test('a change a setting makes ahead is shown, even though it is ahead', async ({ page }) => {
		await open(page);
		await page.locator('[data-setting="oidc"] input').check();
		await expect(row(page, 'userinfo-request').locator('.label')).toHaveCSS('opacity', '1');
		await expect(page.locator('[data-chip="token-response:id_token"]')).not.toHaveCSS(
			'opacity',
			'0'
		);
	});

	test('every message has its number', async ({ page }) => {
		await open(page);
		await expect(row(page, 'authorize').locator('.number')).toHaveText('3');
		await expect(row(page, 'authorize')).toHaveAccessibleName(/3.*GET \/authorize/);
		await expect(row(page, 'authorize')).toHaveAccessibleDescription(
			"User's browser to Identity provider"
		);
	});

	test('the two sides of the current message stand out', async ({ page }) => {
		await open(page, 'step=token-request');
		await expect(page.locator('[data-lifeline="app"]')).toHaveClass(/active/);
		await expect(page.locator('[data-lifeline="idp"]')).toHaveClass(/active/);
		await expect(page.locator('[data-lifeline="browser"]')).not.toHaveClass(/active/);
	});
});

test.describe('how a message travels', () => {
	test('shows on the diagram and in the detail', async ({ page }) => {
		await open(page, 'step=redirect-with-code');
		await expect(row(page, 'redirect-with-code')).toHaveAttribute('data-channel', 'front');
		await expect(row(page, 'token-request')).toHaveAttribute('data-channel', 'back');
		await expect(page.getByTestId('step-channel')).toContainText('Through the browser');
		await page.getByTestId('next').click();
		await page.getByTestId('next').click();
		await expect(page.getByTestId('step-channel')).toContainText('Direct');
	});

	test('is explained in the legend, which follows the diagram', async ({ page }) => {
		await open(page);
		const legend = page.getByTestId('channel-legend');
		await expect(legend).toContainText('Through the browser');
		await expect(legend).toContainText('Direct');
		await expect(legend).not.toContainText('People');
		await open(page, '', 'setup');
		await expect(legend).toContainText('People');
		await expect(legend).not.toContainText('Through the browser');
	});
});

test.describe('what each has seen', () => {
	const held = (page: import('@playwright/test').Page, lane: string, artifact: string) =>
		page.locator(`[data-held="${lane}:${artifact}"]`);

	test('builds up as the flow goes on', async ({ page }) => {
		await open(page);
		await expect(held(page, 'browser', 'password')).toHaveCount(0);
		await expect(held(page, 'app', 'secret')).toBeVisible();
		await expect(held(page, 'browser', 'code')).toHaveCount(0);

		await pressRow(page, 'redirect-with-code');
		await expect(held(page, 'browser', 'code')).toBeVisible();
		await expect(held(page, 'app', 'code')).toHaveCount(0);

		await pressRow(page, 'token-response');
		await expect(held(page, 'app', 'access-token')).toBeVisible();
		await expect(held(page, 'browser', 'access-token')).toHaveCount(0);

		await pressRow(page, 'api-request');
		await expect(held(page, 'api', 'access-token')).toBeVisible();
	});

	test('goes back when you do', async ({ page }) => {
		await open(page, 'step=token-response');
		await expect(held(page, 'app', 'access-token')).toBeVisible();
		await page.getByTestId('back').click();
		await expect(held(page, 'app', 'access-token')).toHaveCount(0);
	});

	test('is there for a screen reader too', async ({ page }) => {
		await open(page, 'step=token-response');
		await expect(page.locator('[data-lifeline="app"]')).toHaveAccessibleDescription(
			'Has seen: client secret, code, access token, refresh token.'
		);
	});
});

test.describe('how we know', () => {
	test('each message says where it comes from', async ({ page }) => {
		await open(page, 'step=token-request');
		await expect(page.getByTestId('payload-origin')).toContainText('Keycloak');
		await expect(page.getByTestId('step-known')).toHaveCount(0);
	});

	test('what Keycloak did not do is marked on the diagram and in the detail', async ({ page }) => {
		await open(page, 'binding=dpop&nonce=1&step=nonce-challenge');
		await expect(page.getByTestId('step-known')).toHaveAttribute('data-known', 'spec');
		await expect(page.getByTestId('step-known')).toContainText('RFC 9449 section 8');
		await expect(page.locator('[data-chip="nonce-challenge:spec only"]')).toBeVisible();
	});

	test('it says when the server had no part in a message', async ({ page }) => {
		await open(page, 'step=api-response');
		await expect(page.getByTestId('step-known')).toContainText('demo app and API');
		await expect(page.getByTestId('step-known')).not.toContainText('Recorded from');
	});

	test('someone new is still told what only came from the spec', async ({ page }) => {
		await open(page, 'mode=simple&binding=dpop&nonce=1&step=nonce-challenge');
		await expect(page.getByTestId('step-known')).toHaveAttribute('data-known', 'spec');
	});

	test('a step says which setting brought it here', async ({ page }) => {
		await open(page, 'oidc=1&step=validate-id-token');
		await expect(page.getByText('Here because of:')).toContainText('OpenID Connect');
	});

	test('it says when these settings were not recorded', async ({ page }) => {
		await open(page, 'oidc=1&consent=1&step=token-response');
		await expect(page.getByTestId('step-known')).toHaveAttribute('data-known', 'other-settings');
		await expect(page.getByTestId('provenance')).toContainText('not these together');
		await expect(page.getByTestId('provenance')).not.toContainText('Recorded from');
	});

	test('someone new is not told about it on every step', async ({ page }) => {
		await open(page, 'mode=simple&step=token-response');
		await expect(page.getByTestId('step-known')).toHaveCount(0);
	});

	test('a step with nothing on the wire makes no claim', async ({ page }) => {
		await open(page, '', 'setup');
		await expect(page.getByTestId('step-known')).toHaveCount(0);
		await expect(page.getByTestId('provenance')).toContainText('Its HTTP was recorded from');
	});

	test('it says when the app was a server standing in for one in a page', async ({ page }) => {
		await open(page, 'client=public&step=token-response');
		await expect(page.getByTestId('payload-origin')).toContainText('standing in');
		await open(page, 'step=token-response');
		await expect(page.getByTestId('payload-origin')).not.toContainText('standing in');
	});

	test('a line about what libraries do names some', async ({ page }) => {
		await open(page, 'step=callback');
		const examples = page.getByTestId('step-practice-examples');
		await expect(examples).toContainText('passport-oauth2');
		await expect(examples.getByRole('link', { name: 'Spring Security' })).toHaveAttribute(
			'href',
			/^https:\/\/github\.com/
		);
	});

	test('the screen names its specs and the server it was checked against', async ({ page }) => {
		await open(page, 'oidc=1');
		const line = page.getByTestId('provenance');
		await expect(line).toContainText('RFC 6749');
		await expect(line).toContainText('OpenID Connect Core 1.0');
		await expect(line).toContainText(
			/Recorded from\s+Keycloak \d+\.\d+\.\d+ on\s+\d{4}-\d{2}-\d{2}/
		);
	});
});

test.describe('nothing an automated check can find', () => {
	const screens: readonly [string, string][] = [
		['the start page', './'],
		['the user flow', 'authorization-code/?oidc=1&step=token-response'],
		['advanced mode', 'authorization-code/?mode=advanced&oidc=1&step=token-response'],
		['a request with Execute', 'authorization-code/?mode=advanced&step=token-request'],
		[
			'a state with no recording',
			'authorization-code/?mode=advanced&oidc=1&binding=dpop&step=token-request'
		],
		['a request carrying values', 'authorization-code/?mode=advanced&step=callback'],
		['an explanation', 'authorization-code/?step=authorize&explain=lifeline.idp'],
		['setup', 'authorization-code/setup/?broker=1'],
		['an open source', 'authorization-code/?source=rfc6749&for=client&section=2.1'],
		['running it yourself', 'run-it-yourself/'],
		['what a party never saw', 'authorization-code/?mode=simple&eyes=browser&step=token-response'],
		[
			'what a party never saw, raw',
			'authorization-code/?mode=advanced&eyes=browser&step=token-response'
		],
		['one thing followed', 'authorization-code/?mode=simple&follow=code&step=authorize']
	];

	for (const scheme of ['light', 'dark'] as const) {
		test.describe(scheme, () => {
			test.use({ colorScheme: scheme });

			for (const [name, path] of screens) {
				test(`on ${name}`, async ({ page }) => {
					await page.goto(path);
					await page.waitForLoadState('networkidle');
					const { violations } = await new AxeBuilder({ page }).analyze();
					expect(
						violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)
					).toEqual([]);
				});
			}
		});
	}
});

test.describe('the rail, which stops repeating itself (#63)', () => {
	const sentences = (page: Page) => page.locator('[data-testid="setting-about"]:visible');

	test('says what never changes only when it is asked', async ({ page }) => {
		await open(page, 'mode=simple');
		await expect(sentences(page)).toHaveCount(0);
		const words = (await page.locator('aside.settings').innerText()).split(/\s+/);
		expect(words.length).toBeLessThan(45);
	});

	test('says it while someone is on it, and while the setting is on', async ({ page }) => {
		await open(page, 'mode=simple');
		await page.locator('[data-setting="pkce"] input').focus();
		await expect(sentences(page)).toHaveCount(1);
		await page.locator('[data-setting="pkce"] input').check();
		await page.locator('[data-setting="pkce"] input').blur();
		await expect(sentences(page)).toHaveCount(1);
		await expect(page.locator('[data-setting="pkce"]')).toContainText('The app proves');
	});

	test('still has the same words behind its Why', async ({ page }) => {
		await open(page, 'mode=simple');
		await page.locator('[data-why="pkce"]').click();
		await expect(page.getByTestId('explanation')).toContainText('The app proves it started');
	});

	test('tells a screen reader either way', async ({ page }) => {
		await open(page, 'mode=simple');
		await expect(page.locator('[data-setting="pkce"]')).toHaveAttribute(
			'aria-describedby',
			'about-pkce'
		);
	});
});

test.describe('the diagram, where one thing stands out (#63)', () => {
	test('fills in the number of the current step, and no other', async ({ page }) => {
		await open(page, 'step=callback');
		const filled = (step: string) =>
			page
				.locator(`[data-step="${step}"] .number circle`)
				.evaluate((circle) => getComputedStyle(circle).fill);
		const background = await page
			.locator('.heads-band')
			.evaluate((band) => getComputedStyle(band).backgroundColor);
		expect(await filled('callback')).not.toBe(background);
		expect(await filled('authorize')).toBe(background);
	});

	test('has no band under the heads, and gets a line when something is scrolled under them', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1280, height: 520 });
		await open(page, 'oidc=1');
		const band = page.locator('.heads-band');
		await expect(band).not.toHaveClass(/scrolled/);
		await page.locator('.scroller').evaluate((scroller) => {
			scroller.scrollTop = 100;
		});
		await expect(band).toHaveClass(/scrolled/);
	});

	test('keeps the words of a message together however they wrap', async ({ page }) => {
		await page.setViewportSize({ width: 1024, height: 700 });
		await open(page, 'mode=simple&sso=1&step=second-authorize');
		await expect(page.locator('[data-step="second-authorize"]')).toContainText(
			'The browser asks to log in, and its session goes along'
		);
	});
});
