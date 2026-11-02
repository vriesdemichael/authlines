import { expect, test } from '@playwright/test';
import { FLOW_PATH, open } from './helpers.ts';

test.describe('an address that does not exist', () => {
	test('says so, with the way to the map', async ({ page }) => {
		await page.goto('no-such-flow/');
		const message = page.getByTestId('error-message');
		await expect(message).toContainText('There is no page here');
		await expect(message).not.toContainText('500');
		await expect(page).toHaveTitle('Page not found');
		await message.getByRole('link', { name: 'Go to the map' }).click();
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Authlines');
	});

	// Each of these is on every object, so a plain lookup finds it and carries on.
	for (const name of ['constructor', 'toString', 'hasOwnProperty', '__proto__']) {
		test(`says so for ${name}, as a flow and as a question`, async ({ page }) => {
			const errors: string[] = [];
			page.on('pageerror', (error) => errors.push(error.message));
			await page.goto(`${name}/`);
			await expect(page.getByTestId('error-message')).toContainText('There is no page here');
			await page.goto(`${FLOW_PATH}${name}/`);
			await expect(page.getByTestId('error-message')).toContainText('There is no page here');
			expect(errors).toEqual([]);
		});

		test(`opens nothing for an explanation of ${name}`, async ({ page }) => {
			await open(page, `explain=artifact.${name}`);
			await expect(page.getByTestId('explanation')).toHaveCount(0);
		});
	}
});

test.describe('an address that means another', () => {
	test('index.html goes to the page it is', async ({ page }) => {
		await page.goto(`${FLOW_PATH}index.html?mode=advanced`);
		await expect(page).toHaveURL(/authorization-code\/\?mode=advanced$/);
		await expect(page.getByTestId('diagram')).toBeVisible();
		await expect(page.getByTestId('error-message')).toHaveCount(0);
	});

	test('a doubled slash goes to the page it is, with its styles', async ({ page }) => {
		await page.goto(`${FLOW_PATH.replace(/\/$/, '')}//`);
		await expect(page).toHaveURL(/authlines\/authorization-code\/$/);
		const background = await page
			.locator('.workspace')
			.evaluate((element) => getComputedStyle(element).display);
		expect(background).toBe('grid');
	});
});

test.describe('something failing to load', () => {
	test('a part of a page says so, offers to try again, and that works', async ({ page }) => {
		await open(page, '');
		let blocked = true;
		await page.route('**/_app/immutable/nodes/**', (route) =>
			blocked ? route.abort() : route.continue()
		);
		await page.getByRole('link', { name: 'Authlines Map', exact: true }).click();
		const message = page.getByTestId('error-message');
		await expect(message).toContainText('That did not load');
		await expect(message).not.toContainText('There is no page here');
		await expect(page).toHaveTitle('That did not load');
		blocked = false;
		await page.getByTestId('try-again').click();
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Authlines');
	});

	test('the application itself says so, and a link with settings is not blank', async ({
		page
	}) => {
		await page.route('**/_app/immutable/entry/**', (route) => route.abort());
		await page.goto(`${FLOW_PATH}?mode=advanced&oidc=1`);
		await expect(page.getByTestId('not-started')).toContainText('did not load');
		await expect(page.getByTestId('diagram')).toBeVisible();
		await expect(page.getByTestId('not-started').getByRole('link')).toHaveText('Try again');
	});

	test('search says so when it cannot load, and offers to try again', async ({
		page,
		browserName
	}) => {
		await page.goto('./');
		await page.locator('main[data-ready="true"]').waitFor();
		// As for a tab left open across a deploy, which has removed what it would ask for.
		await page.route('**/_app/immutable/chunks/**', (route) =>
			route.fulfill({ status: 404, body: '' })
		);
		await page.getByTestId('open-search').click();
		await page.getByTestId('search-input').fill('refresh');
		const status = page.getByTestId('search-status');
		await expect(status).toContainText('did not load', { timeout: 5000 });
		await expect(status).not.toContainText('Getting ready');
		await expect(status).toContainText('a new tab');
		await page.unroute('**/_app/immutable/chunks/**');
		// WebKit holds on to a script that failed for as long as the tab is open, whatever the tab does
		// next, which is why it says so. After a deploy a reload asks for scripts with new names.
		if (browserName === 'webkit') {
			const other = await page.context().newPage();
			await other.goto('./');
			await other.locator('main[data-ready="true"]').waitFor();
			await other.getByTestId('open-search').click();
			await other.getByTestId('search-input').fill('refresh');
			await expect(other.getByTestId('search').locator('[data-result]').first()).toBeVisible();
			return;
		}
		// Or the old page is still there to say it is ready.
		await Promise.all([page.waitForEvent('load'), page.getByTestId('search-again').click()]);
		await page.locator('main[data-ready="true"]').waitFor();
		await page.getByTestId('open-search').click();
		await page.getByTestId('search-input').fill('refresh');
		await expect(page.getByTestId('search').locator('[data-result]').first()).toBeVisible();
	});

	test('search says so when loading does not end, and still works if it does', async ({ page }) => {
		await page.goto('./');
		await page.locator('main[data-ready="true"]').waitFor();
		let finish = () => {};
		const held = new Promise<void>((resolve) => (finish = resolve));
		await page.route('**/_app/immutable/chunks/**', async (route) => {
			await held;
			await route.continue();
		});
		await page.getByTestId('open-search').click();
		await page.getByTestId('search-input').fill('refresh');
		const status = page.getByTestId('search-status');
		await expect(status).toHaveText('Getting ready.');
		await expect(status).toContainText('did not load', { timeout: 8000 });
		finish();
		await expect(page.getByTestId('search').locator('[data-result]').first()).toBeVisible();
		await expect(status).not.toContainText('did not load');
	});

	test('nothing is said when it does start', async ({ page }) => {
		await open(page, 'oidc=1');
		await expect(page.getByTestId('diagram')).toBeVisible();
		await page.waitForFunction(() => document.documentElement.hasAttribute('data-started'));
		await expect(page.getByTestId('not-started')).toHaveCount(0);
	});
});

test.describe('with JavaScript off', () => {
	test.use({ javaScriptEnabled: false });

	test('an address that does not exist still says something, with a title', async ({ page }) => {
		await page.goto('no-such-flow/');
		await expect(page.getByTestId('no-javascript')).toBeVisible();
		await expect(page).toHaveTitle('Authlines');
		await page.getByTestId('no-javascript').getByRole('link', { name: 'map' }).click();
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Authlines');
	});

	test('a question shows its start and says what is missing', async ({ page }) => {
		await page.goto(`${FLOW_PATH}how-access-works/`);
		await expect(page.getByTestId('no-javascript')).toContainText('needs JavaScript');
		await expect(page.getByTestId('diagram')).toBeVisible();
		await expect(page).toHaveTitle('How does an app get access?');
	});
});

test.describe('when a link is shared', () => {
	test('setup names setup as its address', async ({ page }) => {
		await page.goto(`${FLOW_PATH}setup/`);
		await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
			'content',
			/authorization-code\/setup\/$/
		);
	});
});
