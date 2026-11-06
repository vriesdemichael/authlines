import { expect, test, type Page } from '@playwright/test';
import { open } from './helpers.ts';

const IN_ADVANCED_ONLY = ['flow', 'words', 'eyes', 'whole-flow', 'step-channel', 'step-cites'];

const present = (page: Page, id: string) => page.getByTestId(id);

test.describe('simple mode', () => {
	test('is the diagram and the step, with the rest one press away', async ({ page }) => {
		await open(page, 'mode=simple&step=redirect-with-code');
		for (const id of IN_ADVANCED_ONLY) await expect(present(page, id), id).toHaveCount(0);
		await expect(present(page, 'diagram')).toBeVisible();
		await expect(present(page, 'next')).toBeVisible();
		await expect(present(page, 'how-to-read')).toBeVisible();
		await expect(page.locator('body')).not.toContainText('Prototype');

		await page.locator('[data-mode="advanced"]').click();
		for (const id of IN_ADVANCED_ONLY) await expect(present(page, id), id).toBeVisible();
		await expect(page.locator('body')).not.toContainText('Prototype');
	});

	test('keeps what someone has to do closed until they ask', async ({ page }) => {
		await open(page, 'mode=simple&step=token-request');
		const whatToDo = present(page, 'step-what-to-do');
		await expect(present(page, 'step-practice')).toBeHidden();
		await whatToDo.locator('summary').click();
		await expect(present(page, 'step-practice')).toBeVisible();
		await expect(present(page, 'to-list')).toBeVisible();
	});

	// The maintainer, 2026-11-06: simple mode said it was recorded, and showed nothing recorded.
	test('says where it was recorded only where what was recorded can be seen', async ({ page }) => {
		await open(page, 'mode=simple');
		await expect(present(page, 'provenance')).toHaveCount(0);
		await expect(page.locator('main')).not.toContainText('Recorded');
		await open(page, 'mode=advanced');
		await expect(present(page, 'provenance')).toContainText('Recorded from');
	});

	test('still has the way back from what an address turned on', async ({ page }) => {
		await open(page, 'mode=simple&eyes=browser');
		await expect(present(page, 'eyes')).toBeVisible();
		await open(page, 'mode=simple&whole=1');
		await expect(present(page, 'whole-flow')).toHaveText('Back to the step');
		await open(page, 'mode=simple&say=specs');
		await expect(present(page, 'words')).toHaveValue('specs');
		await open(page, 'mode=simple&settings=off');
		await expect(present(page, 'settings-toggle')).toHaveText('Show settings');
	});

	for (const [width, shownAtFirst] of [
		[1440, true],
		[1100, false]
	] as const) {
		test(`has the control for the settings at their side, and it stays put, at ${width}`, async ({
			page
		}) => {
			await page.setViewportSize({ width, height: 800 });
			await open(page, 'mode=simple');
			const toggle = present(page, 'settings-toggle');
			const settings = page.locator('aside.settings');
			const mark = toggle.locator('svg');
			const where = (await mark.boundingBox())!;
			expect(where.x).toBeLessThan(40);
			await (shownAtFirst ? expect(settings).toBeVisible() : expect(settings).toBeHidden());

			// Twice, from where the mouse is, and with no need to look for it again.
			await page.mouse.click(where.x + 4, where.y + 4);
			await (shownAtFirst ? expect(settings).toBeHidden() : expect(settings).toBeVisible());
			expect(await mark.boundingBox()).toEqual(where);
			await page.mouse.click(where.x + 4, where.y + 4);
			await (shownAtFirst ? expect(settings).toBeVisible() : expect(settings).toBeHidden());
			expect(await mark.boundingBox()).toEqual(where);
		});
	}

	test('keeps it working from the keyboard, and hidden settings in the address', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1440, height: 800 });
		await open(page, 'mode=simple');
		const toggle = present(page, 'settings-toggle');
		await toggle.focus();
		await page.keyboard.press('Enter');
		await expect(page).toHaveURL(/settings=off/);
		await expect(toggle).toHaveText('Show settings');
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await expect(toggle).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(toggle).toHaveText('Hide settings');
		await expect(toggle).toHaveAttribute('aria-expanded', 'true');
	});

	test('gives the room to the diagram where there is nothing to change', async ({ page }) => {
		await page.goto('client-credentials/');
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect(page.getByRole('complementary', { name: 'Settings' })).toBeHidden();
		await expect(present(page, 'settings-toggle')).toHaveCount(0);
		await expect(present(page, 'not-here')).toHaveCount(0);
	});

	test('has why as a mark beside the switch, and it does not get in the way of it', async ({
		page
	}) => {
		await open(page, 'mode=simple');
		const row = page.locator('[data-setting="broker"]');
		const why = row.locator('[data-why="broker"]');
		await expect(why).toHaveText('?');
		await expect(why).toHaveAccessibleName(/^Why /);
		await row.locator('input').check();
		await expect(row.locator('input')).toBeChecked();
		await expect(page).toHaveURL(/broker=1/);
		await why.click();
		await expect(page.getByTestId('explanation')).toBeVisible();
	});
});

test.describe('the start', () => {
	test('has one part open, says what is in the rest, and opens one at a time', async ({ page }) => {
		await page.goto('./');
		await page.locator('main[data-ready="true"]').waitFor();
		const parts = page.locator('.track details');
		await expect(parts.first()).toHaveAttribute('open', '');
		await expect(page.locator('.track details[open]')).toHaveCount(1);
		await expect(page.getByTestId('node-how-access-works')).toBeVisible();
		await expect(page.getByTestId('node-stolen-code')).toBeHidden();

		await page
			.locator('.track details', { has: page.getByTestId('node-stolen-code') })
			.locator('summary')
			.click();
		await expect(page.getByTestId('node-stolen-code')).toBeVisible();
		await expect(page.getByTestId('node-how-access-works')).toBeHidden();
		await expect(page.locator('.track details[open]')).toHaveCount(1);
	});

	test('opens the part someone came back to', async ({ page }) => {
		await page.goto('./?at=stolen-code');
		await page.locator('main[data-ready="true"]').waitFor();
		await expect(page.getByTestId('node-stolen-code')).toBeVisible();
		await expect(page.locator('.track details[open]')).toHaveCount(1);
	});

	// Measured when the maintainer found it busy, so that it can only stay or go down (#142).
	for (const [mode, words, controls] of [
		['simple', 330, 40],
		['advanced', 610, 56]
	] as const) {
		test(`stays within what ${mode} mode has on screen`, async ({ page }) => {
			await page.setViewportSize({ width: 1440, height: 900 });
			await page.goto(`authorization-code/?mode=${mode}`);
			await page.locator('.workspace[data-ready="true"]').waitFor();
			// What is on screen once it has settled, or this passes by luck on a busy machine.
			if (mode === 'advanced') await page.getByTestId('payload').waitFor();
			const measured = await page.evaluate(() => ({
				words: document.body.innerText.split(/\s+/).filter(Boolean).length,
				controls: [...document.querySelectorAll('button, a, input, select, summary')].filter(
					(control) => {
						const box = control.getBoundingClientRect();
						return box.width > 0 && box.height > 0 && box.top < innerHeight;
					}
				).length
			}));
			expect(measured.words).toBeLessThanOrEqual(words);
			expect(measured.controls).toBeLessThanOrEqual(controls);
		});
	}

	test('fits what it first says on the first screen', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto('./');
		await page.locator('main[data-ready="true"]').waitFor();
		await expect(page.locator('.track').last()).toBeInViewport({ ratio: 1 });
	});
});
