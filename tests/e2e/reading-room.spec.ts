import { expect, test, type Page } from '@playwright/test';
import { FLOW_PATH } from './helpers.ts';

// Room to read the step, and what each key on the wire means (the maintainer, 2026-11-09).
const open = async (page: Page, search = '') => {
	await page.goto(`${FLOW_PATH}?mode=advanced${search}`);
	await page.locator('.workspace[data-ready="true"]').waitFor();
};
const panelWidth = async (page: Page) =>
	(await page.locator('aside.detail').boundingBox())?.width ?? 0;

test.describe('the edge of the step panel', () => {
	test.use({ viewport: { width: 1440, height: 900 } });

	test('drags wider, keeps that width after a reload, and goes back with Home', async ({
		page
	}) => {
		await open(page);
		const divider = page.getByTestId('panel-divider');
		expect(Math.round(await panelWidth(page))).toBe(330);
		const box = (await divider.boundingBox())!;
		await page.mouse.move(box.x + box.width / 2, box.y + 200);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width / 2 - 200, box.y + 200, { steps: 4 });
		await page.mouse.up();
		expect(Math.round(await panelWidth(page))).toBe(530);
		await page.reload();
		await page.locator('.workspace[data-ready="true"]').waitFor();
		expect(Math.round(await panelWidth(page))).toBe(530);
		await divider.focus();
		await divider.press('Home');
		expect(Math.round(await panelWidth(page))).toBe(330);
	});

	test('moves by the arrow keys, and never leaves the diagram without room', async ({ page }) => {
		await open(page);
		const divider = page.getByTestId('panel-divider');
		await divider.focus();
		await divider.press('ArrowLeft');
		await expect(divider).toHaveAttribute('aria-valuenow', '346');
		await divider.press('End');
		const most = Number(await divider.getAttribute('aria-valuemax'));
		expect(Math.round(await panelWidth(page))).toBe(most);
		const diagram = (await page.locator('main').boundingBox())!.width;
		expect(diagram).toBeGreaterThanOrEqual(400);
	});

	test('is not there when the step is under the diagram', async ({ page }) => {
		await page.setViewportSize({ width: 900, height: 900 });
		await open(page);
		await expect(page.getByTestId('panel-divider')).toHaveCount(0);
	});
});

test.describe('a key on the wire', () => {
	test('says what it means while the pointer is on it, and stays when clicked', async ({
		page
	}) => {
		await open(page, '&directory=1&kerberos=1&step=ask-for-service-ticket');
		const kvno = page.locator('button.key[data-key="kvno"]');
		await expect(page.getByTestId('key-why')).toHaveCount(0);
		await kvno.hover();
		await expect(page.getByTestId('key-why')).toContainText('Which version of the key');
		await expect(page.getByTestId('key-why').getByRole('link')).toHaveAttribute(
			'href',
			/rfc4120\.html#section-5\.2\.9$/
		);
		await page.mouse.move(0, 0);
		await expect(page.getByTestId('key-why')).toHaveCount(0);
		await kvno.click();
		await page.mouse.move(0, 0);
		await expect(page.getByTestId('key-why')).toHaveCount(1);
		await kvno.focus();
		await kvno.press('Escape');
		await kvno.blur();
		await expect(page.getByTestId('key-why')).toHaveCount(0);
	});

	test('is everywhere a name is: a header, a parameter, and a claim in an opened token', async ({
		page
	}) => {
		await open(page, '&oidc=1&step=token-response&decoded=1');
		await page.locator('button.key[data-key="content-type"]').first().hover();
		await expect(page.getByTestId('key-why')).toContainText('What kind of data the body is');
		const azp = page.locator('[data-testid="opened-token"] button.key[data-key="azp"]').first();
		await azp.click();
		await page.mouse.move(0, 0);
		await expect(page.getByTestId('key-why')).toContainText('The app it was given to');
		await open(page, '&pkce=1&step=authorize');
		await page.locator('button.key[data-key="code_challenge_method"]').first().focus();
		await expect(page.getByTestId('key-why')).toContainText('one-way hash');
	});

	test('says which kind of pre-authentication data it is', async ({ page }) => {
		await open(page, '&directory=1&kerberos=1&step=ask-for-service-ticket');
		await page.locator('button.key[data-key="padata-type"]').first().focus();
		await expect(page.getByTestId('key-why')).toContainText('This one:');
	});
});
