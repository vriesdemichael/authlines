import { expect, test, type Page } from '@playwright/test';
import { FLOW_PATH } from './helpers.ts';

const SIZES = [
	[768, 900],
	[853, 480], // A laptop of 1280x720 at 150% zoom.
	[960, 540],
	[1024, 768],
	[1180, 820],
	[1240, 800],
	[1280, 720],
	[1366, 650],
	[1440, 900],
	[1536, 730],
	[1920, 1080],
	[2560, 1440]
] as const;

/** The size text is drawn at on screen, whatever the drawing's own units are. */
const labelPixels = (page: Page) =>
	page.locator('.body').evaluate((svg: SVGSVGElement) => {
		const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
		const label = svg.querySelector('.row.past .label') ?? svg.querySelector('.label');
		return Number.parseFloat(getComputedStyle(label!).fontSize) * scale;
	});

const rowsInView = async (page: Page) =>
	page.locator('.scroller').evaluate((scroller) => {
		const view = scroller.getBoundingClientRect();
		return [...scroller.querySelectorAll('[data-step] .hit')].filter((hit) => {
			const box = hit.getBoundingClientRect();
			return box.top >= view.top - 1 && box.bottom <= view.bottom + 1;
		}).length;
	});

const openAt = async (page: Page, width: number, height: number, search: string) => {
	await page.setViewportSize({ width, height });
	await page.goto(`${FLOW_PATH}?${search}`);
	await page.locator('.workspace[data-ready="true"]').waitFor();
};

for (const [width, height] of SIZES) {
	test.describe(`at ${width}x${height}`, () => {
		for (const [name, search] of [
			['the plain flow', 'mode=simple&step=token-response'],
			['the busiest flow', 'mode=advanced&oidc=1&binding=dpop&broker=1&step=token-response'],
			['setup', 'mode=simple&step=discover']
		]) {
			test(`${name} has readable text`, async ({ page }) => {
				await openAt(page, width, height, search);
				const pixels = await labelPixels(page);
				expect(pixels).toBeGreaterThanOrEqual(11.9);
				expect(pixels).toBeLessThanOrEqual(16);
			});
		}

		test('nothing runs off the side', async ({ page }) => {
			await openAt(page, width, height, 'mode=advanced&oidc=1&binding=dpop&broker=1');
			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth
			);
			expect(overflow).toBeLessThanOrEqual(0);
		});

		test('every control can be pressed', async ({ page }) => {
			await openAt(page, width, height, 'mode=advanced&step=token-request');
			for (const id of ['settings-toggle', 'next', 'back', 'server-notes-quick']) {
				await page.getByTestId(id).click({ trial: true, timeout: 3000 });
			}
		});

		test('the current step stays in view', async ({ page }) => {
			await openAt(page, width, height, 'mode=advanced&oidc=1&binding=dpop&broker=1');
			await page.keyboard.press('End');
			await expect(page.locator('[data-state="current"] .hit')).toBeInViewport();
		});

		test('the settings can be reached and put away', async ({ page }) => {
			await openAt(page, width, height, 'mode=advanced');
			const toggle = page.getByTestId('settings-toggle');
			const settings = page.getByRole('complementary', { name: 'Settings' });
			if (await settings.isVisible()) await toggle.click();
			await expect(settings).toBeHidden();
			await expect(toggle).toHaveText('Show settings');
			await toggle.click();
			await expect(settings).toBeVisible();
			await expect(toggle).toHaveText('Hide settings');
			await toggle.click({ trial: true });
			await toggle.click();
			await expect(settings).toBeHidden();
		});
	});
}

test.describe('the current step', () => {
	test('has its band reach both sides of a big window, and its row can be pressed', async ({
		page
	}) => {
		await openAt(page, 2560, 1440, 'mode=simple&step=authorize');
		const band = await page
			.locator('[data-state="current"] .hit')
			.evaluate((hit) => hit.getBoundingClientRect().width);
		const area = await page.locator('.scroller').evaluate((scroller) => scroller.clientWidth);
		expect(band).toBeGreaterThanOrEqual(area - 1);
		await page.locator('[data-step="token-request"]').click();
		await expect(page.getByTestId('position')).toContainText('Step 8');
	});
});

test.describe('showing what a setting added', () => {
	test('brings it into view, in every browser', async ({ page }) => {
		await openAt(page, 1280, 620, 'mode=advanced&step=api-response');
		await page.getByRole('checkbox', { name: /PKCE/ }).click();
		await page.getByTestId('change-show').click();
		await expect(page.locator('[data-step="make-verifier"] .hit')).toBeInViewport();
	});
});

test.describe('a bigger window', () => {
	for (const [width, height] of [
		[1440, 900],
		[1920, 1080],
		[2560, 1440]
	] as const) {
		test(`shows all of the plain flow at ${width}x${height}`, async ({ page }) => {
			await openAt(page, width, height, 'mode=simple&step=token-response');
			const all = await page.locator('[data-step]').count();
			expect(await rowsInView(page)).toBe(all);
		});
	}

	test('shows more of a long flow than a smaller one', async ({ page }) => {
		const search = 'mode=advanced&oidc=1&binding=dpop&broker=1&step=open-app';
		await openAt(page, 1280, 720, search);
		const small = await rowsInView(page);
		await openAt(page, 1920, 1080, search);
		expect(await rowsInView(page)).toBeGreaterThan(small);
	});
});

test.describe('resizing', () => {
	test.use({ contextOptions: { reducedMotion: 'no-preference' } });

	test('does not play the transition', async ({ page }) => {
		await openAt(page, 1440, 900, 'mode=simple');
		await page.setViewportSize({ width: 1300, height: 700 });
		await page.waitForTimeout(100);
		await expect(page.getByTestId('diagram')).toHaveAttribute('data-animating', 'false');
	});

	test('during a transition does not break it', async ({ page }) => {
		await openAt(page, 1440, 900, 'mode=simple');
		await page.getByRole('checkbox', { name: /Know who logged in/ }).click();
		await page.setViewportSize({ width: 1300, height: 700 });
		await expect(page.getByTestId('diagram')).toHaveAttribute('data-animating', 'false');
		await expect(page.locator('[data-step="validate-id-token"]')).toBeAttached();
		await expect(page.locator('.row:not([data-step])')).toHaveCount(0);
	});
});

test.describe('someone presenting', () => {
	test('gets the room back by hiding the settings', async ({ page }) => {
		await openAt(page, 1440, 900, 'mode=advanced');
		const width = () => page.locator('.body').evaluate((svg) => svg.getBoundingClientRect().width);
		const before = await width();
		await page.getByTestId('settings-toggle').click();
		await expect.poll(width).toBeGreaterThan(before);
	});
});

test.describe('text that does not fit', () => {
	test('can be read in full', async ({ page }) => {
		await page.setViewportSize({ width: 900, height: 700 });
		await page.goto(`${FLOW_PATH}how-access-works/?mode=advanced`);
		await expect(page.getByTestId('title')).toHaveAttribute('title', 'How does an app get access?');
		await expect(page.locator('.what')).toHaveAttribute('title', /Recorded from/);
	});
});
