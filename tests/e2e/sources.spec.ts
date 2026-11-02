import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { settingDefs, settingIds, type SettingDef } from '../../src/lib/flow/settings.ts';
import { originalUrl, sources } from '../../src/lib/sources/sources.ts';
import { currentSearch, expectMatchesModel, open, watchForErrors } from './helpers.ts';

const panel = (page: Page) => page.getByTestId('source-panel');
const opener = (page: Page, setting: string, source: string) =>
	page.locator(`[data-source-ref="${setting}:${source}"]`);
const rfcRequests = (page: Page) => {
	const seen: string[] = [];
	page.on('request', (request) => {
		if (request.url().includes('/rfc/')) seen.push(request.url());
	});
	return seen;
};

// Every setting is on offer with DPoP and an external IdP on, apart from the attacker, which is
// only for the plain case, and those that build on another setting.
const ALL_ON_OFFER = 'binding=dpop&broker=1';
const NEEDS: Partial<Record<string, string>> = {
	attacker: '',
	oldWay: 'oldway=1',
	attackerUses: 'attacker=1',
	reuse: 'refresh=1',
	ssoAsks: 'sso=1'
};
const onOffer = (setting: string) => NEEDS[setting] ?? ALL_ON_OFFER;

test.describe('a source', () => {
	for (const setting of settingIds) {
		for (const ref of settingDefs[setting].sources) {
			test(`${setting} opens ${ref.source}`, async ({ page }) => {
				const check = watchForErrors(page);
				const source = sources[ref.source];
				const { onlyOn }: SettingDef = settingDefs[setting];
				if (onlyOn) {
					await page.goto(`${onlyOn}/?mode=advanced&${NEEDS[setting] ?? ''}`);
					await page.locator('.workspace[data-ready="true"]').waitFor();
				} else {
					await open(page, onOffer(setting));
				}
				await opener(page, setting, ref.source).click();

				await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText(source.title);
				await expect(panel(page)).toContainText(source.status);
				await expect(page.getByTestId('source-summary')).toHaveText(source.summary);
				await expect(page.getByTestId('source-why')).toHaveText(ref.why);
				const link = page.getByTestId('source-original');
				await expect(link).toHaveAttribute('href', originalUrl(source, ref.section ?? null));
				await expect(link).toHaveAttribute('target', '_blank');

				if (source.textFile) {
					await expect(page.getByTestId('source-text')).toBeVisible();
				} else {
					await expect(page.getByTestId('source-text')).toHaveCount(0);
					await expect(page.getByTestId('source-sections')).toHaveCount(0);
				}
				check();
			});
		}
	}

	test('opens beside the diagram without moving it', async ({ page }) => {
		await open(page);
		const before = await page.getByTestId('diagram').boundingBox();
		await opener(page, 'clientType', 'rfc6749').click();
		await expect(panel(page)).toBeVisible();
		expect(await page.getByTestId('diagram').boundingBox()).toEqual(before);
		await expectMatchesModel(page, 'source=rfc6749&for=client&section=2.1');
	});

	test('leaves the diagram working when it closes', async ({ page }) => {
		await open(page, 'source=rfc6749&for=client');
		await page.getByTestId('source-close').click();
		await expect(panel(page)).toHaveCount(0);
		await page.getByTestId('next').click();
		await expect(page.locator('[data-state="current"]')).toHaveAttribute(
			'data-step',
			'redirect-to-idp'
		);
	});
});

test.describe('the text of an RFC', () => {
	test('only downloads when someone opens it', async ({ page }) => {
		const requests = rfcRequests(page);
		await open(page);
		await page.getByTestId('next').click();
		expect(requests).toEqual([]);
		await opener(page, 'clientType', 'rfc6749').click();
		await expect(page.getByTestId('source-text')).toBeVisible();
		expect(requests).toHaveLength(1);
		expect(requests[0]).toMatch(/\/rfc\/rfc6749\.txt$/);
	});

	for (const file of ['rfc6749.txt', 'rfc6750.txt', 'rfc9449.txt']) {
		test(`${file} is on screen in full and unchanged`, async ({ page, request }) => {
			const id = file.replace('.txt', '');
			const setting = id === 'rfc6749' ? 'client' : 'binding';
			const published = await (await request.get(`rfc/${file}`)).text();
			await open(page, `binding=dpop&source=${id}&for=${setting}`);
			await expect(page.getByTestId('source-text')).toBeVisible();
			// RFC 9449 starts with a byte-order mark, which every browser drops when it decodes a file.
			expect(await page.getByTestId('source-text').textContent()).toBe(
				published.slice(published.charCodeAt(0) === 0xfeff ? 1 : 0)
			);
			expect(published).toContain('IETF Trust');
		});
	}

	test('opens at the section when the text is there at once, as when it was read before', async ({
		page
	}) => {
		const body = readFileSync('static/rfc/rfc9449.txt', 'utf8');
		await page.route('**/rfc/**', (route) =>
			route.fulfill({ status: 200, contentType: 'text/plain', body })
		);
		await open(page, 'binding=dpop');
		await opener(page, 'dpopNonce', 'rfc9449').click();
		const part = page.locator('[data-section="8"]').locator('b');
		await expect(part).toBeInViewport();
		// And stays there, once the dialog has been drawn.
		await page.waitForTimeout(500);
		await expect(part).toBeInViewport({ timeout: 500 });
	});

	test('opens at the section the source names', async ({ page }) => {
		await open(page, 'binding=dpop');
		await opener(page, 'dpopNonce', 'rfc9449').click();
		await expect(page.locator('[data-section="8"]').locator('b')).toHaveText(
			'8.  Authorization Server-Provided Nonce'
		);
		await expect(page.locator('[data-section="8"]').locator('b')).toBeInViewport();
		await expect(page.getByTestId('source-sections')).toHaveValue('8');
		await expect(page.getByTestId('source-original')).toHaveAttribute(
			'href',
			/rfc9449\.html#section-8$/
		);
	});

	test('can jump between sections, in the URL too', async ({ page }) => {
		await open(page, 'binding=dpop&source=rfc9449&for=binding');
		await page.getByTestId('source-sections').selectOption('10');
		await expect(page.locator('[data-section="10"]').locator('b')).toBeInViewport();
		await expect.poll(() => currentSearch(page)).toContain('section=10');
		await page.getByTestId('source-sections').selectOption('');
		await expect.poll(() => currentSearch(page)).not.toContain('section');
	});

	test('says so when it cannot load, and still links to the original', async ({ page }) => {
		await page.route('**/rfc/**', (route) => route.abort());
		await open(page, 'source=rfc6749&for=client');
		await expect(page.getByTestId('source-failed')).toBeVisible();
		await expect(page.getByTestId('source-original')).toBeVisible();
		await expect(page.getByTestId('source-summary')).toBeVisible();
	});
});

test.describe('going to another part of a source', () => {
	test('neither reloads the text nor loses the place in it', async ({ page }) => {
		const requests = rfcRequests(page);
		await open(page, 'binding=dpop');
		await opener(page, 'dpopNonce', 'rfc9449').click();
		const part = page.locator('[data-section="8"]').locator('b');
		await expect(part).toBeInViewport();
		await page.getByTestId('source-sections').selectOption('4');
		await expect.poll(() => currentSearch(page)).toContain('section=4');
		await expect(page.locator('[data-section="4"]').locator('b')).toBeInViewport();
		expect(requests).toHaveLength(1);
	});
});

test.describe('the URL', () => {
	test('holds what is open, and a reload restores it', async ({ page }) => {
		await open(page, 'binding=dpop');
		await opener(page, 'dpopNonce', 'rfc9449').click();
		await expect
			.poll(() => currentSearch(page))
			.toBe('binding=dpop&source=rfc9449&for=nonce&section=8');
		await page.reload();
		await expect(page.locator('[data-section="8"]').locator('b')).toBeInViewport();
		await expect(page.getByTestId('source-why')).toHaveText(settingDefs.dpopNonce.sources[0].why);
	});

	test('Back closes it, even after jumping between sections', async ({ page }) => {
		await open(page, 'binding=dpop');
		await opener(page, 'binding', 'rfc9449').click();
		await page.getByTestId('source-sections').selectOption('8');
		await expect.poll(() => currentSearch(page)).toContain('section=8');
		await page.goBack();
		await expect(panel(page)).toHaveCount(0);
		await expect.poll(() => currentSearch(page)).toBe('binding=dpop');
	});

	test('a link naming something unknown opens nothing', async ({ page }) => {
		await open(page, 'source=rfc1&for=binding');
		await expect(panel(page)).toHaveCount(0);
		await open(page, 'source=rfc9449');
		await expect(panel(page)).toHaveCount(0);
	});

	test('an unknown section opens at the start', async ({ page }) => {
		await open(page, 'binding=dpop&source=rfc9449&for=binding&section=999');
		await expect(page.getByTestId('source-text')).toBeVisible();
		await expect(panel(page).getByRole('heading', { level: 2 })).toBeInViewport();
	});
});

test.describe('the keyboard', () => {
	test('Escape closes it, and focus returns to the source that opened it', async ({ page }) => {
		await open(page);
		const source = opener(page, 'clientType', 'rfc6749');
		await source.focus();
		await page.keyboard.press('Enter');
		await expect(panel(page)).toBeVisible();
		await expect(panel(page).getByRole('heading', { level: 2 })).toBeFocused();
		await page.keyboard.press('Escape');
		await expect(panel(page)).toHaveCount(0);
		await expect(source).toBeFocused();
	});

	test('the close button does the same', async ({ page }) => {
		await open(page);
		const source = opener(page, 'oidc', 'oidc-core');
		await source.click();
		await page.getByTestId('source-close').click();
		await expect(panel(page)).toHaveCount(0);
		await expect(source).toBeFocused();
	});

	test('arrow keys inside the panel do not step the diagram', async ({ page }) => {
		await open(page);
		await opener(page, 'oidc', 'oidc-core').click();
		await expect(panel(page).getByRole('heading', { level: 2 })).toBeFocused();
		await page.keyboard.press('ArrowRight');
		await expect(page.locator('[data-state="current"]')).toHaveAttribute('data-step', 'open-app');
	});
});
