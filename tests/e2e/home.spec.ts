import { gzipSync } from 'node:zlib';
import { expect, test, type Page } from '@playwright/test';
import { mapNodes } from '../../src/lib/map/tracks.ts';
import { onTheMap } from './helpers.ts';

const living = (page: Page) => page.getByTestId('living');

async function openHome(page: Page) {
	await page.setViewportSize({ width: 1400, height: 900 });
	await page.goto('./');
	await page.locator('main[data-ready="true"]').waitFor();
	await living(page).waitFor();
}

test.describe('the living diagram, with no input', () => {
	test.use({ contextOptions: { reducedMotion: 'no-preference' } });

	test('changes once within five seconds, and then stays still', async ({ page }) => {
		await openHome(page);
		await expect(living(page)).toHaveAttribute('data-node', 'how-access-works');
		await expect(living(page)).toHaveAttribute('data-node', 'who-logged-in', { timeout: 5000 });
		const animated = page.getByTestId('diagram');
		await expect(animated).toHaveAttribute('data-animating', 'false');
		await page.waitForTimeout(3000);
		await expect(living(page)).toHaveAttribute('data-node', 'who-logged-in');
		await expect(animated).toHaveAttribute('data-animating', 'false');
	});

	test('does not move by itself once someone has pointed at something', async ({ page }) => {
		await openHome(page);
		await (await onTheMap(page, 'pkce')).hover();
		await expect(living(page)).toHaveAttribute('data-node', 'pkce');
		await page.waitForTimeout(3000);
		await expect(living(page)).toHaveAttribute('data-node', 'pkce');
	});
});

test.describe('pointing at a question', () => {
	test('waits for the mouse to rest', async ({ page }) => {
		await openHome(page);
		await page.evaluate(() => {
			const state = window as unknown as { moved: number; changed: number };
			addEventListener('pointermove', () => (state.moved = performance.now()), true);
			new MutationObserver(() => (state.changed = performance.now())).observe(
				document.querySelector('[data-testid="living"]')!,
				{ attributes: true, attributeFilter: ['data-node'] }
			);
		});
		await (await onTheMap(page, 'pkce')).hover();
		await expect(living(page)).toHaveAttribute('data-node', 'pkce');
		const waited = await page.evaluate(() => {
			const state = window as unknown as { moved: number; changed: number };
			return state.changed - state.moved;
		});
		expect(waited).toBeGreaterThanOrEqual(250);
	});

	test('stays on its question when the mouse goes across to the diagram', async ({ page }) => {
		await openHome(page);
		const pkce = await onTheMap(page, 'pkce');
		await pkce.hover();
		await expect(living(page)).toHaveAttribute('data-node', 'pkce');

		// Over another question on the way, as a straight line from one to the other would be.
		const other = page.locator('[data-testid^="node-"]:visible').first();
		const crossed = (await other.boundingBox())!;
		const there = (await living(page).boundingBox())!;
		await page.mouse.move(crossed.x + 50, crossed.y + crossed.height / 2);
		await page.mouse.move(there.x + there.width / 2, there.y + there.height / 2, { steps: 4 });
		await page.waitForTimeout(800);
		await expect(living(page)).toHaveAttribute('data-node', 'pkce');
	});

	test('does not move by itself under a mouse that is on it', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await openHome(page);
		const there = (await living(page).boundingBox())!;
		await page.mouse.move(there.x + there.width / 2, there.y + there.height / 2);
		await page.waitForTimeout(3000);
		await expect(living(page)).toHaveAttribute('data-node', 'how-access-works');
	});

	test('still shows a question reached with the keyboard', async ({ page }) => {
		await openHome(page);
		const pkce = await onTheMap(page, 'pkce');
		await pkce.focus();
		await expect(living(page)).toHaveAttribute('data-node', 'pkce');
	});

	test('opens at once when clicked', async ({ page }) => {
		await openHome(page);
		await (await onTheMap(page, 'pkce')).click();
		await expect(page).toHaveURL(/pkce/);
		await page.locator('.workspace[data-ready="true"]').waitFor();
	});
});

test.describe('the first screen', () => {
	test('has the whole diagram and what it says on it, without scrolling', async ({ page }) => {
		await openHome(page);
		await expect(page.getByTestId('living-open')).toBeInViewport();
		await expect(page.locator('[data-lifeline="api"]')).toBeInViewport();
	});

	test('stops saying what changed, because nothing else will', async ({ page }) => {
		await openHome(page);
		await (await onTheMap(page, 'pkce')).hover();
		await expect(living(page)).toHaveAttribute('data-node', 'pkce');
		await expect(page.locator('.row.fresh').first()).toBeAttached();
		await expect(page.locator('.row.fresh')).toHaveCount(0, { timeout: 5000 });
	});
});

test.describe('with reduced motion', () => {
	test('does not move at all, and still says what it shows', async ({ page }) => {
		await openHome(page);
		await page.waitForTimeout(3000);
		await expect(living(page)).toHaveAttribute('data-node', 'how-access-works');
		await expect(page.getByTestId('living-answer')).not.toBeEmpty();
	});
});

test.describe('pointing at a question', () => {
	test('moves the diagram to it, and leaves the address alone', async ({ page }) => {
		await openHome(page);
		const before = page.url();
		await (await onTheMap(page, 'stolen-code')).hover();
		await expect(living(page)).toHaveAttribute('data-node', 'stolen-code');
		await expect(page.locator('[data-lifeline="attacker"]')).toBeVisible();
		await expect(page.getByTestId('living-answer')).toContainText(
			mapNodes.find(({ id }) => id === 'stolen-code')!.answer.slice(0, 40)
		);
		expect(page.url()).toBe(before);
	});

	test('from the keyboard does the same', async ({ page }) => {
		await openHome(page);
		const before = page.url();
		await (await onTheMap(page, 'pkce')).focus();
		await expect(living(page)).toHaveAttribute('data-node', 'pkce');
		expect(page.url()).toBe(before);
	});

	test('marks the one on show, and only that one', async ({ page }) => {
		await openHome(page);
		await (await onTheMap(page, 'pkce')).hover();
		await expect(page.locator('.stop.showing')).toHaveCount(1);
		await expect(await onTheMap(page, 'pkce')).toHaveClass(/showing/);
	});

	test('can be opened, by the question or the link under the diagram', async ({ page }) => {
		await openHome(page);
		await (await onTheMap(page, 'pkce')).hover();
		await expect(living(page)).toHaveAttribute('data-node', 'pkce');
		await page.getByTestId('living-open').click();
		await expect(page).toHaveURL(/pkce\/$/);
		await page.locator('.workspace[data-ready="true"]').waitFor();
	});

	test('cannot be tabbed into, because everything it can do is in the links', async ({ page }) => {
		await openHome(page);
		await expect(living(page).locator('.picture')).toHaveAttribute('inert', '');
	});
});

test.describe('coming back', () => {
	test('shows the question someone came from', async ({ page }) => {
		await page.setViewportSize({ width: 1400, height: 900 });
		await page.goto('./?at=pkce');
		await expect(living(page)).toHaveAttribute('data-node', 'pkce');
		await expect(await onTheMap(page, 'pkce')).toHaveAttribute('aria-current', 'location');
	});
});

test.describe('without room for it', () => {
	test('the map is a plain list, with no diagram, and says what each one is', async ({ page }) => {
		await page.setViewportSize({ width: 800, height: 900 });
		await page.goto('./');
		await page.locator('main[data-ready="true"]').waitFor();
		await expect(living(page)).toHaveCount(0);
		await expect(await onTheMap(page, 'pkce')).toContainText(
			mapNodes.find(({ id }) => id === 'pkce')!.summary
		);
	});
});

test.describe('without JavaScript', () => {
	test('every question is still a link', async ({ browser }) => {
		const context = await browser.newContext({ javaScriptEnabled: false });
		const page = await context.newPage();
		await page.goto('./');
		await expect(page.getByTestId('map').locator('a')).toHaveCount(mapNodes.length);
		await context.close();
	});
});

test.describe('the first load', () => {
	test('stays small, with the diagram and the flows loaded after it', async ({ page }) => {
		const loaded = new Map<string, number>();
		page.on('response', async (response) => {
			if (!response.url().endsWith('.js') || response.status() !== 200) return;
			loaded.set(response.url(), gzipSync(await response.body()).length);
		});
		await page.setViewportSize({ width: 800, height: 900 });
		await page.goto('./');
		await page.locator('main[data-ready="true"]').waitFor();
		await page.waitForLoadState('networkidle');
		const total = [...loaded.values()].reduce((sum, size) => sum + size, 0);
		console.log(`The first load is ${Math.round(total / 1024)} KiB of script, compressed.`);
		expect(total).toBeLessThan(60 * 1024);
	});
});
