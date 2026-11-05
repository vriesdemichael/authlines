import { expect, test } from '@playwright/test';
import { watchForErrors } from './helpers.ts';

const SITE = 'https://vriesdemichael.github.io/authlines/';

// Someone should find how to set up their agent, and what they set up should be there (#168).
test.describe('using it with an agent', () => {
	test('is one click from the home screen, and says how to set each agent up', async ({ page }) => {
		const check = watchForErrors(page);
		await page.goto('./');
		await page.getByTestId('agents-link').click();
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Use it with your AI agent');
		const setUp = page.getByTestId('set-up');
		await expect(setUp).toContainText('/plugin marketplace add vriesdemichael/authlines');
		await expect(setUp).toContainText('/plugin install authlines@authlines');
		await expect(setUp).toContainText('~/.agents/skills/');
		await expect(setUp).toContainText(`${SITE}for-agents/index.html.md`);
		check();
	});

	test('is said beside a diagram a link has named', async ({ page }) => {
		await page.goto('authorization-code/#v=1&app=Payroll');
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await page.getByTestId('names-agents').click();
		await expect(page.getByTestId('set-up')).toBeVisible();
	});

	test('serves the skill as a zip, and the reference as Markdown', async ({ page, request }) => {
		await page.goto('for-agents/');
		const zipHref = await page.getByTestId('skill-zip').getAttribute('href');
		const zip = await request.get(new URL(zipHref!, page.url()).href);
		expect(zip.status()).toBe(200);
		// Pages says application/x-zip-compressed, and a browser downloads either.
		expect(['application/x-zip-compressed', 'application/zip']).toContain(
			zip.headers()['content-type']
		);
		expect((await zip.body()).subarray(0, 4).toString('latin1')).toBe('PK\u0003\u0004');

		const markdownHref = await page.getByTestId('reference-md').getAttribute('href');
		const markdown = await request.get(new URL(markdownHref!, page.url()).href);
		expect(markdown.status()).toBe(200);
		expect(await markdown.text()).toMatch(/^# Authlines: links for an AI agent/);
		// The same file, whether it is written relative, as prerendering does, or not, as hydrating does.
		const alternate = await page
			.locator('link[rel="alternate"][type="text/markdown"]')
			.evaluate((link) => (link as HTMLLinkElement).href);
		expect(alternate).toBe(new URL(markdownHref!, page.url()).href);
	});

	test('has an llms.txt whose every link opens', async ({ page, request }) => {
		await page.goto('./');
		const text = await (await request.get(new URL('llms.txt', page.url()).href)).text();
		expect(text).toMatch(/^# Authlines/);
		const links = [...text.matchAll(/\]\((https:[^)]+)\)/g)].map(([, href]) => href);
		expect(links.length).toBeGreaterThanOrEqual(4);
		for (const href of links) {
			expect(href.startsWith(SITE), href).toBe(true);
			const here = new URL(href.slice(SITE.length), page.url()).href;
			expect((await request.get(here)).status(), href).toBe(200);
		}
	});
});

// A link that asks for what does not go together loses some of it, and says so, in either mode (#177).
test.describe('a link that asks for what does not go together', () => {
	test('says what it could not have and why, until a setting changes', async ({ page }) => {
		await page.goto('authorization-code/?oidc=1&client=public&pkce=1&broker=1&upstream=v2');
		await page.locator('.workspace[data-ready="true"]').waitFor();
		const note = page.getByTestId('dropped-note');
		await expect(note).toContainText('Stored upstream tokens: API V2');
		await expect(note).toContainText('confidential client');

		// Stepping moves along what is drawn, so the note stays.
		await page.getByTestId('next').click();
		await expect(page).toHaveURL(/step=/);
		await expect(note).toBeVisible();

		// Changing what is drawn is the answer to it.
		const button = page.getByTestId('settings-toggle');
		if ((await button.isVisible()) && (await button.getAttribute('aria-expanded')) !== 'true') {
			await button.click();
		}
		await page.locator('[data-setting="pkce"] input[type="checkbox"]').uncheck();
		await expect(note).toHaveCount(0);
	});

	test('says nothing when all of it fits', async ({ page }) => {
		await page.goto('authorization-code/?oidc=1&pkce=1&exchange=1');
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect(page.locator('[data-lifeline="second-api"]')).toBeVisible();
		await expect(page.getByTestId('dropped-note')).toHaveCount(0);
	});
});
