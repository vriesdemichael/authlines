import { expect, test } from '@playwright/test';
import { authorizationCodeBase as base } from '../../src/lib/flow/index.ts';
import { presetSearch } from '../../src/lib/flow/state.ts';
import {
	currentSearch,
	expectedFor,
	expectMatchesModel,
	FLOW_PATH,
	open,
	openWithSettings,
	visibleStepIds,
	watchForErrors
} from './helpers.ts';

// Literal on purpose. These links are public once shipped, and must keep opening the same state
// (ADR-003), so a change that breaks one has to show up here and not pass through a helper.
const STABLE_URLS = [
	{ search: '', step: 'open-app', stepCount: 12, lifelines: 4 },
	{ search: 'oidc=1', step: 'open-app', stepCount: 15, lifelines: 4 },
	{ search: 'binding=dpop', step: 'open-app', stepCount: 13, lifelines: 4 },
	{ search: 'binding=dpop&nonce=1', step: 'open-app', stepCount: 15, lifelines: 4 },
	{ search: 'pkce=1', step: 'open-app', stepCount: 14, lifelines: 4 },
	{ search: 'client=public&pkce=1', step: 'open-app', stepCount: 14, lifelines: 4 },
	{ search: 'broker=1', step: 'open-app', stepCount: 18, lifelines: 5 },
	{ search: 'broker=1&upstream=v1', step: 'open-app', stepCount: 22, lifelines: 5 },
	{ search: 'broker=1&upstream=v2', step: 'open-app', stepCount: 22, lifelines: 5 },
	{ search: 'oidc=1&step=token-response', step: 'token-response', stepCount: 15, lifelines: 4 },
	{ search: 'setup=1', step: 'register-client', stepCount: 9, lifelines: 5 },
	{ search: 'step=discover', step: 'discover', stepCount: 9, lifelines: 5 },
	{
		search: 'oidc=1&binding=dpop&nonce=1&broker=1&upstream=v1&step=call-upstream',
		step: 'call-upstream',
		stepCount: 28,
		lifelines: 5
	}
];

test.describe('links', () => {
	for (const { search, step, stepCount, lifelines } of STABLE_URLS) {
		test(`?${search} keeps opening the same state`, async ({ page }) => {
			const check = watchForErrors(page);
			await open(page, search);
			await expect(page.locator('[data-step]')).toHaveCount(stepCount);
			await expect(page.locator('[data-lifeline]')).toHaveCount(lifelines);
			await expect(page.locator('[data-state="current"]')).toHaveAttribute('data-step', step);
			await expectMatchesModel(page, search);
			check();
		});
	}

	test('a link survives a reload', async ({ page }) => {
		const search = 'oidc=1&step=token-response';
		await open(page, search);
		await page.reload();
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expectMatchesModel(page, search);
	});

	test('opening a link reports no change, because nothing changed', async ({ page }) => {
		await open(page, 'oidc=1&broker=1');
		await expectMatchesModel(page, 'oidc=1&broker=1');
		await expect(page.getByTestId('change-summary')).toHaveCount(0);
	});

	test('a link to a page that does not exist gets the 404 page', async ({ page }) => {
		const response = await page.goto('no-such-flow/');
		expect(response?.status()).toBe(404);
		await expect(page.getByTestId('error-message')).toContainText('There is no page here');
	});
});

test.describe('walking the steps', () => {
	for (const preset of base.presets) {
		test(`${preset.title}: Next and Back cover every step`, async ({ page }) => {
			const check = watchForErrors(page);
			const search = presetSearch(base, preset.settings);
			const { steps, view } = expectedFor(`mode=advanced&${search}`);
			await open(page, search);

			for (const [i, id] of steps.entries()) {
				await expect(page.locator('[data-state="current"]')).toHaveAttribute('data-step', id);
				await expect(page.getByTestId('position')).toHaveText(`Step ${i + 1} of ${steps.length}`);
				const step = view.steps.find((s) => s.id === id);
				await expect(page.getByTestId('step-detail').getByRole('heading').first()).toHaveText(
					step!.label
				);
				if (i < steps.length - 1) await page.getByTestId('next').click();
			}
			await expect(page.getByTestId('next')).toBeDisabled();

			for (const id of [...steps].reverse()) {
				await expect(page.locator('[data-state="current"]')).toHaveAttribute('data-step', id);
				if (id !== steps[0]) await page.getByTestId('back').click();
			}
			check();
		});
	}

	test('the arrow keys step as well', async ({ page }) => {
		await open(page);
		await page.keyboard.press('ArrowRight');
		await page.keyboard.press('ArrowRight');
		await expect(page.locator('[data-state="current"]')).toHaveAttribute('data-step', 'authorize');
		await page.keyboard.press('ArrowLeft');
		await expect(page.locator('[data-state="current"]')).toHaveAttribute(
			'data-step',
			'redirect-to-idp'
		);
		await expect.poll(() => currentSearch(page)).toBe('step=redirect-to-idp');
	});

	test('clicking a message selects it', async ({ page }) => {
		await open(page);
		await page.locator('[data-step="token-request"]').click();
		await expect(page.locator('[data-state="current"]')).toHaveAttribute(
			'data-step',
			'token-request'
		);
		await expect(page.getByTestId('step-detail')).toContainText('grant_type=authorization_code');
	});

	test('moving between steps does not fill the browser history', async ({ page }) => {
		await page.goto('./');
		await page.getByTestId('node-how-access-works').click();
		await page.getByTestId('next').click();
		await page.getByTestId('next').click();
		await page.goBack();
		await expect(page).toHaveURL('./');
	});
});

test.describe('settings', () => {
	const toggle = (page: import('@playwright/test').Page, id: string) =>
		page.locator(`[data-setting="${id}"] input[type="checkbox"]`);
	const option = (page: import('@playwright/test').Page, id: string, value: string) =>
		page.locator(`[data-setting="${id}"] input[value="${value}"]`);

	test('OIDC changes messages and adds steps, in the URL too', async ({ page }) => {
		const check = watchForErrors(page);
		await openWithSettings(page);
		await toggle(page, 'oidc').check();
		await expectMatchesModel(page, 'oidc=1');
		await expect.poll(() => currentSearch(page)).toBe('oidc=1');
		await expect(page.locator('[data-chip="authorize:scope=openid"]')).toBeVisible();
		await expect(page.locator('[data-chip="token-response:id_token"]')).toBeVisible();
		await expect(page.getByTestId('change-summary')).toContainText('3 steps added');
		check();
	});

	test('PKCE sends a fingerprint through the browser and keeps the verifier out of it', async ({
		page
	}) => {
		const check = watchForErrors(page);
		await openWithSettings(page, 'client=public&step=token-request');
		const heldByBrowser = page.locator('[data-lifeline="browser"] [data-artifact]');
		const pitfall = page.getByTestId('step-pitfall');
		await expect(pitfall).toContainText('gets the tokens');

		await toggle(page, 'pkce').check();
		await expectMatchesModel(page, 'client=public&pkce=1&step=token-request');
		await expect(page.getByTestId('change-summary')).toContainText('2 steps added');
		await expect(page.locator('[data-chip="authorize:code_challenge"]')).toBeVisible();
		await expect(page.locator('[data-chip="token-request:code_verifier"]')).toBeVisible();
		await expect(pitfall).toContainText('they get nothing');
		// A phone has no room under a head for what it has seen, so the head says it when asked.
		if (await page.getByTestId('diagram').evaluate((element) => element.matches('.strip'))) {
			await page.getByTestId('settings-toggle').click();
			// Its box, where a finger goes. The middle of all of it is under the next lane's name.
			await page.locator('[data-lifeline="browser"] rect').click();
			await expect(page.getByTestId('explanation-seen')).toContainText('challenge');
			await expect(page.getByTestId('explanation-seen')).not.toContainText('verifier');
		} else {
			await expect(heldByBrowser.filter({ hasText: 'challenge' })).toBeVisible();
			await expect(heldByBrowser.filter({ hasText: 'verifier' })).toHaveCount(0);
		}
		check();
	});

	test('the back button undoes a setting', async ({ page }) => {
		await openWithSettings(page);
		await toggle(page, 'oidc').check();
		await expectMatchesModel(page, 'oidc=1');
		await page.goBack();
		await expectMatchesModel(page, '');
		await expect(toggle(page, 'oidc')).not.toBeChecked();
	});

	test('a setting that removes the current step moves to the nearest earlier one', async ({
		page
	}) => {
		await openWithSettings(page, 'oidc=1&step=userinfo-response');
		await toggle(page, 'oidc').uncheck();
		await expect(page.locator('[data-state="current"]')).toHaveAttribute(
			'data-step',
			'token-response'
		);
		await expect.poll(() => currentSearch(page)).toBe('step=token-response');
	});

	test('brokering adds a lifeline and a nested flow', async ({ page }) => {
		await openWithSettings(page);
		await toggle(page, 'broker').check();
		await expectMatchesModel(page, 'broker=1');
		await expect(page.locator('[data-lifeline="upstream"]')).toBeVisible();
		await expect(page.locator('[data-group="brokered-login"]')).toBeVisible();
		await expect(page.locator('[data-step="login-page"]')).toHaveCount(0);
	});

	test('a setting is only offered when what it needs holds', async ({ page }) => {
		await openWithSettings(page);
		await expect(page.locator('[data-setting="dpopNonce"]')).toHaveCount(0);
		await expect(page.locator('[data-setting="upstreamTokens"]')).toHaveCount(0);
		await option(page, 'binding', 'dpop').check();
		await expect(page.locator('[data-setting="dpopNonce"]')).toBeVisible();
		await toggle(page, 'broker').check();
		await expect(page.locator('[data-setting="upstreamTokens"]')).toBeVisible();
	});

	test('an option that cannot apply says why', async ({ page }) => {
		await openWithSettings(page, 'client=public&broker=1');
		await expect(option(page, 'upstreamTokens', 'v2')).toBeDisabled();
		await expect(page.locator('[data-setting="upstreamTokens"]')).toContainText(
			'API V2 only works with a confidential client and a Bearer token.'
		);
	});

	test('a change that breaks another setting resets it and says so', async ({ page }) => {
		await openWithSettings(page, 'broker=1&upstream=v2');
		await option(page, 'clientType', 'public').check();
		await expectMatchesModel(page, 'client=public&broker=1');
		await expect(page.getByTestId('change-summary')).toContainText(
			'API V2 only works with a confidential client and a Bearer token.'
		);
	});

	test('a link to what is no longer offered falls back to what still is', async ({ page }) => {
		// This one worked until a recording showed that Keycloak refuses it.
		await openWithSettings(page, 'binding=dpop&broker=1&upstream=v2');
		await expectMatchesModel(page, 'binding=dpop&broker=1');
	});

	test('an invalid link falls back to a valid state', async ({ page }) => {
		await openWithSettings(page, 'client=public&broker=1&upstream=v2&nonce=1&binding=magic');
		await expectMatchesModel(page, 'client=public&broker=1');
	});
});

test.describe('the transition', () => {
	test.use({ contextOptions: { reducedMotion: 'no-preference' } });

	test('animates a toggle as a change, not a redraw', async ({ page }) => {
		await openWithSettings(page);
		const before = await page
			.locator('[data-step="token-request"] line')
			.first()
			.getAttribute('y1');
		await page.locator('[data-setting="broker"] input').check();

		const diagram = page.getByTestId('diagram');
		await expect(diagram).toHaveAttribute('data-animating', 'true');
		// Something that stays is mid-move: neither where it was nor where it ends up.
		await expect
			.poll(async () => {
				const y = await page.locator('[data-step="token-request"] line').first().getAttribute('y1');
				return y !== before && !Number.isInteger(Number(y));
			})
			.toBe(true);
		await expect(diagram).toHaveAttribute('data-animating', 'false');
		await expectMatchesModel(page, 'broker=1');
	});

	test('keeps the same elements, so nothing is redrawn', async ({ page }) => {
		await openWithSettings(page);
		await page.getByTestId('diagram').waitFor();
		await page.locator('[data-step="token-request"]').evaluate((row) => {
			row.setAttribute('data-kept', 'yes');
		});
		await page.locator('[data-setting="oidc"] input').check();
		await expect(page.getByTestId('diagram')).toHaveAttribute('data-animating', 'false');
		await expect(page.locator('[data-step="token-request"]')).toHaveAttribute('data-kept', 'yes');
	});

	test('survives a toggle flipped mid-transition', async ({ page }) => {
		const check = watchForErrors(page);
		await openWithSettings(page);
		const broker = page.locator('[data-setting="broker"] input');
		await broker.check();
		await broker.uncheck();
		await broker.check();
		await expect(page.getByTestId('diagram')).toHaveAttribute('data-animating', 'false');
		await expectMatchesModel(page, 'broker=1');
		check();
	});

	test('opening a link does not animate', async ({ page }) => {
		await openWithSettings(page, 'broker=1');
		await expect(page.getByTestId('diagram')).toHaveAttribute('data-animating', 'false');
		await expectMatchesModel(page, 'broker=1');
	});
});

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('the prerendered page still shows the diagram', async ({ page }) => {
		await page.goto(FLOW_PATH);
		const { steps } = expectedFor('');
		expect(await visibleStepIds(page)).toEqual(steps);
		await expect(page.getByTestId('step-detail')).toContainText('The user opens the app');
		await expect(page).toHaveTitle('Authorization code flow');
	});
});

// An agent's link to someone's own setup: their names on a recorded flow (#168, ADR-017).
test.describe('a link with names', () => {
	const named = '#v=1&app=Payroll&idp=Entra%20ID&api=HR%20API';
	const ready = (page: import('@playwright/test').Page) =>
		page.locator('.workspace[data-ready="true"]').waitFor();
	const app = (page: import('@playwright/test').Page) => page.locator('[data-lifeline="app"]');

	test('names the parties, keeps them while stepping, and lets them go', async ({ page }) => {
		const check = watchForErrors(page);
		await page.goto(`${FLOW_PATH}?mode=advanced&step=token-request${named}`);
		await ready(page);
		await expect(app(page)).toContainText('Payroll');
		await expect(app(page)).toContainText('App');
		await expect(page.getByTestId('names-note')).toContainText('Payroll for the app');
		await expect(page.getByTestId('names-seam')).toContainText('Payroll is demo-app');
		await page.getByTestId('next').click();
		await expect(page).toHaveURL(/step=token-response#v=1&app=Payroll/);
		await expect(app(page)).toContainText('Payroll');
		await page.getByTestId('names-off').click();
		await expect(page).not.toHaveURL(/#/);
		await expect(app(page)).not.toContainText('Payroll');
		await expect(page.getByTestId('names-note')).toHaveCount(0);
		check();
	});

	test('draws the site’s own names for a link that does not fit, and says why', async ({
		page
	}) => {
		await page.goto(`${FLOW_PATH}#app=Payroll`);
		await ready(page);
		await expect(page.getByTestId('names-problems')).toContainText('no version');
		await expect(app(page)).not.toContainText('Payroll');
	});

	test('shows a name only as text, and refuses markup', async ({ page }) => {
		let alerted = false;
		page.on('dialog', async (dialog) => {
			alerted = true;
			await dialog.dismiss();
		});
		await page.goto(
			`${FLOW_PATH}#v=1&app=${encodeURIComponent('<img src=x onerror=alert(1)>')}&idp=${encodeURIComponent('Pay & "roll"')}`
		);
		await ready(page);
		await expect(page.getByTestId('names-problems')).toContainText('has < or >');
		await expect(page.locator('img[src="x"]')).toHaveCount(0);
		await expect(page.locator('[data-lifeline="idp"]')).toContainText('Pay & "roll"');
		expect(alerted).toBe(false);
	});

	test('opens every example on the page for agents, with nothing left out', async ({ page }) => {
		await page.goto('for-agents/');
		const links = await page
			.getByTestId('example')
			.evaluateAll((all) => all.map((link) => (link as HTMLAnchorElement).href));
		expect(links.length).toBeGreaterThan(3);
		for (const href of links) {
			await page.goto(href);
			await ready(page);
			await expect(page.getByTestId('names-note'), href).toBeVisible();
			await expect(page.getByTestId('names-problems'), href).toHaveCount(0);
		}
	});
});

// Someone naming a party themselves, which a stray click must never do (#168).
test.describe('naming a party by hand', () => {
	const ready = (page: import('@playwright/test').Page) =>
		page.locator('.workspace[data-ready="true"]').waitFor();
	const head = (page: import('@playwright/test').Page, id: string) =>
		page.locator(`[data-lifeline="${id}"]`);

	test('a right-click opens the name field, and Back undoes the name', async ({ page }) => {
		await page.goto(`${FLOW_PATH}?mode=advanced`);
		await ready(page);
		await head(page, 'app').locator('rect').first().click({ button: 'right' });
		await expect(page.getByTestId('rename-field')).toBeFocused();
		await page.keyboard.type('Payroll');
		await page.keyboard.press('Enter');
		await expect(page).toHaveURL(/#v=1&app=Payroll/);
		await expect(head(page, 'app')).toContainText('Payroll');
		await page.goBack();
		await expect(page).not.toHaveURL(/app=Payroll/);
		await expect(head(page, 'app')).not.toContainText('Payroll');
	});

	test('refuses a name that does not fit, and says why', async ({ page }) => {
		await page.goto(`${FLOW_PATH}?mode=advanced&explain=lifeline.idp`);
		await ready(page);
		await page.getByTestId('rename-field').fill('<b>Entra</b>');
		await page.getByTestId('rename-apply').click();
		await expect(page.getByTestId('rename-refused')).toContainText('has < or >');
		await expect(page).not.toHaveURL(/#/);
	});

	test('goes back to the site’s name from the field', async ({ page }) => {
		await page.goto(`${FLOW_PATH}?mode=advanced&explain=lifeline.app#v=1&app=Payroll&idp=Entra`);
		await ready(page);
		await page.getByTestId('rename-reset').click();
		await expect(page).toHaveURL(/#v=1&idp=Entra$/);
		await expect(head(page, 'app')).not.toContainText('Payroll');
		await expect(head(page, 'idp')).toContainText('Entra');
	});

	test('is not on offer in simple mode, where a click only explains', async ({ page }) => {
		await page.goto(`${FLOW_PATH}?mode=simple`);
		await ready(page);
		await head(page, 'app').locator('rect').first().click();
		await expect(page.getByTestId('explanation')).toBeVisible();
		await expect(page.getByTestId('rename')).toHaveCount(0);
	});

	test('a long press on a touch screen opens the name field', async ({ page }) => {
		await page.goto(`${FLOW_PATH}?mode=advanced`);
		await ready(page);
		const box = (await head(page, 'app').locator('rect').first().boundingBox())!;
		const at = { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 };
		await head(page, 'app').dispatchEvent('pointerdown', { pointerType: 'touch', ...at });
		await page.waitForTimeout(700);
		await head(page, 'app').dispatchEvent('pointerup', { pointerType: 'touch', ...at });
		await expect(page.getByTestId('rename-field')).toBeFocused();
	});
});
