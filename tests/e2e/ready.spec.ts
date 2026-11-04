import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { authorizationCodeBase as base } from '../../src/lib/flow/index.ts';
import { evaluate } from '../../src/lib/flow/model.ts';
import { defaultSettings } from '../../src/lib/flow/settings.ts';
import { mapNodes } from '../../src/lib/map/nodes.ts';
import { FLOW_PATH, open } from './helpers.ts';

const ready = (page: Page) => page.locator('.workspace[data-ready="true"]').waitFor();
const current = (page: Page) => page.locator('[data-step][data-state="current"]');

test.describe('every named state, checked by an automated tool', () => {
	test.skip(({ browserName }) => browserName !== 'chromium', 'The same rules in every browser');

	for (const node of mapNodes) {
		test(node.id, async ({ page }) => {
			await page.goto(`${node.flow}/${node.id}/`);
			await page.waitForLoadState('networkidle');
			const { violations } = await new AxeBuilder({ page }).analyze();
			expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual(
				[]
			);
		});
	}
});

test.describe('by keyboard alone', () => {
	test('the whole flow can be walked, from the map to the last step', async ({ page }) => {
		// The first question on the map is the old way.
		const { steps } = evaluate(base.diagrams.flow, { ...defaultSettings, oldWay: true });
		await page.goto('./');
		// Past the name, search and the heading of the part that is open, to the first question.
		for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
		await page.keyboard.press('Enter');
		await ready(page);

		// Next is the obvious thing to reach, and the arrow keys do the same once it has been pressed.
		await page.getByTestId('next').focus();
		for (const step of steps.slice(1)) {
			await page.keyboard.press('Enter');
			await expect(current(page)).toHaveAttribute('data-step', step.id);
		}
		await expect(page.getByTestId('next-question')).toBeVisible();
	});

	test('a setting can be flipped, and a message reached', async ({ page }) => {
		await open(page);
		await page.locator('[data-setting="oidc"] input').focus();
		await page.keyboard.press('Space');
		await expect(page.locator('[data-step="userinfo-request"]')).toBeVisible();

		await page.locator('[data-step="authorize"]').focus();
		await page.keyboard.press('Enter');
		await expect(current(page)).toHaveAttribute('data-step', 'authorize');
	});

	test('Execute can be pressed', async ({ page }) => {
		await open(page, 'step=token-request');
		await page.getByTestId('execute').focus();
		await page.keyboard.press('Enter');
		await expect(current(page)).toHaveAttribute('data-step', 'token-response');
		await expect(page.getByTestId('payload')).toBeFocused();
	});
});

test.describe('for a screen reader', () => {
	test('the step text is in the page and not only in the diagram', async ({ page }) => {
		await open(page, 'mode=simple&step=token-request');
		await expect(page.getByTestId('step-detail')).toContainText(
			'The app trades the code for tokens'
		);
	});

	test('what a setting just changed is announced', async ({ page }) => {
		await open(page);
		const status = page.getByTestId('change-status');
		await expect(status).toHaveAttribute('role', 'status');
		await expect(status).toBeEmpty();
		await page.locator('[data-setting="oidc"] input').check();
		await expect(status).toContainText('What changed');
		await expect(status).toContainText('3 steps added');
	});

	test('moving to another step is announced', async ({ page }) => {
		await open(page);
		await expect(page.locator('[aria-live="polite"]').first()).toContainText('Open the app');
		await page.getByTestId('next').click();
		await expect(page.locator('[aria-live="polite"]').first()).toContainText('302');
	});

	test('the raw traffic is not read out on every step', async ({ page }) => {
		await open(page, 'step=token-request');
		await expect(page.getByTestId('payload')).toBeVisible();
		const live = page.locator('[aria-live="polite"]').first();
		await expect(live.getByTestId('payload')).toHaveCount(0);
	});
});

test.describe('in print', () => {
	test.beforeEach(async ({ page }) => {
		await page.emulateMedia({ media: 'print' });
	});

	test('shows the whole diagram with every message spelled out', async ({ page }) => {
		await page.goto(`${FLOW_PATH}?oidc=1`);
		await ready(page);
		await expect(page.locator('[data-step="token-request"] .label')).toHaveCSS('opacity', '1');
		await expect(page.locator('[data-step="token-request"] line').first()).toHaveCSS(
			'opacity',
			'1'
		);
		const scroller = page.locator('.scroller');
		await expect(scroller).toHaveCSS('overflow-y', 'visible');
		const fits = await scroller.evaluate((node) => node.scrollHeight <= node.clientHeight + 1);
		expect(fits).toBe(true);
	});

	test('leaves out the controls, and keeps the words', async ({ page }) => {
		await page.goto(`${FLOW_PATH}?step=token-request`);
		await ready(page);
		await expect(page.getByTestId('next')).toBeHidden();
		await expect(page.locator('aside.settings')).toBeHidden();
		await expect(page.getByTestId('step-detail')).toBeVisible();
	});

	test('lets the page grow, instead of cutting it off', async ({ page }) => {
		await page.goto(FLOW_PATH);
		await ready(page);
		await expect(page.locator('.workspace')).toHaveCSS('display', 'block');
	});
});

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('a named state still shows its diagram and its words', async ({ page }) => {
		await page.goto('authorization-code/pkce/');
		await expect(page.locator('[data-step="make-verifier"]')).toBeAttached();
		await expect(page.getByTestId('step-detail')).toContainText('one-time value');
	});
});

test.describe('when a link is shared', () => {
	test.use({ javaScriptEnabled: false });

	const content = (page: Page, property: string) =>
		page.locator(`meta[property="${property}"]`).getAttribute('content');

	test('the map says what this is', async ({ page }) => {
		await page.goto('./');
		expect(await content(page, 'og:title')).toBe(
			'Authlines: OAuth and OpenID Connect on one living diagram'
		);
		expect(await content(page, 'og:site_name')).toBe('Authlines');
		expect(await content(page, 'og:image')).toMatch(/\/social\/home\.png$/);
	});

	test('the tab has the mark', async ({ page, request }) => {
		await page.goto('./');
		const icon = (await page.locator('link[rel="icon"]').getAttribute('href')) ?? '';
		const response = await request.get(new URL(icon, page.url()).href);
		expect(response.ok()).toBe(true);
		expect(await response.text()).toContain('<svg');
	});

	for (const node of mapNodes) {
		test(`${node.id} has its own title and image`, async ({ page, request }) => {
			await page.goto(`${node.flow}/${node.id}/`);
			expect(await content(page, 'og:title')).toBe(node.title);
			expect(await content(page, 'og:description')).toBe(node.answer);
			expect(await content(page, 'og:image')).toMatch(new RegExp(`/social/${node.id}\\.png$`));
			expect(await content(page, 'og:url')).toMatch(new RegExp(`/${node.id}/$`));
			const image = await request.get(`social/${node.id}.png`);
			expect(image.ok()).toBe(true);
			expect(image.headers()['content-type']).toContain('image/png');
		});
	}
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 375, height: 812 } });

	const noSidewaysScroll = (page: Page) =>
		page.evaluate(
			() => document.documentElement.scrollWidth <= document.documentElement.clientWidth
		);

	// The picture is what explains it, so a phone keeps it, as a strip with the words beside it (#15).
	test('draws the diagram as a strip, with the words beside it', async ({ page }) => {
		await page.goto('authorization-code/stolen-code/');
		await ready(page);
		const diagram = page.getByTestId('diagram');
		await expect(diagram).toBeVisible();
		await expect(diagram).toHaveClass(/strip/);
		await expect(page.locator('[data-lifeline="attacker"]')).toBeInViewport();
		// The row and not its words, which WebKit cannot tell are on screen when they are SVG text.
		await expect(page.locator('[data-state="current"]')).toBeInViewport();
		await expect(page.getByTestId('step-detail')).toBeVisible();
		expect(await noSidewaysScroll(page)).toBe(true);
	});

	test('can show it full size, moved sideways to the current message', async ({ page }) => {
		await page.goto(`${FLOW_PATH}?step=token-request`);
		await ready(page);
		await page.getByTestId('full-size').click();
		const diagram = page.getByTestId('diagram');
		await expect(diagram).not.toHaveClass(/strip/);
		await expect(diagram).toHaveClass(/full-size/);
		await expect.poll(() => diagram.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
		await expect(page.locator('[data-lifeline="idp"]')).toBeInViewport();
		expect(await noSidewaysScroll(page)).toBe(true);
		await page.getByTestId('full-size').click();
		await expect(diagram).toHaveClass(/strip/);
	});

	test('can be stepped through', async ({ page }) => {
		await page.goto(FLOW_PATH);
		await ready(page);
		await expect(page.getByTestId('step-detail')).toContainText('The user opens the app');
		await page.getByTestId('next').click();
		await expect(page.getByTestId('step-detail')).toContainText('The app sends them to log in');
		await expect(page.getByTestId('next')).toBeInViewport();
	});

	// What the maintainer met: at the bottom of a long step, Next went off screen until a scroll.
	test('keeps Back and Next on screen after a long step, scrolled to its end', async ({ page }) => {
		await page.goto(`${FLOW_PATH}?mode=advanced&oidc=1&step=token-response`);
		await ready(page);
		const detail = page.locator('aside.detail');
		await detail.evaluate((element) => element.scrollTo(0, element.scrollHeight));
		await expect(page.getByTestId('next')).toBeInViewport();
		await page.getByTestId('next').click();
		await expect(page.getByTestId('position')).toContainText('Step 10');
		await expect(page.getByTestId('next')).toBeInViewport();
		await expect(page.getByTestId('back')).toBeInViewport();
		expect(await page.evaluate(() => window.scrollY)).toBe(0);
	});

	test('opens the settings over everything, and closes them again', async ({ page }) => {
		await page.goto(FLOW_PATH);
		await ready(page);
		await expect(page.locator('[data-setting="oidc"]')).toBeHidden();
		await page.getByTestId('settings-toggle').click();
		await page.locator('[data-setting="oidc"] input').check();
		await expect(page).toHaveURL(/oidc=1/);
		await page.getByTestId('settings-toggle').click();
		await expect(page.locator('[data-setting="oidc"]')).toBeHidden();
		await expect(page.getByTestId('next')).toBeInViewport();
	});

	test('shows raw traffic without running off the screen', async ({ page }) => {
		await page.goto(`${FLOW_PATH}?mode=advanced&oidc=1&step=token-response`);
		await ready(page);
		await expect(page.getByTestId('payload')).toBeVisible();
		expect(await noSidewaysScroll(page)).toBe(true);
	});

	test('has the map, as a plain list', async ({ page }) => {
		await page.goto('./');
		await expect(page.getByTestId('map')).toBeVisible();
		expect(await noSidewaysScroll(page)).toBe(true);
	});

	test('can open a source, and close it again', async ({ page }) => {
		await page.goto(`${FLOW_PATH}?mode=advanced&source=rfc6749&for=client`);
		await ready(page);
		await expect(page.getByTestId('source-panel')).toBeVisible();
		expect(await noSidewaysScroll(page)).toBe(true);
	});
});

test.describe('on a desktop', () => {
	test('draws the lanes side by side, with nothing to switch', async ({ page }) => {
		await open(page);
		await expect(page.getByTestId('diagram')).not.toHaveClass(/strip/);
		await expect(page.getByTestId('full-size')).toHaveCount(0);
	});
});
