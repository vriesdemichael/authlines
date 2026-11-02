import { expect, test, type Page } from '@playwright/test';
import { onTheMap } from './helpers.ts';

const PATH = 'client-credentials/';

const openIt = async (page: Page, search = '', path = PATH) => {
	await page.goto(`${path}${search ? `?${search}` : ''}`);
	await page.locator('.workspace[data-ready="true"]').waitFor();
};
const heads = (page: Page) =>
	page
		.locator('[data-lifeline]')
		.evaluateAll((all) => all.map((one) => one.getAttribute('data-lifeline')));
const position = (page: Page) => page.getByTestId('position');
const flow = (page: Page) => page.getByTestId('flow');

test.describe('a flow with no user', () => {
	test('has no browser on it, and can be walked', async ({ page }) => {
		await openIt(page);
		expect(await heads(page)).toEqual(['app', 'idp', 'api']);
		await expect(page.getByTestId('title')).toHaveText('Client credentials flow');
		await expect(position(page)).toHaveText('Step 1 of 5');
		for (let i = 0; i < 4; i++) await page.getByTestId('next').click();
		await expect(position(page)).toHaveText('Step 5 of 5');
		await expect(page.getByTestId('next')).toBeDisabled();
	});

	test('has real traffic, with no refresh token in it', async ({ page }) => {
		await openIt(page, 'mode=advanced&step=service-token-response');
		const payload = page.getByTestId('payload');
		await expect(payload).toContainText('access_token');
		await expect(payload).not.toContainText('refresh_token"');
		await expect(page.getByTestId('step-detail')).toContainText('no refresh token');
	});

	test('does not call its diagram the user flow, when there is no user', async ({ page }) => {
		await openIt(page);
		await expect(page.getByTestId('diagram-switch')).toContainText('The flow');
		await expect(page.getByTestId('diagram-switch')).not.toContainText('User flow');
	});

	test('does not send someone on to a user flow, when there is no user', async ({ page }) => {
		await openIt(page, 'step=service-keys', `${PATH}setup/`);
		await expect(page.getByTestId('step-detail')).not.toContainText('user flow');
		await expect(page.getByTestId('step-detail')).toContainText('The flow');
		await expect(page.getByTestId('step-detail')).toContainText('What happens with no user');
	});

	test('says what the setup is missing without it, where the client is created', async ({
		page
	}) => {
		await openIt(page, 'mode=advanced&step=service-create-client', `${PATH}setup/`);
		await expect(page.getByTestId('step-detail')).toContainText('may act for itself');
		await expect(page.getByTestId('step-detail')).toContainText('Service account roles');
	});

	test('has a setup of its own, with no address to list', async ({ page }) => {
		await openIt(page, '', `${PATH}setup/`);
		await expect(page.locator('.workspace')).toHaveAttribute('data-diagram', 'setup');
		await expect(page.getByTestId('step-detail')).toContainText('no address to list');
		expect(await heads(page)).not.toContain('browser');
	});

	test('says why the rest is not here', async ({ page }) => {
		await openIt(page, 'mode=advanced');
		const list = page.getByTestId('not-here');
		await expect(list.locator('[data-not-here="oidc"]')).toContainText('nobody does');
		await expect(list.locator('[data-not-here="pkce"]')).toContainText('no code to protect');
		await expect(list.locator('[data-not-here="logout"]')).toContainText('no login to end');
		await expect(list.locator('[data-not-here="clientType"]')).toContainText('prove who it is');
	});

	test('has nothing to say on the other flow about what is not here', async ({ page }) => {
		await page.goto('authorization-code/');
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect(page.getByTestId('not-here')).toHaveCount(0);
	});

	test('changes on the same diagram with what does apply', async ({ page }) => {
		await openIt(page, 'mode=advanced');
		await expect(position(page)).toHaveText('Step 1 of 5');
		await page.locator('[data-setting="binding"] input[value="dpop"]').check();
		// The new step comes first, and this stays on the step it was on.
		await expect(position(page)).toHaveText('Step 2 of 6');
		await expect(page).toHaveURL(/binding=dpop/);
	});

	test('runs a step in advanced mode, with what the real server answered', async ({ page }) => {
		await openIt(page, 'mode=advanced&step=service-token-request');
		await page.getByTestId('execute').click();
		await expect(page).toHaveURL(/step=service-token-response/);
	});

	test('has a note on what a real server does about it', async ({ page }) => {
		await openIt(page, 'mode=advanced&step=service-token-request');
		await expect(page.getByTestId('step-detail')).toContainText('Service account roles');
		await openIt(page, 'mode=advanced&step=service-token-request&keycloak=off');
		await expect(page.getByTestId('step-detail')).not.toContainText('Service account roles');
	});

	test('does not offer to run a login, because there is none', async ({ page }) => {
		await openIt(page, 'mode=advanced&step=service-token-request');
		await expect(page.getByTestId('payload')).toBeVisible();
		await expect(page.getByTestId('run-yourself')).toHaveCount(0);
	});
});

test.describe('picking another flow', () => {
	test('goes there, and keeps what still applies', async ({ page }) => {
		await page.goto('authorization-code/?mode=advanced&oidc=1&binding=dpop&say=specs');
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect(flow(page)).toHaveValue('authorization-code');

		await flow(page).selectOption('client-credentials');
		await expect(page).toHaveURL(/client-credentials\//);
		await expect(page.locator('[data-setting="binding"] input[value="dpop"]')).toBeChecked();
		await expect(page).toHaveURL(/say=specs/);
		await expect(page).not.toHaveURL(/oidc/);
		await expect(position(page)).toHaveText('Step 1 of 6');
		expect(await heads(page)).toEqual(['app', 'idp', 'api']);
	});

	test('has the rest again on the way back', async ({ page }) => {
		await page.goto('authorization-code/?mode=advanced&oidc=1');
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await flow(page).selectOption('client-credentials');
		await expect(page).toHaveURL(/client-credentials\//);
		await flow(page).selectOption('authorization-code');
		await expect(page).toHaveURL(/authorization-code\/.*oidc=1/);
		await expect(page.locator('[data-setting="oidc"] input')).toBeChecked();
	});

	test('can be gone back on with the browser', async ({ page }) => {
		await page.goto('authorization-code/?mode=advanced');
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await flow(page).selectOption('client-credentials');
		await expect(page).toHaveURL(/client-credentials\//);
		await page.goBack();
		await expect(page).toHaveURL(/authorization-code\//);
		await expect(flow(page)).toHaveValue('authorization-code');
		expect(await heads(page)).toContain('browser');
	});

	test('does not move the old diagram into the new one', async ({ page }) => {
		await page.goto('authorization-code/?mode=advanced');
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await flow(page).selectOption('client-credentials');
		await expect(page).toHaveURL(/client-credentials\//);
		await expect(page.getByTestId('diagram')).toHaveAttribute('data-animating', 'false');
	});
});

test.describe('from the map', () => {
	test('a question opens it', async ({ page }) => {
		await page.goto('./');
		await page.locator('main[data-ready="true"]').waitFor();
		await (await onTheMap(page, 'no-user')).click();
		await expect(page).toHaveURL(/client-credentials\/no-user/);
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect(page.getByTestId('answer')).toContainText('its own secret');
	});

	test('search does not say it is not here', async ({ page }) => {
		await page.goto('./');
		await page.locator('main[data-ready="true"]').waitFor();
		await page.getByTestId('open-search').click();
		await page.getByTestId('search-input').fill('client credentials');
		await expect(page.getByTestId('search').locator('[data-result]').first()).toBeVisible();
		await expect(page.getByTestId('search')).not.toContainText('does not cover');
	});

	test('search finds it', async ({ page }) => {
		await page.goto('./');
		await page.locator('main[data-ready="true"]').waitFor();
		await page.getByTestId('open-search').click();
		await page.getByTestId('search-input').fill('client_credentials');
		const result = page.getByTestId('search').locator('[data-result]').first();
		await expect(result).toBeVisible();
		await result.click();
		await expect(page).toHaveURL(/client-credentials\//);
	});
});
