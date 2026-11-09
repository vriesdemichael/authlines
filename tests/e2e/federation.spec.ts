import { expect, test, type Page } from '@playwright/test';
import { FLOW_PATH } from './helpers.ts';

const open = async (page: Page, search = '') => {
	await page.goto(`${FLOW_PATH}?mode=advanced${search}`);
	await page.locator('.workspace[data-ready="true"]').waitFor();
};
const row = (page: Page, step: string) => page.locator(`[data-step="${step}"]`);
const toggle = (page: Page, setting: string) =>
	page.locator(`[data-setting="${setting}"] input[type="checkbox"]`);

test.describe('users in a directory', () => {
	test('adds a lookup on the server, and nothing the browser takes part in', async ({ page }) => {
		await open(page);
		await expect(row(page, 'directory-bind')).toHaveCount(0);
		await toggle(page, 'federation').check();
		await expect(page).toHaveURL(/directory=1/);
		await expect(row(page, 'directory-search')).toHaveCount(1);
		await expect(row(page, 'directory-bind')).toHaveCount(1);
		await expect(page.getByTestId('change-summary')).toContainText('steps added');
	});

	test('flips with another provider, on the same diagram', async ({ page }) => {
		await open(page, '&broker=1');
		await expect(row(page, 'redirect-to-upstream')).toHaveCount(1);
		await toggle(page, 'federation').check();
		await expect(row(page, 'redirect-to-upstream')).toHaveCount(0);
		await expect(row(page, 'directory-bind')).toHaveCount(1);
		await expect(page).not.toHaveURL(/broker=1/);
		await toggle(page, 'broker').check();
		await expect(row(page, 'directory-bind')).toHaveCount(0);
		await expect(row(page, 'redirect-to-upstream')).toHaveCount(1);
		await expect(page).not.toHaveURL(/directory=1/);
	});

	test('shows the password reaching the directory, and what it answers', async ({ page }) => {
		await open(page, '&directory=1&step=directory-bind');
		await expect(page.getByTestId('on-the-wire')).toContainText('mech=SIMPLE');
		await open(page, '&directory=1&step=directory-bound');
		await expect(page.getByTestId('on-the-wire')).toContainText('RESULT tag=97 err=0');
		await expect(page.getByTestId('on-the-wire')).toContainText('From the log, not the wire');
		await expect(page.getByTestId('on-the-wire')).toContainText('ssf=0');
	});

	test('offers no command for what is not HTTP', async ({ page }) => {
		await open(page, '&directory=1&step=directory-bind');
		await expect(page.getByTestId('copy-request')).toHaveCount(0);
	});

	test('is a question on the map, and search finds it', async ({ page }) => {
		await page.goto(`${FLOW_PATH}users-in-a-directory/`);
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect(
			page.locator(
				'[data-step="directory-bind"] [aria-current="step"], [data-step="directory-bind"][aria-current="step"]'
			)
		).toHaveCount(1);
	});

	test('stays on as a chip in simple mode', async ({ page }) => {
		await page.goto(`${FLOW_PATH}?mode=simple&directory=1`);
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect(page.locator('[data-setting="federation"]')).toHaveCount(0);
		await expect(page.getByText('Users in a directory')).toBeVisible();
	});
});

// A Kerberos ticket on a company network, recorded with MIT Kerberos and Chromium on Linux (#148).
test.describe('a ticket on a company network', () => {
	test('takes the login page and the password away, and adds the KDC', async ({ page }) => {
		await open(page, '&directory=1');
		await expect(row(page, 'send-ticket')).toHaveCount(0);
		await toggle(page, 'kerberos').check();
		await expect(page).toHaveURL(/kerberos=1/);
		for (const step of ['computer-asks', 'kdc-gives-tgt', 'idp-negotiate', 'send-ticket']) {
			await expect(row(page, step)).toHaveCount(1);
		}
		for (const step of ['login-page', 'submit-credentials', 'directory-bind']) {
			await expect(row(page, step)).toHaveCount(0);
		}
		await expect(row(page, 'directory-search')).toHaveCount(1);
	});

	test('falls back to the login page in a browser that was not told', async ({ page }) => {
		await open(page, '&directory=1&kerberos=1&ticket=not-sent');
		await expect(row(page, 'send-ticket')).toHaveCount(0);
		await expect(row(page, 'ask-for-service-ticket')).toHaveCount(0);
		for (const step of ['no-ticket', 'login-page', 'submit-credentials', 'directory-bind']) {
			await expect(row(page, step)).toHaveCount(1);
		}
	});

	test('reads the ticket off the wire, and offers no command for it', async ({ page }) => {
		await open(page, '&directory=1&kerberos=1&step=kdc-gives-service-ticket');
		const wire = page.getByTestId('on-the-wire');
		await expect(wire).toContainText('Kerberos TGS-REP, over TCP');
		await expect(wire).toContainText('HTTP/localhost');
		await expect(wire).toContainText('read by RFC 4120');
		// A request, where an HTTP one would have a command to copy.
		await open(page, '&directory=1&kerberos=1&step=ask-for-service-ticket');
		await expect(wire).toContainText('Kerberos TGS-REQ, over TCP');
		await expect(page.getByTestId('copy-request')).toHaveCount(0);
		await open(page, '&directory=1&kerberos=1&step=idp-negotiate');
		await expect(wire).toContainText('Negotiate');
	});

	test('answers why there was no password, at the step that shows it', async ({ page }) => {
		await page.goto(`${FLOW_PATH}no-password-on-the-network/`);
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect(
			page.locator(
				'[data-step="send-ticket"] [aria-current="step"], [data-step="send-ticket"][aria-current="step"]'
			)
		).toHaveCount(1);
	});
});
