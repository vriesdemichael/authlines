import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_WORDING, sayer } from '../../src/lib/flow/wording.ts';
import { mapNodes } from '../../src/lib/map/nodes.ts';
import { open } from './helpers.ts';

const openNode = async (page: Page, id: string) => {
	await page.goto(`${node(id).flow}/${id}/`);
	await page.locator('.workspace[data-ready="true"]').waitFor();
};
const node = (id: string) => mapNodes.find((candidate) => candidate.id === id)!;
const answer = (page: Page) => page.getByTestId('answer');
const current = (page: Page) => page.locator('[data-state="current"]');

test.describe('a question', () => {
	for (const each of mapNodes) {
		test(`${each.id} says its answer straight away`, async ({ page }) => {
			await openNode(page, each.id);
			await expect(answer(page)).toContainText(sayer(DEFAULT_WORDING)(each.answer));
		});
	}

	test('has it in the page and when shared, before anything runs', () => {
		const html = readFileSync('build/authorization-code/who-logged-in/index.html', 'utf8');
		const said = node('who-logged-in').answer;
		expect(html).toContain(said);
		expect(html).toMatch(new RegExp(`og:description[^>]*${said.slice(0, 30)}`));
	});

	test('opens where the answer can be seen', async ({ page }) => {
		await openNode(page, 'who-logged-in');
		await expect(current(page)).toHaveAttribute('data-step', 'token-response');
		await openNode(page, 'another-provider');
		await expect(current(page)).toHaveAttribute('data-step', 'redirect-to-upstream');
	});

	test('keeps its answer while stepping', async ({ page }) => {
		await openNode(page, 'stolen-code');
		await page.getByTestId('next').click();
		await expect(answer(page)).toContainText(node('stolen-code').answer);
	});

	test('offers to show how it got here, and that works', async ({ page }) => {
		await openNode(page, 'who-logged-in');
		await page.getByTestId('how-we-got-here').click();
		await expect(page.getByTestId('position')).toContainText('Step 1 of');
		await expect(page.getByTestId('how-we-got-here')).toHaveCount(0);
		await page.getByTestId('next').click();
		await expect(page.getByTestId('position')).toContainText('Step 2 of');
		await expect(answer(page)).toBeVisible();
	});

	test('does not offer that where it already starts', async ({ page }) => {
		await openNode(page, 'how-access-works');
		await expect(answer(page)).toBeVisible();
		await expect(page.getByTestId('how-we-got-here')).toHaveCount(0);
	});

	test('is not on a state nobody asked about', async ({ page }) => {
		await open(page, 'mode=simple');
		await expect(answer(page)).toHaveCount(0);
		await expect(page.getByTestId('intro')).toBeVisible();
	});
});

test.describe('flipping a switch while on a question', () => {
	const flip = (page: Page) => page.getByRole('checkbox', { name: /Ask the user to agree/ });

	test('keeps a way back to it', async ({ page }) => {
		await openNode(page, 'how-access-works');
		await flip(page).click();
		const from = page.getByTestId('from-question');
		await expect(from).toContainText('How does an app get access?');
		await expect(answer(page)).toHaveCount(0);
		await from.click();
		await expect(page.getByTestId('title')).toHaveText('How does an app get access?');
		await expect(answer(page)).toBeVisible();
		await expect(flip(page)).not.toBeChecked();
	});

	test('comes back through Back as well', async ({ page }) => {
		await openNode(page, 'how-access-works');
		await flip(page).click();
		await expect(page.getByTestId('from-question')).toBeVisible();
		await page.goBack();
		await expect(page.getByTestId('title')).toHaveText('How does an app get access?');
		await expect(page.getByTestId('from-question')).toHaveCount(0);
	});

	test('says nothing when nobody came with a question', async ({ page }) => {
		await open(page, 'mode=simple');
		await flip(page).click();
		await expect(page.getByTestId('from-question')).toHaveCount(0);
	});
});

test.describe('the map', () => {
	test('only marks a question in the mode someone is in', async ({ page }) => {
		await open(page, 'mode=simple&step=token-request');
		await page.getByRole('link', { name: 'Map' }).click();
		await expect(page.getByTestId('node-on-the-wire')).not.toHaveAttribute(
			'aria-current',
			'location'
		);
	});
});
