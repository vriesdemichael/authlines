import { expect, test } from '@playwright/test';
import { open } from './helpers.ts';

// Fonts render differently on each system, so the baselines come from one Linux image, the one CI
// runs in. `pnpm test:visual:update` regenerates them after a deliberate change to the look.
test.skip(
	process.platform !== 'linux' || Boolean(process.env.LIVE_URL),
	'Baselines are only for the Linux image CI runs in'
);

const states: readonly [string, string, 'flow' | 'setup'][] = [
	['simple-first-step', 'mode=simple', 'flow'],
	['the-old-way', 'mode=simple&oldway=1&step=old-way-answer', 'flow'],
	['registers-itself', 'register=dcr&step=dcr-response', 'setup'],
	['in-a-directory', 'directory=1&step=directory-bind', 'flow'],
	['customer-on-saml', 'broker=1&companies=1&speaks=saml&step=upstream-callback', 'flow'],
	['customer-setup', 'broker=1&companies=1&speaks=saml&step=send-their-details', 'setup'],
	[
		'points-at-a-document',
		'register=cimd&client=public&pkce=1&consent=1&step=cimd-document',
		'flow'
	],
	['document-setup', 'register=cimd&client=public&pkce=1&consent=1&step=cimd-host', 'setup'],
	['simple-token-response', 'mode=simple&oidc=1&step=token-response', 'flow'],
	['simple-explanation', 'mode=simple&step=callback&explain=artifact.code', 'flow'],
	['refresh-picture', 'mode=simple&step=token-response&explain=artifact.refresh-token', 'flow'],
	['who-knows-whom', 'mode=simple&broker=1&oidc=1&explain=lifeline.idp', 'flow'],
	['trust-across-providers', 'mode=simple&explain=setting.broker', 'flow'],
	['how-an-api-trusts-a-token', 'mode=simple&step=api-check-token&explain=term.issuer', 'flow'],
	['which-token-is-for-whom', 'mode=simple&step=token-response&explain=term.token', 'flow'],
	['how-long-each-lasts', 'mode=simple&explain=term.session', 'flow'],
	['what-stops-what', 'mode=simple&explain=setting.pkce', 'flow'],
	['where-the-tokens-are', 'mode=simple&explain=setting.appRuns', 'flow'],
	['what-each-spec-adds', 'mode=simple&explain=term.oauth', 'flow'],
	['what-is-in-a-token-here', 'mode=advanced&explain=term.realm', 'flow'],
	['what-each-factor-proves', 'mode=simple&step=submit-credentials&explain=term.mfa', 'flow'],
	['what-a-thief-can-do', 'mode=simple&step=submit-credentials&explain=artifact.password', 'flow'],
	['address-refused', 'mode=simple&address=other&step=address-refused', 'flow'],
	[
		'the-token-in-the-address',
		'mode=simple&implicit=1&runs=page&client=public&step=callback',
		'flow'
	],
	['app-in-the-page', 'mode=simple&runs=page&client=public&pkce=1&step=token-response', 'flow'],
	['server-behind-the-page', 'mode=simple&runs=bff&pkce=1&step=set-session', 'flow'],
	['settings-put-away', 'settings=off&step=callback', 'flow'],
	['at-the-end-of-a-question', 'mode=simple&step=api-response', 'flow'],
	['simple-setup', 'mode=simple&step=hand-over-credentials', 'setup'],
	['simple-pkce', 'mode=simple&client=public&pkce=1&step=check-verifier', 'flow'],
	['simple-time-passing', 'mode=simple&refresh=1&step=token-runs-out', 'flow'],
	['simple-second-app', 'mode=simple&sso=1&oidc=1&step=idp-recognises', 'flow'],
	['simple-after-a-logout', 'mode=simple&oidc=1&logout=1&step=token-after-logout-response', 'flow'],
	['first-step', '', 'flow'],
	['token-response', 'step=token-response', 'flow'],
	['openid-connect', 'oidc=1&step=token-response', 'flow'],
	['pkce', 'pkce=1&step=token-request', 'flow'],
	['on-the-wire', 'step=callback', 'flow'],
	['no-recording', 'oidc=1&binding=dpop&step=callback', 'flow'],
	['dpop-with-nonce', 'binding=dpop&nonce=1&step=nonce-challenge', 'flow'],
	['external-idp', 'broker=1&step=upstream-authorize', 'flow'],
	['everything', 'oidc=1&binding=dpop&nonce=1&broker=1&upstream=v1&step=token-request', 'flow'],
	['setup', '', 'setup'],
	['setup-with-external-idp', 'broker=1&upstream=v2&step=register-with-upstream', 'setup'],
	['left-to-you', 'mode=simple&oidc=1&step=token-request&list=1', 'flow'],
	['handed-to-the-app', 'mode=simple&attacker=1&uses=real-app&step=attacker-handed-answer', 'flow'],
	[
		'handed-to-the-app-pkce',
		'mode=simple&attacker=1&uses=real-app&pkce=1&step=handed-token-response',
		'flow'
	],
	[
		'a-link-of-theirs',
		'attacker=1&gets=link&registered=any&client=public&pkce=1&step=code-to-attacker',
		'flow'
	],
	[
		'the-whole-flow',
		'oidc=1&binding=dpop&nonce=1&broker=1&upstream=v1&step=token-request&whole=1',
		'flow'
	],
	['raw-traffic-large', 'step=token-response&raw=1', 'flow'],
	['the-login-page', 'mode=simple&step=login-page', 'flow'],
	['the-code-in-the-address', 'mode=simple&step=callback', 'flow'],
	['in-the-specs-words', 'mode=simple&say=specs&step=token-request', 'flow'],
	['in-the-specs-words-with-oidc', 'mode=simple&say=specs&oidc=1&step=token-request', 'flow'],
	['in-keycloaks-words', 'mode=simple&say=keycloak&broker=1&step=upstream-authorize', 'flow'],
	['seen-as-the-browser', 'mode=simple&eyes=browser&step=token-response', 'flow'],
	['seen-as-the-browser-raw', 'eyes=browser&step=token-response', 'flow'],
	[
		'following-the-verifier',
		'mode=simple&client=public&pkce=1&follow=verifier&step=authorize',
		'flow'
	]
];

for (const scheme of ['light', 'dark'] as const) {
	test.describe(scheme, () => {
		test.use({ colorScheme: scheme, viewport: { width: 1440, height: 900 } });

		test('the map', async ({ page }) => {
			await page.goto('./');
			// It loads after the page, and the picture without it is not the home screen.
			await expect(page.getByTestId('living')).toBeVisible();
			await page.mouse.move(0, 0);
			await expect(page).toHaveScreenshot(`map-${scheme}.png`, {
				fullPage: true,
				maxDiffPixelRatio: 0.002
			});
		});

		test('a flow with no user', async ({ page }) => {
			await page.goto('client-credentials/?step=service-token-response');
			await page.locator('.workspace[data-ready="true"]').waitFor();
			await page.mouse.move(0, 0);
			await expect(page).toHaveScreenshot(`no-user-${scheme}.png`, {
				maxDiffPixelRatio: 0.002
			});
		});

		test('a flow on two devices', async ({ page }) => {
			await page.goto('device/?step=device-consent-page');
			await page.locator('.workspace[data-ready="true"]').waitFor();
			await page.mouse.move(0, 0);
			await expect(page).toHaveScreenshot(`device-${scheme}.png`, {
				maxDiffPixelRatio: 0.002
			});
		});

		test('running it yourself', async ({ page }) => {
			await page.goto('run-it-yourself/');
			await expect(page.locator('[data-ready="true"]')).toBeVisible();
			await page.mouse.move(0, 0);
			await expect(page).toHaveScreenshot(`run-it-yourself-${scheme}.png`, {
				fullPage: true,
				maxDiffPixelRatio: 0.002
			});
		});

		for (const [name, search, diagram] of states) {
			test(name, async ({ page }) => {
				await open(page, search, diagram);
				await expect(page.getByTestId('recording-loading')).toHaveCount(0);
				await page.mouse.move(0, 0);
				await expect(page).toHaveScreenshot(`${name}-${scheme}.png`, { maxDiffPixelRatio: 0.002 });
			});
		}

		// A layout of its own (#15, ADR-008): the lanes in a strip, and the picture at its own size.
		test.describe('on a phone', () => {
			test.use({ viewport: { width: 375, height: 812 } });

			for (const [name, search] of [
				['phone-strip', 'mode=simple&attacker=1&step=attacker-token-request'],
				['phone-full-size', 'mode=simple&step=token-request&size=full']
			]) {
				test(name, async ({ page }) => {
					await open(page, search);
					await expect(page.getByTestId('recording-loading')).toHaveCount(0);
					if (search.includes('size=full')) {
						const diagram = page.getByTestId('diagram');
						await expect.poll(() => diagram.evaluate((e) => e.scrollLeft)).toBeGreaterThan(0);
					}
					await expect(page).toHaveScreenshot(`${name}-${scheme}.png`, {
						maxDiffPixelRatio: 0.002
					});
				});
			}
		});
	});
}
