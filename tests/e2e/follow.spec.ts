import { expect, test, type Page } from '@playwright/test';
import { expectMatchesModel, open, watchForErrors } from './helpers.ts';

const row = (page: Page, id: string) => page.locator(`[data-step="${id}"]`);
const path = (page: Page) => page.getByTestId('follow-path');

test.describe('following something', () => {
	test('lights up its whole path, ahead as well, and quiets the rest', async ({ page }) => {
		const check = watchForErrors(page);
		await open(page, 'mode=simple&follow=code&step=open-app');
		await expect(row(page, 'callback')).toHaveClass(/on-path/);
		await expect(row(page, 'token-request')).toHaveClass(/on-path/);
		await expect(row(page, 'api-request')).toHaveClass(/off-path/);
		// Ahead, and still spelled out, because the path is what was asked for.
		await expect(row(page, 'callback')).toHaveAttribute('data-state', 'future');
		const opacity = await row(page, 'callback')
			.locator('.label')
			.evaluate((label) => Number(getComputedStyle(label).opacity));
		expect(opacity).toBe(1);
		check();
	});

	test('says what happens at each stop, as a list of steps', async ({ page }) => {
		await open(page, 'mode=simple&follow=code');
		await expect(path(page).getByRole('listitem')).toHaveText([
			/6\s+First sent here/,
			/7\s+Sent here/,
			/8\s+Sent here/
		]);
	});

	test('follows the two forms of a verifier together', async ({ page }) => {
		await open(page, 'mode=simple&client=public&pkce=1&follow=verifier');
		await expect(path(page)).toContainText('Made here');
		await expect(path(page)).toContainText('Code challenge: sent here');
		await expect(path(page)).toContainText('Code verifier: sent here');
		await expect(path(page)).toContainText('Checked here');
		await expect(row(page, 'authorize')).toHaveClass(/on-path/);
		await expect(row(page, 'check-verifier')).toHaveClass(/on-path/);
	});

	test('says it was used up only where a real server refused it', async ({ page }) => {
		await open(page, 'mode=simple&client=public&attacker=1&follow=code');
		await expect(path(page)).toContainText('Refused here: a real server counted it as used');
		await open(page, 'mode=simple&follow=code');
		await expect(path(page)).not.toContainText('Refused here');
	});

	test('leaves stepping as it was', async ({ page }) => {
		await open(page, 'mode=simple&follow=code&step=authorize');
		await page.getByTestId('next').click();
		await expect(page.getByTestId('position')).toContainText('Step 4');
		await expect(path(page)).toBeVisible();
		await expect(page).toHaveURL(/follow=code/);
	});

	test('goes to a stop from the list', async ({ page }) => {
		await open(page, 'mode=simple&follow=code');
		await path(page).locator('[data-stop="token-request"]').click();
		await expect(page.locator('[data-state="current"]')).toHaveAttribute(
			'data-step',
			'token-request'
		);
		await expect(path(page).locator('[data-stop="token-request"]')).toHaveAttribute(
			'aria-current',
			'step'
		);
	});

	test('changes no flow', async ({ page }) => {
		await open(page, 'oidc=1&follow=code');
		await expectMatchesModel(page, 'oidc=1&follow=code');
	});

	test('stays with a reload, and comes off', async ({ page }) => {
		await open(page, 'mode=simple&follow=code');
		await page.reload();
		await expect(path(page)).toBeVisible();
		await page.getByTestId('follow-off').click();
		await expect(page).not.toHaveURL(/follow=/);
		await expect(path(page)).toHaveCount(0);
		await expect(page.locator('.off-path')).toHaveCount(0);
	});

	test('lets go when a setting takes it away', async ({ page }) => {
		await open(page, 'pkce=1&follow=verifier');
		await page.locator('[data-setting="pkce"] input').uncheck();
		await expect(path(page)).toHaveCount(0);
		await expect(page).not.toHaveURL(/follow=/);
	});

	test('still hides what a party never saw', async ({ page }) => {
		await open(page, 'mode=simple&eyes=browser&follow=access-token&step=api-response');
		await expect(page.locator('[data-chip^="token-response"]')).toHaveCount(0);
		await expect(page.locator('[data-held="browser:access-token"]')).toHaveCount(0);
		await expect(page.locator('.chip.followed')).toHaveCount(0);
	});

	test('prints', async ({ page }) => {
		await open(page, 'mode=simple&follow=code');
		await page.emulateMedia({ media: 'print' });
		await expect(path(page)).toBeVisible();
	});
});

test.describe('getting there', () => {
	test('from a chip, with the keyboard or the mouse', async ({ page }) => {
		await open(page, 'mode=simple&step=callback');
		await page.locator('[data-chip^="callback"][data-artifact="code"]').click();
		await page.getByTestId('follow-it').click();
		await expect(page).toHaveURL(/follow=code/);
		// Out of the way, because what it changed is on the diagram.
		await expect(page.getByTestId('explanation')).toHaveCount(0);
		await page.locator('[data-chip^="callback"][data-artifact="code"]').click();
		await expect(page.getByTestId('follow-it')).toHaveText('Stop following');
		await page.getByTestId('follow-it').focus();
		await page.keyboard.press('Enter');
		await expect(page).not.toHaveURL(/follow=/);
	});

	test('not offered for what is not on the way here', async ({ page }) => {
		await open(page, 'mode=simple&explain=artifact.verifier');
		await expect(page.getByTestId('explanation')).toBeVisible();
		await expect(page.getByTestId('follow-it')).toHaveCount(0);
	});

	test('from the question that it answers', async ({ page }) => {
		await page.goto('authorization-code/why-a-code/');
		await page.getByTestId('follow-answer').click();
		await expect(path(page)).toContainText('Following: code');
		await expect(page.getByTestId('title')).toHaveText(/Why not just send the token/);

		await page.goto('authorization-code/pkce/');
		await page.getByTestId('follow-answer').click();
		await expect(path(page)).toContainText('Checked here');
	});
});
