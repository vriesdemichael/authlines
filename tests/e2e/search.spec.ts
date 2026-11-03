import { expect, test, type Page } from '@playwright/test';
import { FLOW_PATH, open } from './helpers.ts';

const input = (page: Page) => page.getByTestId('search-input');
const status = (page: Page) => page.getByTestId('search-status');
const results = (page: Page) => page.getByTestId('search').locator('[data-result]');

const start = async (page: Page) => {
	await page.goto('./');
	await page.locator('main[data-ready="true"]').waitFor();
	await page.getByTestId('open-search').click();
	await expect(input(page)).toBeFocused();
};

test.describe('the keys for it', () => {
	test("Ctrl+F opens it, and pressed again it is the browser's own", async ({ page }) => {
		await page.goto('./');
		await page.locator('main[data-ready="true"]').waitFor();
		await page.evaluate(() => {
			const seen: boolean[] = [];
			(window as unknown as { taken: boolean[] }).taken = seen;
			addEventListener('keydown', (event) => {
				if (event.key === 'f') seen.push(event.defaultPrevented);
			});
		});
		const taken = () => page.evaluate(() => (window as unknown as { taken: boolean[] }).taken);
		await page.keyboard.press('ControlOrMeta+f');
		await expect(input(page)).toBeFocused();
		await expect(status(page)).toContainText("the browser's own find");
		expect(await taken()).toEqual([true]);

		await page.keyboard.press('ControlOrMeta+f');
		await expect.poll(taken).toEqual([true, false]);
		await expect(input(page)).toBeHidden();
	});

	test('Ctrl+F is left to the browser over an open RFC, which has its own text', async ({
		page
	}) => {
		await open(page, 'source=rfc6749&for=client&section=2.1');
		await expect(page.getByTestId('source-text')).toBeVisible();
		await page.keyboard.press('ControlOrMeta+f');
		await expect(input(page)).toBeHidden();
	});
});

test.describe('what a result does', () => {
	test('a word opens where someone is, and leaves the flow as it was', async ({ page }) => {
		await open(page, 'mode=simple&oidc=1&step=callback');
		await page.keyboard.press('/');
		await input(page).fill('session');
		await results(page).filter({ hasText: 'Word' }).first().click();
		await expect(page).toHaveURL(/explain=term\.session/);
		await expect(page).toHaveURL(/oidc=1/);
		await expect(page).toHaveURL(/step=callback/);
		await expect(page.getByTestId('explanation')).toContainText('Session');
		await expect(page.getByTestId('position')).toContainText('of 15');
	});

	test('escape closes it at once, with words in it', async ({ page }) => {
		await open(page, 'mode=simple');
		await page.keyboard.press('/');
		await input(page).fill('session');
		await input(page).press('Escape');
		await expect(page.getByTestId('search')).toBeHidden();
	});

	test('a pasted error opens on the question about it', async ({ page }) => {
		await open(page, 'mode=simple');
		await page.keyboard.press('/');
		await input(page).fill('Invalid parameter: redirect_uri');
		await results(page).first().click();
		await expect(page).toHaveURL(/redirect-uri-error/);
		await expect(page.getByTestId('answer')).toBeVisible();
	});
});

test.describe('searching', () => {
	test('is on the map, and finds a word people arrive with', async ({ page }) => {
		await start(page);
		await input(page).fill('SSO');
		await expect(results(page).first()).toContainText('Single sign-on');
		await results(page).first().click();
		await expect(page.getByTestId('explanation')).toContainText('Logging in once');
		await expect(page.getByTestId('search')).not.toHaveAttribute('open');
	});

	test('takes a pasted error, and goes to where a real server said it', async ({ page }) => {
		await start(page);
		await input(page).fill(
			'2026-11-01 14:03:22 WARN id=8f3a error="invalid_grant" description="Code not valid"'
		);
		await expect(results(page).first()).toHaveAttribute('data-kind', 'error');
		await page.keyboard.press('Enter');
		await expect(page.locator('[data-state="current"]')).toHaveAttribute(
			'data-step',
			'real-app-refused'
		);
		await expect(page.getByTestId('payload')).toContainText('Code not valid');
	});

	test('opens a question at its own address', async ({ page }) => {
		await start(page);
		await input(page).fill('steal the code');
		await page.getByTestId('search').locator('[data-kind="question"]').first().click();
		await expect(page).toHaveURL(/stolen-code\/$/);
		await expect(page.getByTestId('answer')).toBeVisible();
	});

	for (const error of [
		'unauthorized_client',
		'invalid_grant',
		'access_denied',
		'{"error":"unauthorized_client","error_description":"Invalid client or Invalid client credentials"}'
	]) {
		test(`lists what it found for ${error.slice(0, 32)}, which more than one flow has`, async ({
			page
		}) => {
			await start(page);
			await input(page).fill(error);
			await expect(results(page).first()).toBeVisible();
			await expect(status(page)).toContainText(`${await results(page).count()} result`);
		});
	}

	test('says when it only has the closest thing to what was typed', async ({ page }) => {
		await start(page);
		await input(page).fill('Invalid audience');
		await expect(status(page)).toContainText('The closest');
		await expect(results(page).first()).toBeVisible();
	});

	test('says so when something is not here yet', async ({ page }) => {
		await start(page);
		await input(page).fill('token exchange');
		await expect(status(page)).toContainText('does not cover token exchange yet');
		await expect(results(page)).toHaveCount(0);
		await expect(
			page.getByTestId('search-nothing').getByRole('link', { name: 'map' })
		).toBeVisible();
	});

	test('says so when it finds nothing', async ({ page }) => {
		await start(page);
		await input(page).fill('xyzzy plugh');
		await expect(status(page)).toContainText('Nothing here about that yet');
		// A short form, and without what was typed, because search sends nothing anywhere.
		await expect(page.getByRole('link', { name: 'you can suggest this one' })).toHaveAttribute(
			'href',
			'https://github.com/vriesdemichael/authlines/issues/new?template=suggest-a-question.yml'
		);
	});
});

test.describe('by keyboard', () => {
	test('opens with / and Ctrl+K anywhere, and Escape closes it', async ({ page }) => {
		await open(page, 'mode=simple');
		await page.keyboard.press('/');
		await expect(input(page)).toBeFocused();
		await page.keyboard.press('Escape');
		await expect(page.getByTestId('search')).not.toHaveAttribute('open');
		await page.keyboard.press('Control+k');
		await expect(input(page)).toBeFocused();
	});

	test('opens again straight after Escape', async ({ page }) => {
		await open(page, 'mode=simple');
		await page.keyboard.press('/');
		await expect(input(page)).toBeFocused();
		// From inside the page, so nothing can get between the two.
		await page.evaluate(() => {
			const dialog = document.querySelector('dialog[data-testid="search"]') as HTMLDialogElement;
			dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
			dialog.close();
			document.body.dispatchEvent(
				new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })
			);
		});
		await expect(page.getByTestId('search')).toHaveAttribute('open');
		await expect(input(page)).toBeFocused();
	});

	test('arrows choose a result, and Enter opens it', async ({ page }) => {
		await start(page);
		await input(page).fill('token');
		await expect(results(page).nth(1)).toBeVisible();
		await page.keyboard.press('ArrowDown');
		await expect(results(page).nth(1)).toHaveClass(/active/);
		const href = await results(page).nth(1).getAttribute('href');
		await page.keyboard.press('Enter');
		await expect(page.getByTestId('search')).not.toHaveAttribute('open');
		const query = new URL(href!, page.url()).search;
		await expect.poll(() => new URL(page.url()).search).toBe(query);
	});

	test('tells a screen reader what it found', async ({ page }) => {
		await start(page);
		await expect(status(page)).toHaveAttribute('role', 'status');
		await input(page).fill('PKCE');
		await expect(status(page)).toContainText('result');
	});

	test('does not take the arrow keys from the steps while closed', async ({ page }) => {
		await open(page, 'mode=simple&step=authorize');
		await page.keyboard.press('ArrowRight');
		await expect(page.getByTestId('position')).toContainText('Step 4');
	});
});

test.describe('what it costs', () => {
	const searchChunk = (url: string) => /search/i.test(url);

	test('adds nothing to loading a page, and sends nothing anywhere', async ({ page, baseURL }) => {
		const requested: string[] = [];
		page.on('request', (request) => requested.push(request.url()));
		await page.goto('./');
		await page.waitForLoadState('networkidle');
		const before = requested.length;
		expect(requested.filter(searchChunk)).toEqual([]);

		await page.getByTestId('open-search').click();
		await input(page).fill('a private thing someone pasted');
		await expect(status(page)).not.toContainText('Getting ready');
		await page.waitForLoadState('networkidle');

		const origin = new URL(baseURL!).origin;
		const after = requested.slice(before);
		expect(after.every((url) => url.startsWith(origin))).toBe(true);
		expect(after.filter((url) => url.includes('private'))).toEqual([]);
	});
});

test.describe('on the application screen', () => {
	test('is one press away', async ({ page }) => {
		await page.goto(FLOW_PATH);
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await page.getByTestId('open-search').click();
		await expect(input(page)).toBeFocused();
	});
});
