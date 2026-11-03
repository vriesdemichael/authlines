import { expect, test, type Page } from '@playwright/test';
import { FLOW_PATH, SETUP_PATH } from './helpers.ts';

const open = async (page: Page, search = '', path = FLOW_PATH) => {
	await page.goto(`${path}?mode=advanced${search}`);
	await page.locator('.workspace[data-ready="true"]').waitFor();
};
const row = (page: Page, step: string) => page.locator(`[data-step="${step}"]`);
const toggle = (page: Page, setting: string) =>
	page.locator(`[data-setting="${setting}"] input[type="checkbox"]`);
const choose = (page: Page, setting: string, value: string) =>
	page.locator(`[data-setting="${setting}"] input[value="${value}"]`);

test.describe('customers with providers of their own (#118)', () => {
	test('asks for the email, and finds the company, on the diagram another provider was on', async ({
		page
	}) => {
		await open(page, '&broker=1');
		await expect(row(page, 'find-company')).toHaveCount(0);
		await toggle(page, 'companies').check();
		await expect(page).toHaveURL(/companies=1/);
		await expect(row(page, 'email-page')).toHaveCount(1);
		await expect(row(page, 'find-company')).toHaveCount(1);
		await expect(row(page, 'redirect-to-upstream')).toHaveCount(1);
		await expect(page.locator('[data-lifeline="upstream"]')).toContainText('Their company');
	});

	test('with SAML, trades nothing out of sight, and the assertion opens', async ({ page }) => {
		await open(page, '&broker=1&companies=1');
		await expect(row(page, 'upstream-token-request')).toHaveCount(1);
		await choose(page, 'customerSpeaks', 'saml').check();
		await expect(page).toHaveURL(/speaks=saml/);
		await expect(row(page, 'upstream-token-request')).toHaveCount(0);
		await open(page, '&broker=1&companies=1&speaks=saml&step=upstream-callback');
		await page.getByTestId('saml').locator('summary').click();
		await expect(page.getByTestId('saml')).toContainText('ann@acme.test');
		await expect(page.getByTestId('saml')).toContainText('saml:Assertion');
	});

	test('turns off with the other provider, and takes the choice of protocol with it', async ({
		page
	}) => {
		await open(page, '&broker=1&companies=1&speaks=saml');
		await toggle(page, 'broker').uncheck();
		await expect(page).not.toHaveURL(/companies=1/);
		await expect(page).not.toHaveURL(/speaks=saml/);
		await expect(row(page, 'find-company')).toHaveCount(0);
	});

	test("puts the customer's admins on the setup, with what goes each way", async ({ page }) => {
		await open(page, '&broker=1&companies=1&speaks=saml&step=send-their-details', SETUP_PATH);
		await expect(page.locator('[data-lifeline="customer-admins"]')).toContainText('Their admins');
		await expect(row(page, 'send-our-details')).toHaveCount(1);
		await expect(row(page, 'register-with-upstream')).toHaveCount(0);
		await expect(page.getByTestId('step-detail')).toContainText('certificate');
	});

	test('is found by the words someone has', async ({ page }) => {
		await page.goto('./');
		await page.locator('main[data-ready="true"]').waitFor();
		await page.getByTestId('open-search').click();
		for (const words of ['log in with your company account', 'SAML', 'multi-tenant']) {
			await page.getByTestId('search-input').fill(words);
			const first = page.getByTestId('search').locator('[data-result]').first();
			await expect(first, words).toContainText(/company account|speaks SAML|SAML/);
		}
	});
});
