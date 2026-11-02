import { expect, test, type Page } from '@playwright/test';
import { open, visibleStepIds } from './helpers.ts';

const words = (page: Page) => page.getByTestId('words');
const head = (page: Page, id: string) => page.locator(`[data-lifeline="${id}"]`);
const detail = (page: Page) => page.getByTestId('step-detail');

test.describe('whose words the diagram is in', () => {
	test('changes the names in place, and no step', async ({ page }) => {
		await open(page, 'mode=advanced&step=authorize');
		await expect(head(page, 'app')).toContainText('App');
		await expect(head(page, 'idp')).toContainText('Identity provider');
		const before = await visibleStepIds(page);

		await words(page).selectOption('specs');
		await expect(head(page, 'app')).toContainText('Client');
		await expect(head(page, 'idp')).toContainText('Authorization');
		await expect(head(page, 'idp')).toContainText('server');
		await expect(head(page, 'api')).toContainText('Resource server');
		await expect(head(page, 'browser')).toContainText('User agent');
		expect(await visibleStepIds(page)).toEqual(before);
		await expect(page).toHaveURL(/say=specs/);

		await page.reload();
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect(head(page, 'app')).toContainText('Client');
		await expect(words(page)).toHaveValue('specs');
	});

	test('goes in what the step says too', async ({ page }) => {
		await open(page, 'mode=advanced&step=token-request');
		await expect(detail(page)).toContainText('The app');
		await words(page).selectOption('specs');
		await expect(detail(page)).toContainText('The client');
		await expect(detail(page)).not.toContainText('The app');
	});

	test('shows what OpenID Connect calls them on the heads, and the text stays as it was', async ({
		page
	}) => {
		await open(page, 'mode=simple&oidc=1&say=specs&step=token-request');
		await expect(head(page, 'app')).toContainText('Relying party');
		await expect(head(page, 'app')).toContainText('Client');
		await expect(head(page, 'idp')).toContainText('OpenID provider');
		await expect(head(page, 'idp')).toContainText('Authorization server');
		await expect(detail(page)).toContainText('The client');
		await expect(detail(page)).not.toContainText('relying party');
	});

	test('leaves no gap before a comma after a word that explains itself', async ({ page }) => {
		await open(page, 'mode=simple&say=specs&step=callback');
		const said = await detail(page).innerText();
		expect(said).toContain('the secret,');
		expect(said).not.toMatch(/\s[,.;:]/);
	});

	test('stays in plain words in advanced mode, until someone chooses, and then stays', async ({
		page
	}) => {
		await open(page, 'mode=simple');
		await expect(words(page)).toHaveCount(0);
		await page.locator('[data-mode="advanced"]').click();
		await expect(words(page)).toHaveValue('plain');
		await expect(head(page, 'app')).toContainText('App');
		await expect(page).not.toHaveURL(/say=/);

		await words(page).selectOption('specs');
		await expect(head(page, 'app')).toContainText('Client');
		await page.locator('[data-mode="simple"]').click();
		await page.locator('[data-mode="advanced"]').click();
		await expect(words(page)).toHaveValue('specs');
	});

	test('in Keycloak’s, the identity provider is the other one', async ({ page }) => {
		await open(page, 'mode=simple&say=keycloak&broker=1&step=authorize');
		await expect(head(page, 'idp')).toContainText('Keycloak');
		await expect(head(page, 'idp')).toContainText('One realm in it');
		await expect(head(page, 'upstream')).toContainText('Identity provider');
		await expect(head(page, 'api')).toContainText('API');
	});

	test('goes with the notes about that server (ADR-015)', async ({ page }) => {
		await open(page, 'mode=advanced&say=keycloak');
		await expect(words(page).locator('option')).toHaveCount(3);
		await open(page, 'mode=advanced&say=keycloak&keycloak=off');
		await expect(words(page).locator('option')).toHaveCount(2);
		await expect(words(page)).toHaveValue('plain');
		await expect(head(page, 'idp')).not.toContainText('Keycloak');
	});

	test('says what else it is called, and where that comes from', async ({ page }) => {
		await open(page, 'mode=simple');
		await head(page, 'app').click();
		const said = page.getByTestId('explanation');
		await expect(said.getByTestId('explanation-also-called')).toContainText('client, in OAuth');
		await expect(said.getByTestId('explanation-also-called')).toContainText(
			'relying party, in OpenID Connect'
		);

		await said.locator('[data-name-source="rfc6749"]').click();
		const panel = page.getByTestId('source-panel');
		await expect(panel).toBeVisible();
		await expect(panel.getByTestId('source-why')).toContainText('four roles');
		await expect(page).toHaveURL(/source=rfc6749/);
		await expect(page).toHaveURL(/section=1\.1/);
		await expect(page).not.toHaveURL(/for=/);

		await page.reload();
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect(page.getByTestId('source-panel')).toBeVisible();
		await page.getByTestId('source-close').click();
		await expect(said.locator('[data-name-source="rfc6749"]')).toBeFocused();
	});

	for (const [word, title] of [
		['relying party', 'Client'],
		['authorization server', 'Identity provider'],
		['resource owner', 'Resource owner'],
		['user agent', 'User agent'],
		['resource server', 'API']
	]) {
		test(`search finds ${word}, which someone will have read in the docs`, async ({ page }) => {
			await open(page, 'mode=simple');
			await page.keyboard.press('/');
			await page.getByTestId('search-input').fill(word);
			await expect(
				page.getByTestId('search').locator('[data-result]').filter({ hasText: title }).first()
			).toBeVisible();
		});
	}

	test('from the specs’ words, it says the plain one as well', async ({ page }) => {
		await open(page, 'mode=advanced&say=specs');
		await head(page, 'app').click();
		await expect(page.getByTestId('explanation').getByRole('heading')).toHaveText('Client');
		await expect(page.getByTestId('explanation-also-called')).toContainText('App, in plain words');
		await expect(page.getByTestId('explanation-also-called')).not.toContainText('client, in');
	});

	for (const [width, height] of [
		[1920, 1080],
		[1280, 720],
		[1024, 768]
	]) {
		for (const wording of ['plain', 'specs', 'keycloak']) {
			for (const settings of ['', 'oidc=1&broker=1&sso=1']) {
				test(`every name fits its head at ${width}x${height}, ${wording} ${settings}`, async ({
					page
				}) => {
					await page.setViewportSize({ width, height });
					await open(page, `mode=simple&say=${wording}&${settings}`);
					const over = await page.locator('.lane-head').evaluateAll((heads) =>
						heads.flatMap((head) => {
							const box = head.querySelector('rect')!.getBBox();
							return [...head.querySelectorAll(':scope > g > text')].flatMap((text) => {
								const line = (text as SVGTextElement).getBBox();
								const fits = line.x >= box.x && line.x + line.width <= box.x + box.width;
								return fits ? [] : [text.textContent];
							});
						})
					);
					expect(over).toEqual([]);
				});
			}
		}
	}

	test('takes one name away and brings the other back', async ({ page }) => {
		await open(page, 'mode=advanced');
		await page.evaluate(() => {
			(window as unknown as { seen: string[] }).seen = [];
			const seen = (window as unknown as { seen: string[] }).seen;
			const heads = document.querySelector('[data-lifeline="app"] .name')!.closest('svg')!;
			new MutationObserver(() => {
				const name = document.querySelector('[data-lifeline="app"] .name')?.textContent;
				if (name && seen.at(-1) !== name) seen.push(name);
			}).observe(heads, { subtree: true, characterData: true, childList: true });
		});
		await words(page).selectOption('specs');
		await expect(head(page, 'app')).toContainText('Client');
		expect(await page.evaluate(() => (window as unknown as { seen: string[] }).seen)).toEqual([
			'Client'
		]);
	});
});
