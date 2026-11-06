import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { authorizationCodeBase as base } from '../../src/lib/flow/index.ts';
import { evaluate } from '../../src/lib/flow/model.ts';
import { defaultSettings } from '../../src/lib/flow/settings.ts';
import { presetSearch } from '../../src/lib/flow/state.ts';
import type { Recording } from '../../src/lib/recordings/format.ts';
import { settingsOf } from '../../src/lib/recordings/known.ts';
import { lineText, rawLines } from '../../src/lib/recordings/wire.ts';
import { currentSearch, expectMatchesModel, FLOW_PATH, open, watchForErrors } from './helpers.ts';

const read = (preset: string): Recording =>
	JSON.parse(readFileSync(`static/recordings/authorization-code/${preset}.json`, 'utf8'));

const shownLines = (page: Page) =>
	page
		.locator('[data-testid="payload"] [data-line]')
		.evaluateAll((lines) => lines.map((line) => line.textContent ?? ''));

/** What the file holds for this step, which is the only thing the page may show (ADR-005). */
const inFile = (recording: Recording, step: string) =>
	rawLines(recording.messages.find((message) => message.step === step)!).map(lineText);

const current = (page: Page) => page.locator('[data-step][data-state="current"]');

test.describe('every named state, walked in advanced mode', () => {
	for (const preset of base.presets) {
		test(`${preset.title}: what is shown is what the recording holds`, async ({ page }) => {
			const check = watchForErrors(page);
			const recording = read(preset.id);
			const search = presetSearch(base, preset.settings);
			const { steps } = evaluate(base.diagrams.flow, settingsOf(preset));
			await open(page, search);

			for (const step of steps) {
				await expect(current(page)).toHaveAttribute('data-step', step.id);
				const onTheWire = step.channel === 'front' || step.channel === 'back';
				// Read straight from the file, because rawLines is also what the page itself uses.
				const inTheFile = recording.messages.find((message) => message.step === step.id);
				if (onTheWire && inTheFile) {
					const first = page.locator('[data-testid="payload"] [data-line]').first();
					await expect(first).toContainText(
						inTheFile.log
							? inTheFile.log[0]
							: inTheFile.direction === 'response'
								? String(inTheFile.status)
								: new URL(inTheFile.url!).pathname
					);
				}
				const recorded = recording.messages.some((message) => message.step === step.id);
				if (!onTheWire) {
					await expect(page.getByTestId('on-the-wire')).toHaveCount(0);
				} else if (recorded) {
					await expect.poll(() => shownLines(page)).toEqual(inFile(recording, step.id));
				} else {
					await expect(page.getByTestId('not-recorded')).toBeVisible();
					await expect(page.getByTestId('payload')).toHaveCount(0);
				}
				await expect(page.getByTestId('execute')).toHaveCount(step.execute ? 1 : 0);
				if (step !== steps.at(-1)) await page.getByTestId('next').click();
			}
			check();
		});

		test(`${preset.title}: Execute moves to the answer`, async ({ page }) => {
			const check = watchForErrors(page);
			const recording = read(preset.id);
			const search = presetSearch(base, preset.settings);
			const { steps } = evaluate(base.diagrams.flow, settingsOf(preset));
			const executable = steps.filter((step) => step.execute);
			// A refused address, the app's or a link of theirs, stops before anything comes back to use, and
			// nothing in the old way is used later.
			if (!['address-refused', 'their-link', 'the-old-way'].includes(preset.id)) {
				expect(executable.length).toBeGreaterThan(0);
			}

			for (const step of executable) {
				await open(page, `${search}${search ? '&' : ''}step=${step.id}`);
				await expect.poll(() => shownLines(page)).toEqual(inFile(recording, step.id));
				await page.getByTestId('execute').click();
				await expect(current(page)).toHaveAttribute('data-step', step.execute!);
				await expect(page.getByTestId('answer-to')).toBeVisible();
				await expect.poll(() => shownLines(page)).toEqual(inFile(recording, step.execute!));
				await expect(page.getByTestId('payload')).toBeFocused();
			}
			check();
		});
	}
});

test.describe('Execute', () => {
	test('in setup, gets the addresses the app goes on to use', async ({ page }) => {
		await open(page, 'step=discover', 'setup');
		await page.getByTestId('execute').click();
		await expect(current(page)).toHaveAttribute('data-step', 'discovery-document');
		await expect(page.getByTestId('payload')).toContainText('token_endpoint');
	});

	test('is not offered in simple mode, which shows no values', async ({ page }) => {
		await open(page, 'mode=simple&step=token-request');
		await expect(page.getByTestId('on-the-wire')).toHaveCount(0);
		await expect(page.getByTestId('execute')).toHaveCount(0);
	});

	test('says that nothing is really sent', async ({ page }) => {
		await open(page, 'step=token-request');
		await expect(page.getByText('Nothing is really sent')).toBeVisible();
	});

	test('keeps nothing in the address but the step, so a link is enough', async ({ page }) => {
		await open(page, 'step=token-request');
		await page.getByTestId('execute').click();
		await expect.poll(() => new URL(page.url()).searchParams.get('step')).toBe('token-response');
		const address = page.url();

		await page.goto(address);
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect.poll(() => shownLines(page)).toEqual(inFile(read('oauth'), 'token-response'));
		await expect(page.getByTestId('answer-to')).toHaveCount(0);
		await expect(page.getByTestId('run-values')).toContainText('access_token');
	});
});

test.describe('values carried through a run', () => {
	test('the code that came back is the code that gets sent, and says so', async ({ page }) => {
		await open(page, 'step=redirect-with-code');
		const code = page.locator('[data-new="code"]');
		await expect(code).toBeVisible();
		const returned = await page.locator('[data-line]').filter({ hasText: '&code=' }).textContent();

		await open(page, 'step=token-request');
		const from = page.locator('[data-from="redirect-with-code"]');
		await expect(from).toBeVisible();
		const value = (returned ?? '').split('code=')[1].trim();
		await expect(page.getByTestId('payload')).toContainText(value);

		await from.click();
		await expect(current(page)).toHaveAttribute('data-step', 'redirect-with-code');
	});

	test('earlier steps count as executed, and later ones do not', async ({ page }) => {
		const has = (name: string) => page.locator(`[data-value="${name}"]`);
		await open(page, 'step=authorize');
		await expect(has('state')).toBeVisible();
		await expect(has('code')).toHaveCount(0);

		await open(page, 'step=callback');
		await expect(has('code')).toBeVisible();
		await expect(has('access_token')).toHaveCount(0);

		await open(page, 'step=api-request');
		await expect(has('access_token')).toBeVisible();
	});

	test('a signed token can be opened, to read what is in it', async ({ page }) => {
		await open(page, 'oidc=1&step=token-response');
		const inside = page.getByTestId('jwt').filter({ hasText: 'id_token' });
		await inside.locator('summary').click();
		await expect(inside).toContainText('"preferred_username": "alice"');
	});

	// The maintainer, 2026-11-06: switch between the encoded address and the fields set in it, and
	// decode the token.
	test('can be read decoded, with each token opened where it was sent', async ({ page }) => {
		await open(page, 'step=redirect-with-code');
		const payload = page.getByTestId('payload');
		await expect(payload).toContainText('iss=http%3A%2F%2Flocalhost');
		await expect(page.getByTestId('opened-token')).toHaveCount(0);

		await page.getByTestId('wire-decoded').click();
		await expect.poll(() => currentSearch(page)).toContain('decoded=1');
		await expect(payload).toContainText('iss=http://localhost:18080/realms/demo');
		const token = page.getByTestId('opened-token');
		await expect(token).toHaveCount(1);
		await expect(token).toContainText('"typ": "JWT"');
		await expect(token).toContainText('"sid"');
		// Opened in place, so it is not offered a second time below.
		await expect(page.getByTestId('jwt')).toHaveCount(0);

		await page.reload();
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect(page.getByTestId('wire-decoded')).toHaveAttribute('aria-pressed', 'true');
		await page.getByTestId('wire-as-sent').click();
		await expect(payload).toContainText('iss=http%3A%2F%2Flocalhost');
		await expect(page.getByTestId('jwt')).toHaveCount(1);
	});

	test('is not offered a switch that would change nothing', async ({ page }) => {
		await open(page, 'step=open-app');
		await expect(page.getByTestId('payload')).toBeVisible();
		await expect(page.getByTestId('wire-decoded')).toHaveCount(0);
	});

	test('a long value is short until someone wants all of it', async ({ page }) => {
		await open(page, 'step=token-response');
		const token = page.locator('button.value').first();
		await expect(token).toHaveAttribute('aria-expanded', 'false');
		const closed = (await token.boundingBox())?.height ?? 0;
		await token.click();
		await expect(token).toHaveAttribute('aria-expanded', 'true');
		expect((await token.boundingBox())?.height ?? 0).toBeGreaterThan(closed);
	});
});

test.describe('a combination with no recording', () => {
	const search = 'oidc=1&binding=dpop&step=token-request';

	test('says so and shows no payload', async ({ page }) => {
		await open(page, search);
		await expect(page.getByTestId('no-recording')).toContainText('No recording');
		await expect(page.getByTestId('payload')).toHaveCount(0);
		await expect(page.getByTestId('execute')).toHaveCount(0);
	});

	test('points at the closest that were recorded, at the same step', async ({ page }) => {
		await open(page, search);
		await page.getByTestId('nearest-recording').first().click();
		await expect(current(page)).toHaveAttribute('data-step', 'token-request');
		await expect(page.getByTestId('payload')).toBeVisible();
		await expect(page.getByTestId('no-recording')).toHaveCount(0);
	});

	test('still shows the diagram and the parameters', async ({ page }) => {
		await open(page, search);
		await expectMatchesModel(page, search);
		await expect(page.getByTestId('step-detail')).toContainText('code');
	});
});

test.describe('a message a real server did not send', () => {
	test('says so rather than showing something made up', async ({ page }) => {
		await open(page, 'binding=dpop&nonce=1&step=nonce-challenge');
		await expect(page.getByTestId('not-recorded')).toBeVisible();
		await expect(page.getByTestId('payload')).toHaveCount(0);
	});
});

test.describe('what gets downloaded', () => {
	const recordingsAskedFor = (page: Page) => {
		const asked: string[] = [];
		page.on('request', (request) => {
			if (request.url().includes('/recordings/')) asked.push(request.url());
		});
		return asked;
	};

	test('simple mode loads no recording at all', async ({ page }) => {
		const asked = recordingsAskedFor(page);
		await page.goto(`${FLOW_PATH}?step=token-request`);
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await page.getByTestId('next').click();
		await page.waitForLoadState('networkidle');
		expect(asked).toEqual([]);
	});

	test('advanced mode loads only the one it needs, and only once', async ({ page }) => {
		const asked = recordingsAskedFor(page);
		await open(page, 'step=token-request');
		await expect(page.getByTestId('payload')).toBeVisible();
		await page.getByTestId('next').click();
		await page.getByTestId('next').click();
		await page.waitForLoadState('networkidle');
		expect(asked).toHaveLength(1);
		expect(asked[0]).toContain('/oauth.json');
	});

	test('a state with no recording loads none', async ({ page }) => {
		const asked = recordingsAskedFor(page);
		await open(page, 'oidc=1&binding=dpop&step=token-request');
		await expect(page.getByTestId('no-recording')).toBeVisible();
		await page.waitForLoadState('networkidle');
		expect(asked).toEqual([]);
	});

	test('says so when a recording cannot be loaded', async ({ page }) => {
		await page.route('**/recordings/**', (route) => route.abort());
		await open(page, 'step=token-request');
		await expect(page.getByTestId('recording-failed')).toBeVisible();
		await expect(page.getByTestId('payload')).toHaveCount(0);
	});
});

test.describe('flipping a setting', () => {
	test.use({ contextOptions: { reducedMotion: 'no-preference' } });

	test('still animates, and the raw view follows', async ({ page }) => {
		const check = watchForErrors(page);
		await open(page, 'step=token-request');
		await expect.poll(() => shownLines(page)).toEqual(inFile(read('oauth'), 'token-request'));

		await page.locator('[data-setting="pkce"] input').check();
		await expect(page.getByTestId('diagram')).toHaveAttribute('data-animating', 'true');
		await expect.poll(() => shownLines(page)).toEqual(inFile(read('pkce'), 'token-request'));
		await expect(page.getByTestId('payload')).toContainText('code_verifier');
		await expect(page.getByTestId('diagram')).toHaveAttribute('data-animating', 'false');
		check();
	});

	test('to a state with no recording, drops the payload at once', async ({ page }) => {
		await open(page, 'pkce=1&step=token-request');
		await expect(page.getByTestId('payload')).toBeVisible();
		await page.locator('[data-setting="binding"] input[value="dpop"]').check();
		await expect(page.getByTestId('no-recording')).toBeVisible();
		await expect(page.getByTestId('payload')).toHaveCount(0);
	});
});

test.describe('the settings', () => {
	test('offers all of them in advanced mode', async ({ page }) => {
		await open(page, 'binding=dpop&broker=1');
		for (const id of ['oidc', 'clientType', 'pkce', 'binding', 'dpopNonce', 'broker']) {
			await expect(page.locator(`[data-setting="${id}"]`)).toBeVisible();
		}
		await expect(page.locator('[data-setting="upstreamTokens"]')).toBeVisible();
	});

	test('shows Keycloak feature flags, in what a real server said', async ({ page }) => {
		await open(page, 'broker=1');
		await expect(page.locator('[data-flag="dpop"]')).toContainText('supported, on by default');
		await expect(page.locator('[data-flag="identity-brokering-api:v2"]')).toContainText(
			'supported, off by default'
		);
		await expect(page.locator('[data-flag="identity-brokering-api:v1"]')).toContainText(
			'Deprecated in its docs'
		);
	});

	test('shows no flags in simple mode', async ({ page }) => {
		await open(page, 'mode=simple&broker=1&upstream=v2');
		await expect(page.locator('[data-flag]')).toHaveCount(0);
	});
});

test.describe('the parameters', () => {
	test('each say why they are there', async ({ page }) => {
		const { steps } = evaluate(base.diagrams.flow, defaultSettings);
		await open(page);
		for (const step of steps) {
			const reasons = page.locator('[data-field-why]');
			await expect(reasons).toHaveCount(step.fields.length);
			for (const text of await reasons.allTextContents()) expect(text.trim()).not.toBe('');
			if (step !== steps.at(-1)) await page.getByTestId('next').click();
		}
	});
});
