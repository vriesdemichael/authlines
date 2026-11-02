import { expect, test, type Page } from '@playwright/test';
import { open, watchForErrors } from './helpers.ts';

const page$ = (page: Page) => page.getByTestId('run-it-yourself');

test.describe('running it yourself', () => {
	test('says what it needs, and warns about real secrets', async ({ page }) => {
		const check = watchForErrors(page);
		await page.goto('run-it-yourself/');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Run it yourself');
		await expect(page.getByTestId('throwaway')).toContainText('Never paste real secrets');
		await expect(page$(page)).toContainText('docker run');
		await expect(page$(page)).toContainText('quay.io/keycloak/keycloak:');
		await expect(page$(page)).toContainText('look at your address bar');
		check();
	});

	test('is one click from the home screen, where it says you can', async ({ page }) => {
		await page.goto('./');
		await page
			.getByTestId('source-link')
			.getByRole('link', { name: 'you can run yourself' })
			.click();
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Run it yourself');
	});

	test('fits the settings someone came from', async ({ page }) => {
		await page.goto('run-it-yourself/');
		await expect(page.getByTestId('fits-settings')).toContainText('an app with a secret');
		await expect(page$(page)).toContainText('-u ');
		await expect(page$(page)).not.toContainText('code_verifier');

		await page.goto('run-it-yourself/?client=public&pkce=1&oidc=1');
		await expect(page.getByTestId('fits-settings')).toContainText('an app with no secret, PKCE');
		await expect(page$(page)).toContainText('code_verifier');
		await expect(page$(page)).not.toContainText("-u '");
		await expect(page.getByRole('heading', { name: 'Ask who logged in' })).toBeVisible();
	});

	test('is reached from what was recorded, with the settings on screen', async ({ page }) => {
		await open(page, 'mode=advanced&pkce=1&step=token-request');
		await page.getByTestId('run-it-yourself-link').click();
		await expect(page).toHaveURL(/run-it-yourself\/\?.*pkce=1/);
		await expect(page$(page)).toContainText('code_verifier');
		await page.getByTestId('back-to-diagram').click();
		await expect(page.getByTestId('workspace')).toBeVisible();
		await expect(page).toHaveURL(/pkce=1/);
	});

	test('can be copied, step by step', async ({ page }) => {
		await page.addInitScript(() => {
			const holder = window as unknown as { copied?: string };
			Object.defineProperty(navigator, 'clipboard', {
				configurable: true,
				value: { writeText: async (text: string) => void (holder.copied = text) }
			});
		});
		await page.goto('run-it-yourself/');
		await expect(page.locator('[data-ready="true"]')).toBeVisible();
		await page.getByTestId('copy').first().click();
		await expect(page.getByTestId('copy-block').first().getByRole('status')).toHaveText('Copied.');
		const copied = await page.evaluate(() => (window as unknown as { copied?: string }).copied);
		expect(copied).toContain('docker run');
		expect(copied).toContain("cat > demo-realm.json <<'EOF'");
	});
});
