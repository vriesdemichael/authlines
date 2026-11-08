import { expect, test, type Page } from '@playwright/test';
import { open } from './helpers.ts';

const window = (page: Page) => page.getByTestId('page-window');
const address = (page: Page) => page.getByTestId('page-address');
const picture = (page: Page) => page.getByTestId('page-picture');
const outline = (page: Page) => page.getByTestId('page-outline');
const parameter = (page: Page, name: string) => page.locator(`[data-parameter="${name}"]`);

const loaded = (page: Page) =>
	picture(page).evaluate((image: HTMLImageElement) =>
		image.decode().then(() => image.naturalWidth)
	);

test.describe('what a person sees in their browser', () => {
	test('is the real page and the real address, with what matters marked', async ({ page }) => {
		await open(page, 'mode=simple&step=login-page');
		await expect(address(page)).toContainText('localhost:18080/realms/demo');
		await expect(parameter(page, 'redirect_uri')).toHaveClass(/marked/);
		expect(await loaded(page)).toBe(640);
		await expect(picture(page)).toHaveAttribute('alt', /username and a password/);
		await expect(window(page)).toContainText('Keycloak’s own page');
	});

	test('has the code sitting in the address', async ({ page }) => {
		await open(page, 'mode=simple&step=callback');
		await expect(address(page)).toContainText('localhost:9100/callback');
		await expect(parameter(page, 'code')).toHaveClass(/marked/);
		await expect(parameter(page, 'code')).toHaveAttribute('title', /.{20,}/);
		await expect(picture(page)).toHaveCount(0);
		await expect(outline(page)).toContainText('what came back is in it');
	});

	test('explains a part of the address when it is selected', async ({ page }) => {
		await open(page, 'mode=simple&step=callback');
		await parameter(page, 'code').getByRole('button').click();
		await expect(page.getByTestId('explanation').getByRole('heading')).toHaveText('Code');
		await expect(page).toHaveURL(/explain=term\.code/);
	});

	test('keeps only what matters for someone new, and all of it for someone who asked', async ({
		page
	}) => {
		await open(page, 'mode=simple&step=callback');
		await expect(parameter(page, 'iss')).toHaveCount(0);
		await open(page, 'mode=advanced&step=callback');
		await expect(parameter(page, 'iss')).toBeVisible();
		await expect(parameter(page, 'iss')).not.toHaveClass(/marked/);
		await expect(parameter(page, 'code')).toHaveClass(/marked/);
	});

	test('says it in the words chosen', async ({ page }) => {
		await open(page, 'mode=simple&say=specs&step=callback');
		// What it is for, not a sentence, so that rewording the outline does not break it.
		await expect(outline(page)).toContainText(/\bthe client\b/);
		await expect(outline(page)).not.toContainText(/\bthe app\b/i);
	});

	test('keeps the address and leaves out the server, with its notes off (ADR-015)', async ({
		page
	}) => {
		await open(page, 'mode=simple&step=login-page&keycloak=off');
		await expect(address(page)).toContainText('/protocol/openid-connect/auth');
		await expect(picture(page)).toHaveCount(0);
		await expect(outline(page)).toContainText('username and a password');
		await expect(window(page)).not.toContainText('Keycloak');
	});

	test('is not there on a step nobody sees', async ({ page }) => {
		await open(page, 'mode=simple&step=token-request');
		await expect(window(page)).toHaveCount(0);
	});

	test('is only there as the browser, because it is what the browser showed', async ({ page }) => {
		await open(page, 'mode=simple&step=login-page&eyes=browser');
		await expect(window(page)).toBeVisible();
		await open(page, 'mode=simple&step=login-page&eyes=idp');
		await expect(window(page)).toHaveCount(0);
	});

	test('says so where the address was not recorded, and makes none up', async ({ page }) => {
		await open(page, 'mode=simple&oidc=1&binding=dpop&step=login-page');
		await expect(page.getByTestId('page-no-address')).toHaveText(
			'Recorded with other settings, not these, so the address is not shown.'
		);
		await expect(picture(page)).toBeVisible();
		await expect(page.getByTestId('page-caption')).toContainText('from a run with other settings');
	});

	// The maintainer, 2026-11-08: it said there was no recording while the recording was loading.
	test('does not say there is no recording while it loads', async ({ page }) => {
		await page.route('**/recordings/authorization-code/*.json', async (route) => {
			await new Promise((resolve) => setTimeout(resolve, 1500));
			await route.continue();
		});
		await open(page, 'mode=advanced&address=other&step=address-refused');
		await expect(page.getByTestId('page-no-address')).toHaveText('Loading what was recorded.');
		await expect(page.getByTestId('page-address')).toContainText('redirect_uri');
		await expect(page.getByTestId('page-caption')).not.toContainText('other settings');
	});

	test('loads a picture only for the step on screen', async ({ page }) => {
		const pictures: string[] = [];
		page.on('request', (request) => {
			if (request.url().endsWith('.jpg')) pictures.push(request.url());
		});
		await open(page, 'mode=simple&step=open-app');
		await expect(page.getByTestId('position')).toContainText('Step 1');
		expect(pictures).toEqual([]);
		await page.getByTestId('next').click();
		await page.getByTestId('next').click();
		await page.getByTestId('next').click();
		await expect(picture(page)).toBeVisible();
		expect(pictures).toHaveLength(1);
		expect(pictures[0]).toContain('/pages/login.jpg');
	});

	test('fetches no recording in simple mode until a page needs its address', async ({ page }) => {
		const fetched: string[] = [];
		page.on('request', (request) => {
			if (/\/recordings\/.*\.json$/.test(request.url())) fetched.push(request.url());
		});
		await open(page, 'mode=simple&step=token-request');
		await expect(page.getByTestId('position')).toBeVisible();
		expect(fetched).toEqual([]);
	});

	test('shows what someone gets when an address does not match', async ({ page }) => {
		await open(page, 'mode=simple&step=authorize');
		const pitfall = page.getByTestId('step-pitfall');
		await pitfall.locator('summary').click();
		const shot = pitfall.locator('img');
		await expect(shot).toBeVisible();
		await expect(shot).toHaveAttribute('src', /wrong-redirect\.jpg/);
		await expect(shot).toHaveAttribute('alt', /error page/);
		const inside = await shot.evaluate((image) => {
			const box = image.getBoundingClientRect();
			const around = image.closest('details')!.getBoundingClientRect();
			return box.left >= around.left && box.right <= around.right;
		});
		expect(inside).toBe(true);
	});

	test('leaves that out too, with the notes off', async ({ page }) => {
		await open(page, 'mode=simple&step=authorize&keycloak=off');
		const pitfall = page.getByTestId('step-pitfall');
		await pitfall.locator('summary').click();
		await expect(pitfall.locator('img')).toHaveCount(0);
	});
});
