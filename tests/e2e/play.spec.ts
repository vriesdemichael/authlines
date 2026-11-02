import { expect, test, type Page } from '@playwright/test';
import { open, watchForErrors } from './helpers.ts';

const position = (page: Page) => page.getByTestId('position');
const timeline = (page: Page) => page.getByTestId('timeline');
const play = (page: Page) => page.getByTestId('play');

test.describe('the timeline', () => {
	test('shows the parts of the flow, and which one this is', async ({ page }) => {
		await open(page, 'step=authorize');
		await expect(timeline(page).locator('[data-part]')).toHaveText([
			'Ask',
			'Log in',
			'Trade',
			'Use'
		]);
		await expect(timeline(page)).toHaveAttribute('aria-valuetext', 'Step 3 of 12, Ask');
	});

	test('goes to any step at a click, or to the start of a part', async ({ page }) => {
		const check = watchForErrors(page);
		await open(page, 'step=authorize');
		await timeline(page).locator('[data-tick="token-request"]').click();
		await expect(page).toHaveURL(/step=token-request/);
		await expect(page.locator('[data-state="current"]')).toHaveAttribute(
			'data-step',
			'token-request'
		);
		await timeline(page).locator('[data-part="Log in"]').click();
		await expect(page.locator('[data-state="current"]')).toHaveAttribute('data-step', 'login-page');
		check();
	});

	test('can be moved with the keyboard, and says where it is', async ({ page }) => {
		await open(page, 'step=authorize');
		await timeline(page).focus();
		await page.keyboard.press('ArrowRight');
		await expect(timeline(page)).toHaveAttribute('aria-valuetext', 'Step 4 of 12, Log in');
		await expect(timeline(page)).toBeFocused();
		await page.keyboard.press('Home');
		await expect(timeline(page)).toHaveAttribute('aria-valuenow', '1');
		await page.keyboard.press('End');
		await expect(timeline(page)).toHaveAttribute('aria-valuenow', '12');
	});

	test('follows a setting, which can add a part', async ({ page }) => {
		await open(page, 'step=authorize');
		await page.locator('[data-setting="attacker"] input').check();
		await expect(timeline(page).locator('[data-part="Stolen"]')).toBeVisible();
		await expect(timeline(page)).toHaveAttribute('aria-valuemax', '15');
	});

	test('says why a part is there once, on the step that starts it', async ({ page }) => {
		await open(page, 'step=authorize');
		await expect(page.getByTestId('part-why')).toHaveCount(0);
		await page.getByTestId('next').click();
		await expect(page.getByTestId('part-why')).toContainText('away from the app');
		await page.getByTestId('next').click();
		await expect(page.getByTestId('part-why')).toHaveCount(0);
	});

	test('is not there where the steps are all that fit', async ({ page }) => {
		await page.setViewportSize({ width: 500, height: 800 });
		await open(page, 'step=authorize');
		await expect(timeline(page)).toBeHidden();
		await expect(position(page)).toContainText('Step 3');
	});
});

test.describe('play', () => {
	// On a fake clock, because some steps have seconds of reading on them.
	async function openPaused(page: Page, query: string) {
		await page.clock.install();
		await open(page, query);
		await expect(position(page)).toBeVisible();
	}

	test('moves on by itself, at the pace of what there is to read', async ({ page }) => {
		await openPaused(page, 'step=authorize');
		await play(page).click();
		await expect(play(page)).toHaveText('Stop');
		await page.clock.runFor(1500);
		await expect(position(page)).toContainText('Step 3');
		await page.clock.runFor(9000);
		await expect(position(page)).not.toContainText('Step 3');
	});

	test('does not write history', async ({ page }) => {
		await openPaused(page, 'step=authorize');
		const before = await page.evaluate(() => history.length);
		await play(page).click();
		await page.clock.runFor(9000);
		await expect(position(page)).not.toContainText('Step 3');
		await page.clock.runFor(9000);
		await expect(position(page)).not.toContainText(/Step [34] /);
		expect(await page.evaluate(() => history.length)).toBe(before);
	});

	test('stops when pressed again, and stays stopped', async ({ page }) => {
		await openPaused(page, 'step=authorize');
		await play(page).click();
		await play(page).click();
		await expect(play(page)).toHaveText('Play');
		await page.clock.runFor(20000);
		await expect(position(page)).toContainText('Step 3');
	});

	test('can be started and stopped from the keyboard', async ({ page }) => {
		await openPaused(page, 'step=authorize');
		await play(page).focus();
		await page.keyboard.press('Enter');
		await expect(play(page)).toHaveText('Stop');
		await page.clock.runFor(9000);
		await expect(position(page)).toContainText('Step 4');
		await page.keyboard.press('Enter');
		await expect(play(page)).toHaveText('Play');
		await expect(play(page)).toBeFocused();
	});

	test.describe('stops at any input', () => {
		test('a key', async ({ page }) => {
			await openPaused(page, 'step=authorize');
			await play(page).click();
			await page.keyboard.press('ArrowLeft');
			await expect(play(page)).toHaveText('Play');
			await expect(position(page)).toContainText('Step 2');
			await page.clock.runFor(20000);
			await expect(position(page)).toContainText('Step 2');
		});

		test('a key on the button that is not pressing it', async ({ page }) => {
			await openPaused(page, 'step=authorize');
			await play(page).focus();
			await page.keyboard.press('Enter');
			await page.keyboard.press('ArrowRight');
			await expect(play(page)).toHaveText('Play');
		});

		test('a click', async ({ page }) => {
			await openPaused(page, 'step=authorize');
			await play(page).click();
			await page.locator('[data-lifeline="idp"]').click();
			await expect(play(page)).toHaveText('Play');
		});

		test('scrolling', async ({ page }) => {
			await openPaused(page, 'step=authorize');
			await play(page).click();
			await page.locator('.scroller').hover();
			await page.mouse.wheel(0, 40);
			await expect(play(page)).toHaveText('Play');
		});

		test('flipping a setting', async ({ page }) => {
			await openPaused(page, 'step=authorize');
			await play(page).click();
			await page.locator('[data-setting="pkce"] input').check();
			await expect(play(page)).toHaveText('Play');
		});
	});

	test('stops by itself at the end, and starts over from there', async ({ page }) => {
		await openPaused(page, 'step=authorize');
		await page.keyboard.press('End');
		await page.keyboard.press('ArrowLeft');
		await play(page).click();
		await page.clock.runFor(9000);
		await expect(position(page)).toContainText('Step 12');
		await expect(play(page)).toHaveText('Play');
		await play(page).click();
		await expect(position(page)).toContainText('Step 1');
		await expect(play(page)).toHaveText('Stop');
	});
});

test.describe('with reduced motion', () => {
	test('nothing moves, and what a message carries is simply there', async ({ page }) => {
		await open(page, 'step=login-page');
		await page.getByTestId('next').click();
		await expect(page.locator('.packet')).toBeHidden();
		const shown = (selector: string) =>
			page.locator(selector).evaluate((element) => Number(getComputedStyle(element).opacity));
		expect(await shown('[data-state="current"] .label')).toBe(1);
		expect(await shown('[data-held="idp:password"]')).toBe(1);
		// Not a colour settling, which is a transition and moves nothing.
		const moving = await page.evaluate(
			() =>
				document
					.getAnimations()
					.filter((animation) => animation instanceof CSSAnimation)
					.filter((animation) => animation.playState === 'running').length
		);
		expect(moving).toBe(0);
	});
});
