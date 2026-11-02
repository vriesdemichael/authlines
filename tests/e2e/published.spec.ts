import { expect, test } from '@playwright/test';
import { FLOW_PATH } from './helpers.ts';

test.describe('what gets published', () => {
	test('the site and the Storybook come from the same commit', async ({ request }) => {
		const site = await request.get('version.txt');
		const storybook = await request.get('storybook/version.txt');
		expect(site.status()).toBe(200);
		expect(storybook.status()).toBe(200);
		const commit = await site.text();
		expect(commit).toMatch(/^[0-9a-f]{40}\n$/);
		expect(await storybook.text()).toBe(commit);
	});

	// The application is rough and mostly unchecked, so nothing gets indexed yet (ADR-010).
	for (const path of ['./', FLOW_PATH, 'no-such-flow/', 'storybook/', 'storybook/iframe.html']) {
		test(`${path} asks not to be indexed`, async ({ page }) => {
			await page.goto(path);
			if (process.env.VITE_INDEXABLE !== 'true') {
				await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
			}
		});
	}
});

test.describe('the Storybook', () => {
	test('opens from inside the site', async ({ page }) => {
		await page.goto('storybook/');
		const story = page.frameLocator('#storybook-preview-iframe').locator('#storybook-root');
		await expect(story).not.toBeEmpty();
	});

	test('renders every story', async ({ page, request }) => {
		test.setTimeout(180_000);
		const index = await (await request.get('storybook/index.json')).json();
		const entries: { id: string; type: string }[] = Object.values(index.entries);
		const ids = entries.filter((entry) => entry.type === 'story').map((entry) => entry.id);
		expect(ids.length).toBeGreaterThan(0);

		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(String(error)));
		const broken: string[] = [];
		for (const id of ids) {
			errors.length = 0;
			await page.goto(`storybook/iframe.html?id=${id}&viewMode=story`);
			const settled = 'body.sb-show-main, body.sb-show-errordisplay, body.sb-show-nopreview';
			await page.locator(settled).waitFor({ state: 'attached' });
			const shown = await page.locator('body.sb-show-main').count();
			const root = page.locator('#storybook-root');
			// Storybook says it is showing a story a moment before there is anything in it.
			await root
				.locator('*')
				.first()
				.waitFor({ state: 'attached', timeout: 3000 })
				.catch(() => {});
			const hasContent = (await root.innerText()).trim() || (await root.locator('svg').count());
			if (!shown || !hasContent || errors.length) broken.push(`${id}: ${errors.join('; ')}`);
		}
		expect(broken).toEqual([]);
	});
});
