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
		await expect(page.locator('link[rel="alternate"][type="text/markdown"]')).toHaveAttribute(
			'href',
			markdownHref!
		);
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
