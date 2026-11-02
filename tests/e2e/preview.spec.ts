import { expect, test, type Page } from '@playwright/test';
import { open, watchForErrors } from './helpers.ts';

const setting = (page: Page, id: string) => page.locator(`[data-setting="${id}"] label`).first();
const row = (page: Page, id: string) => page.locator(`[data-step="${id}"]`);
const preview = (page: Page) => page.getByTestId('setting-preview');

test.describe('opening a question from the map', () => {
	test.use({ viewport: { width: 1440, height: 900 } });

	test('leaves a setting alone that lands under the mouse that clicked it', async ({ page }) => {
		await page.goto('./');
		await page.locator('main[data-ready="true"]').waitFor();
		const question = page.getByTestId('node-how-access-works');
		const box = (await question.boundingBox())!;
		const at = { x: box.x + 60, y: box.y + box.height / 2 };
		await page.mouse.click(at.x, at.y);
		await page.locator('.workspace[data-ready="true"]').waitFor();

		// Or this would pass for not being anywhere near one.
		const under = await page.evaluate(
			({ x, y }) =>
				document.elementFromPoint(x, y)?.closest('[data-setting]')?.getAttribute('data-setting'),
			at
		);
		expect(under).toBeTruthy();

		await page.waitForTimeout(400);
		await expect(preview(page)).toHaveCount(0);
		await expect(page.locator('[data-lifeline="upstream"]')).toHaveCount(0);
		const position = await page.getByTestId('position').innerText();
		await page.keyboard.press('PageDown');
		await expect(page.getByTestId('position')).not.toHaveText(position);
		await expect(preview(page)).toHaveCount(0);

		// Moving it is pointing at it, and that still works.
		await page.mouse.move(at.x + 3, at.y);
		await expect(preview(page)).toBeVisible();
	});
});

test.describe('pointing at a setting', () => {
	test('shows what it would add, in words as well', async ({ page }) => {
		const check = watchForErrors(page);
		await open(page, 'mode=simple&step=authorize');
		await setting(page, 'attacker').hover();
		await expect(row(page, 'attacker-steals-code')).toHaveClass(/ghost/);
		await expect(page.locator('[data-lifeline="attacker"]')).toBeVisible();
		await expect(preview(page)).toContainText('Adds 1 lifeline');
		await expect(preview(page)).toContainText('steps');
		// Words on what is ahead, which only a preview gives it.
		await expect(row(page, 'attacker-steals-code')).toContainText('copies the code');
		check();
	});

	test('shows what it would take away, struck through', async ({ page }) => {
		await open(page, 'mode=simple&oidc=1&step=authorize');
		await setting(page, 'oidc').hover();
		await expect(row(page, 'userinfo-request')).toHaveClass(/struck/);
		await expect(preview(page)).toContainText('Removes');
	});

	test('changes nothing about the state', async ({ page }) => {
		await open(page, 'mode=simple&step=authorize');
		const address = page.url();
		const history = await page.evaluate(() => window.history.length);
		await setting(page, 'oidc').hover();
		await expect(preview(page)).toBeVisible();
		expect(page.url()).toBe(address);
		expect(await page.evaluate(() => window.history.length)).toBe(history);
		await expect(page.getByTestId('position')).toHaveText('Step 3 of 12');
		await expect(page.getByTestId('change-summary')).toHaveCount(0);
		await expect(page.locator('[data-setting="oidc"] input')).not.toBeChecked();
		await expect(page.locator('[data-state="current"]')).toHaveAttribute('data-step', 'authorize');
	});

	test('goes when the pointer does', async ({ page }) => {
		await open(page, 'mode=simple&step=authorize');
		await setting(page, 'attacker').hover();
		await expect(row(page, 'attacker-steals-code')).toBeVisible();
		await page.mouse.move(800, 5);
		await expect(preview(page)).toHaveCount(0);
		await expect(row(page, 'attacker-steals-code')).toHaveCount(0);
		await expect(page.locator('[data-lifeline="attacker"]')).toHaveCount(0);
		await expect(page.locator('.row.ghost, .row.struck')).toHaveCount(0);
	});

	test('does not fire while someone is moving across the rail', async ({ page }) => {
		// Paused, because a clock that is only installed goes on running between these lines.
		await page.clock.install();
		await open(page, 'mode=simple&step=authorize');
		await page.clock.pauseAt(Date.now() + 60_000);
		await setting(page, 'attacker').hover();
		await page.clock.runFor(100);
		await expect(preview(page)).toHaveCount(0);
		await setting(page, 'consent').hover();
		await page.clock.runFor(100);
		await expect(preview(page)).toHaveCount(0);
		await page.clock.runFor(60);
		await expect(
			page.locator('[data-setting="consent"]').getByTestId('setting-preview')
		).toBeVisible();
	});

	test('becomes the real thing when it is flipped', async ({ page }) => {
		await open(page, 'mode=simple&step=authorize');
		await setting(page, 'oidc').hover();
		await expect(preview(page)).toBeVisible();
		await setting(page, 'oidc').click();
		await expect(page).toHaveURL(/oidc=1/);
		await expect(preview(page)).toHaveCount(0);
		await expect(page.locator('.row.ghost, .row.struck')).toHaveCount(0);
		await expect(page.getByTestId('change-summary')).toBeVisible();
	});

	test('does not start from what slides under a mouse that has not moved', async ({ page }) => {
		await open(page, 'step=authorize');
		// Turning this on moves what is under the pointer, because other settings then say why they
		// cannot be used.
		await page.locator('[data-setting="broker"] input').check();
		await expect(page).toHaveURL(/broker=1/);
		await page.waitForTimeout(300);
		await expect(preview(page)).toHaveCount(0);
		await expect(page.locator('.row.ghost, .row.struck')).toHaveCount(0);
	});

	test('shows a choice that is not the current one, and not the one that is', async ({ page }) => {
		await open(page, 'step=authorize');
		const dpop = page.locator('[data-setting="binding"] label', { hasText: 'DPoP' });
		const bearer = page.locator('[data-setting="binding"] label', { hasText: 'Bearer' });
		await bearer.hover();
		await page.waitForTimeout(250);
		await expect(preview(page)).toHaveCount(0);
		await dpop.hover();
		await expect(preview(page)).toContainText('Adds');
	});

	test('does not preview what cannot be used', async ({ page }) => {
		await open(page, 'oidc=1&binding=dpop&step=authorize');
		const blocked = page.locator('[data-setting="attacker"] label');
		await expect(page.locator('[data-setting="attacker"] input')).toBeDisabled();
		await blocked.hover();
		await page.waitForTimeout(250);
		await expect(preview(page)).toHaveCount(0);
		await expect(
			page.locator('[data-setting="attacker"]').getByTestId('blocked-because')
		).toBeVisible();
	});
});

test.describe('what it says to a screen reader', () => {
	test('makes the page no taller, whatever the rail holds', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 });
		await open(page, 'step=authorize');
		await expect(page.getByTestId('preview-said')).toBeAttached();
		const overflow = await page.evaluate(
			() => document.documentElement.scrollHeight - document.documentElement.clientHeight
		);
		expect(overflow).toBe(0);
	});
});

test.describe('from the keyboard', () => {
	test('focus does what pointing does, and a screen reader hears the same', async ({ page }) => {
		await open(page, 'mode=simple&step=authorize');
		const input = page.locator('[data-setting="attacker"] input');
		await input.focus();
		await expect(preview(page)).toContainText('Adds 1 lifeline');
		await expect(page.getByTestId('preview-said')).toHaveText(await preview(page).innerText());
		await expect(page.getByTestId('preview-said')).toHaveAttribute('role', 'status');
		await page.locator('[data-setting="consent"] input').focus();
		await expect(row(page, 'attacker-steals-code')).toHaveCount(0);
	});
});

test.describe('with nothing to point with', () => {
	test('a touch shows nothing, and flips as it always did', async ({ page }) => {
		await open(page, 'mode=simple&step=authorize');
		await setting(page, 'oidc').evaluate((label) => {
			label.dispatchEvent(
				new PointerEvent('pointerenter', { pointerType: 'touch', bubbles: false })
			);
		});
		await page.waitForTimeout(250);
		await expect(preview(page)).toHaveCount(0);
	});
});

test.describe('with motion', () => {
	test.use({ contextOptions: { reducedMotion: 'no-preference' } });

	test('moves quickly, and comes back', async ({ page }) => {
		await open(page, 'mode=simple&step=authorize');
		await setting(page, 'attacker').hover();
		await expect(row(page, 'attacker-steals-code')).toBeVisible();
		await expect(page.getByTestId('diagram')).toHaveAttribute('data-animating', 'false', {
			timeout: 1000
		});
		await page.mouse.move(800, 5);
		await expect(row(page, 'attacker-steals-code')).toHaveCount(0, { timeout: 1000 });
	});
});
