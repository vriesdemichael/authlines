import { expect, test, type Page } from '@playwright/test';
import { onTheMap } from './helpers.ts';

const PATH = 'device/';

const openIt = async (page: Page, search = '', path = PATH) => {
	await page.goto(`${path}${search ? `?${search}` : ''}`);
	await page.locator('.workspace[data-ready="true"]').waitFor();
};
const heads = (page: Page) =>
	page
		.locator('[data-lifeline]')
		.evaluateAll((all) => all.map((one) => one.getAttribute('data-lifeline')));
const position = (page: Page) => page.getByTestId('position');
const detail = (page: Page) => page.getByTestId('step-detail');

test.describe('a flow on two devices', () => {
	test('can be walked from the first message to the last', async ({ page }) => {
		await openIt(page);
		expect(await heads(page)).toEqual(['browser', 'app', 'idp', 'api']);
		await expect(page.getByTestId('title')).toHaveText('Device flow');
		await expect(position(page)).toHaveText('Step 1 of 18');
		for (let i = 0; i < 17; i++) await page.getByTestId('next').click();
		await expect(position(page)).toHaveText('Step 18 of 18');
		await expect(page.getByTestId('next')).toBeDisabled();
	});

	test('draws the code going from one device to the other as a person, and sends nothing', async ({
		page
	}) => {
		await openIt(page, 'mode=advanced&step=device-show-code');
		await expect(detail(page)).toContainText('People, not HTTP');
		await expect(detail(page)).toContainText('No HTTP message here');
		await expect(page.getByTestId('payload')).toHaveCount(0);
	});

	test('has real traffic, with the answer that says not yet', async ({ page }) => {
		await openIt(page, 'mode=advanced&step=device-pending');
		await expect(page.getByTestId('payload')).toContainText('authorization_pending');
		await expect(page.getByTestId('payload')).toContainText('400');
	});

	test('runs a step, and lands on what the real server answered', async ({ page }) => {
		await openIt(page, 'mode=advanced&step=device-poll');
		await page.getByTestId('execute').click();
		await expect(page).toHaveURL(/step=device-pending/);
		await openIt(page, 'mode=advanced&step=device-poll-again');
		await page.getByTestId('execute').click();
		await expect(page).toHaveURL(/step=device-token-response/);
		await expect(page.getByTestId('payload')).toContainText('access_token');
	});

	test('shows the page a person gets, with its real address and a picture', async ({ page }) => {
		await openIt(page, 'step=device-code-page');
		const shown = page.getByTestId('page-window');
		await expect(shown).toContainText('/realms/demo/device');
		await expect(page.getByTestId('page-picture')).toBeVisible();
		await openIt(page, 'step=device-done-page');
		await expect(shown).toContainText('/device/status');
	});

	test('warns about a code someone sent, where it can still be stopped', async ({ page }) => {
		await openIt(page, 'step=device-consent-page');
		await detail(page).getByText('What if someone sent them that code?').click();
		await expect(detail(page)).toContainText('the tokens go to whoever started it');
		await openIt(page, 'mode=advanced&step=device-consent-page');
		await expect(detail(page)).toContainText('RFC 8628');
	});

	test('adds what OpenID Connect adds, on the same diagram', async ({ page }) => {
		await openIt(page, 'step=device-token-response');
		await expect(position(page)).toHaveText('Step 15 of 18');
		await page.locator('[data-setting="oidc"] input').check();
		await expect(position(page)).toHaveText('Step 15 of 19');
		await expect(page).toHaveURL(/oidc=1/);
		await expect(detail(page)).toContainText('ID token');
	});

	test('has a setup of its own, with no address and no secret', async ({ page }) => {
		await openIt(page, '', `${PATH}setup/`);
		await expect(page.locator('.workspace')).toHaveAttribute('data-diagram', 'setup');
		await expect(detail(page)).toContainText('no address to list');
		await expect(detail(page)).toContainText('no secret');
		expect(await heads(page)).not.toContain('browser');
	});

	test('says why the rest is not here', async ({ page }) => {
		await openIt(page, 'mode=advanced');
		const list = page.getByTestId('not-here');
		await expect(list.locator('[data-not-here="consent"]')).toContainText('asks here anyway');
		await expect(list.locator('[data-not-here="attacker"]')).toContainText('not drawn');
		await expect(list.locator('[data-not-here="clientType"]')).toContainText('no secret');
	});

	test('has a note on what a real server does about it, which goes with the rest', async ({
		page
	}) => {
		await openIt(page, 'mode=advanced&step=device-request');
		await expect(detail(page)).toContainText('OAuth 2.0 Device Authorization Grant');
		await openIt(page, 'mode=advanced&step=device-request&keycloak=off');
		await expect(detail(page)).not.toContainText('OAuth 2.0 Device Authorization Grant');
	});

	for (const [width, height] of [
		[1920, 1080],
		[1280, 720],
		[1024, 768]
	]) {
		for (const wording of ['plain', 'specs', 'keycloak']) {
			test(`every name fits its head at ${width}x${height}, ${wording}`, async ({ page }) => {
				await page.setViewportSize({ width, height });
				await openIt(page, `mode=simple&say=${wording}&oidc=1`);
				const over = await page.locator('.lane-head').evaluateAll((all) =>
					all.flatMap((head) => {
						const box = head.querySelector('rect')!.getBBox();
						return [...head.querySelectorAll(':scope > g > text')].flatMap((text) => {
							const line = (text as SVGTextElement).getBBox();
							return line.x >= box.x && line.x + line.width <= box.x + box.width
								? []
								: [text.textContent];
						});
					})
				);
				expect(over).toEqual([]);
			});
		}
	}
});

test.describe('from the map', () => {
	test('a question opens it where the answer can be seen', async ({ page }) => {
		await page.goto('./');
		await page.locator('main[data-ready="true"]').waitFor();
		await (await onTheMap(page, 'device-flow')).click();
		await expect(page).toHaveURL(/device\/device-flow/);
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect(page.getByTestId('answer')).toContainText('short code');
		await expect(detail(page)).toContainText('The app shows an address and a code');
	});

	test('search finds it, and does not say it is not here', async ({ page }) => {
		await page.goto('./');
		await page.locator('main[data-ready="true"]').waitFor();
		await page.getByTestId('open-search').click();
		await page.getByTestId('search-input').fill('device flow');
		await expect(page.getByTestId('search').locator('[data-result]').first()).toBeVisible();
		await expect(page.getByTestId('search')).not.toContainText('does not cover');
	});

	test('a word followed by a period keeps it on its line', async ({ page }) => {
		await page.goto('device/device-phishing/');
		await page.locator('.workspace[data-ready="true"]').waitFor();
		const answer = page.getByTestId('answer');
		await expect(answer.locator('.together').filter({ hasText: /\.$/ }).first()).toBeVisible();
		expect(await answer.locator('p').innerText()).not.toMatch(/\s[.,;:]/);
	});

	test('what the term means on this flow is this flow’s', async ({ page }) => {
		await page.goto('device/device-phishing/');
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await page.getByTestId('answer').locator('[data-term="user-code"]').click();
		await expect(page.getByTestId('explanation')).toContainText('short code for a person');
		await expect(page.getByTestId('explanation')).not.toContainText('one-time ticket');
	});

	test('pasting the error goes to where a real server said it', async ({ page }) => {
		await page.goto('./');
		await page.locator('main[data-ready="true"]').waitFor();
		await page.getByTestId('open-search').click();
		await page.getByTestId('search-input').fill('authorization_pending');
		await page.getByTestId('search').locator('[data-result]').first().click();
		await expect(page).toHaveURL(/device\//);
		await expect(page).toHaveURL(/device-pending/);
	});
});
