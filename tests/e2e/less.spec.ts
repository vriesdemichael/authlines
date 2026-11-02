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

	test('says where this came from, once, out of the way', async ({ page }) => {
		await open(page, 'mode=simple');
		await expect(present(page, 'provenance')).toHaveCount(1);
		await expect(present(page, 'provenance')).toContainText('real server');
		await expect(page.locator('header')).not.toContainText('Recorded');
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

		await parts.nth(1).locator('summary').click();
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

	test('fits what it first says on the first screen', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto('./');
		await page.locator('main[data-ready="true"]').waitFor();
		await expect(page.locator('.track').last()).toBeInViewport();
	});
});
