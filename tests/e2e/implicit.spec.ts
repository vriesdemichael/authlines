import { expect, test } from '@playwright/test';
import { currentSearch, open } from './helpers.ts';

// The maintainer, 2026-11-08: "Why not send the token here info panel, make implicit flow also
// clickable so you can see that one." So it is drawn, from a real run, and one word away.
test.describe('the implicit flow', () => {
	test('is one word away from why the token is not sent back with the code', async ({ page }) => {
		await open(page, 'mode=simple&step=redirect-with-code');
		const pitfall = page.getByTestId('step-pitfall');
		await pitfall.getByText('Why not send the token here?').click();
		await pitfall.locator('[data-term="implicit-flow"]').click();
		await expect(page.getByTestId('explanation')).toContainText('Implicit flow');
		await page.getByTestId('explanation-see-it').click();
		await expect.poll(() => currentSearch(page)).toContain('implicit=1');
		await expect.poll(() => currentSearch(page)).toContain('step=redirect-with-token');
		await expect(page.locator('[data-state="current"]')).toHaveAttribute(
			'data-step',
			'redirect-with-token'
		);
	});

	test('has no code and no trade', async ({ page }) => {
		await open(page, 'mode=advanced&implicit=1&runs=page&client=public');
		await expect(page.locator('[data-step="redirect-with-token"]')).toHaveCount(1);
		await expect(page.locator('[data-step="redirect-with-code"]')).toHaveCount(0);
		await expect(page.locator('[data-step="token-request"]')).toHaveCount(0);
	});

	test('leaves the token in the address of the page, after the #', async ({ page }) => {
		await open(page, 'mode=simple&implicit=1&runs=page&client=public&step=callback');
		const address = page.getByTestId('page-address');
		await expect(address).toContainText('#');
		await expect(address.locator('[data-parameter="access_token"]')).toBeVisible();
	});
});
