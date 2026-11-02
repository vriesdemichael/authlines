import { expect, test, type Page } from '@playwright/test';
import { open } from './helpers.ts';

const cites = (page: Page) => page.getByTestId('step-cites');
const cite = (page: Page, source: string) => page.locator(`[data-step-source="${source}"]`);
const panel = (page: Page) => page.getByTestId('source-panel');
const implicit = (page: Page) => page.locator('[data-step-source="rfc9700"][data-section="2.1.2"]');

test.describe('a claim on a step', () => {
	test('says which spec, right there, for someone who asked for the detail', async ({ page }) => {
		await open(page, 'mode=advanced&step=real-app-refused&attacker=1&client=public&pkce=1');
		await expect(cites(page)).toHaveAttribute('open', '');
		await expect(cite(page, 'rfc6749')).toHaveText('RFC 6749 §4.1.2');
		await expect(cite(page, 'rfc9700')).toHaveText('RFC 9700 §4.2.4');
	});

	test('is not in the way of someone new, and is there in advanced mode', async ({ page }) => {
		await open(page, 'mode=simple&step=redirect-to-idp');
		await expect(cites(page)).toHaveCount(0);
		await open(page, 'mode=advanced&step=redirect-to-idp');
		await expect(cite(page, 'rfc9700')).toBeVisible();
	});

	test('opens beside the diagram at the section, saying what it means here', async ({ page }) => {
		await open(page, 'mode=advanced&step=redirect-with-code');
		await implicit(page).click();
		await expect(panel(page)).toBeVisible();
		await expect(panel(page).getByTestId('source-why')).toContainText('implicit');
		await expect(page).toHaveURL(/source=rfc9700/);
		await expect(page).toHaveURL(/section=2\.1\.2/);
		await expect(page).toHaveURL(/for=step/);
		await expect(page.getByTestId('source-text')).toContainText(
			'SHOULD NOT use the implicit grant'
		);
	});

	test('keeps the source on a reload, and goes back to what opened it', async ({ page }) => {
		await open(page, 'mode=advanced&step=redirect-with-code');
		await implicit(page).click();
		await expect(page).toHaveURL(/source=rfc9700/);
		await page.reload();
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect(panel(page)).toBeVisible();
		await page.getByTestId('source-close').click();
		await expect(implicit(page)).toBeFocused();
	});

	test('has none where nothing is claimed', async ({ page }) => {
		await open(page, 'mode=advanced&step=open-app');
		await expect(cites(page)).toHaveCount(0);
	});

	test('shows both sections when a step rests on two of the same spec', async ({ page }) => {
		await open(page, 'mode=advanced&step=authorize&pkce=1');
		await expect(cites(page)).toContainText('RFC 6749 §4.1.2.1');
		await expect(cites(page)).toContainText('RFC 9700 §2.1');
		await expect(cites(page)).toContainText('RFC 7636 §4.2');
	});

	test('opens the section that was picked, when a step cites two', async ({ page }) => {
		await open(page, 'mode=advanced&step=authorize&pkce=1');
		await page.locator('[data-step-source="rfc9700"][data-section="2.1.1"]').click();
		await expect(page).toHaveURL(/section=2\.1\.1/);
		await expect(panel(page).getByTestId('source-why')).toContainText('S256');
	});

	test('has what it cites for a spec with no text here, as a link to the original', async ({
		page
	}) => {
		await open(page, 'mode=advanced&oidc=1&step=validate-id-token');
		await cite(page, 'oidc-core').click();
		await expect(panel(page).getByTestId('source-why')).toContainText('3.1.3.7');
		await expect(panel(page).getByTestId('source-original')).toHaveAttribute(
			'href',
			/openid-connect-core/
		);
	});
});
