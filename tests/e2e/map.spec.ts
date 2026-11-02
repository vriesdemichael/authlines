import { expect, test, type Page } from '@playwright/test';
import { flows } from '../../src/lib/flow/index.ts';
import { mapNodes, nodeSearch, nodeState, nodeView } from '../../src/lib/map/nodes.ts';
import {
	expectMatchesModel,
	FLOW_PATH,
	onTheMap,
	open,
	visibleStepIds,
	watchForErrors
} from './helpers.ts';

/** A click before the page has hydrated is a full page load, which is not what this is testing. */
async function openMap(page: Page) {
	await page.goto('./');
	await page.locator('main[data-ready="true"]').waitFor();
}

const nodeLink = (page: Page, id: string) => page.getByTestId(`node-${id}`);
const pathOf = (id: string) => `${mapNodes.find((node) => node.id === id)?.flow}/${id}/`;

// Literal on purpose. These addresses are public once shipped, and must keep opening the same state
// (ADR-003), so a change that breaks one has to show up here and not pass through a helper.
const STABLE_NODES = [
	{ id: 'how-access-works', step: 'open-app', stepCount: 12, mode: 'simple' },
	{ id: 'who-logged-in', step: 'token-response', stepCount: 15, mode: 'simple' },
	{ id: 'getting-to-know-each-other', step: 'register-client', stepCount: 9, mode: 'simple' },
	{ id: 'stolen-code', step: 'attacker-steals-code', stepCount: 14, mode: 'simple' },
	{ id: 'pkce', step: 'make-verifier', stepCount: 14, mode: 'simple' },
	{ id: 'redirect-uri-error', step: 'authorize', stepCount: 12, mode: 'simple' }
];

test.describe('the map', () => {
	test('is the home page, with every node as a link', async ({ page }) => {
		const check = watchForErrors(page);
		await page.goto('./');
		await expect(page.getByTestId('map')).toBeVisible();
		for (const node of mapNodes) {
			await expect(nodeLink(page, node.id)).toHaveAttribute('href', new RegExp(`${node.id}/?$`));
			await expect(nodeLink(page, node.id)).toContainText(node.title);
		}
		check();
	});

	test('can be read as lists and headings by someone who cannot see the lines', async ({
		page
	}) => {
		await page.goto('./');
		await expect(page.getByRole('heading', { level: 2, name: 'Start here' })).toBeVisible();
		await expect(page.getByTestId('map').locator('a')).toHaveCount(mapNodes.length);
	});

	test('works from the keyboard', async ({ page }) => {
		await page.goto('./');
		await page.keyboard.press('Tab');
		await expect(page.getByTestId('open-search')).toBeFocused();
		await page.keyboard.press('Tab');
		await expect(page.locator('.track summary').first()).toBeFocused();
		await nodeLink(page, mapNodes[0].id).focus();
		await page.keyboard.press('Enter');
		await expect(page).toHaveURL(new RegExp(`${mapNodes[0].id}/$`));
		await page.locator('.workspace[data-ready="true"]').waitFor();
	});

	test('shows no planned nodes, because every one has to open', async ({ page }) => {
		await page.goto('./');
		await expect(page.locator('[aria-disabled="true"]')).toHaveCount(0);
	});
});

test.describe('every node', () => {
	for (const node of mapNodes) {
		test(`${node.id} opens the application at its exact state`, async ({ page }) => {
			const check = watchForErrors(page);
			await openMap(page);
			await (await onTheMap(page, node.id)).click();
			await page.locator('.workspace[data-ready="true"]').waitFor();
			await expectMatchesModel(page, nodeSearch(node), node.diagram, flows[node.flow]);
			await expect(page.locator(`[data-mode="${node.mode}"]`)).toHaveAttribute(
				'aria-pressed',
				'true'
			);
			check();
		});

		test(`${node.id} is prerendered, with the diagram there without JavaScript`, async ({
			browser
		}) => {
			const context = await browser.newContext({ javaScriptEnabled: false });
			const page = await context.newPage();
			await page.goto(pathOf(node.id));
			await expect(page).toHaveTitle(node.title);
			await expect(page.locator('meta[name="description"]')).toHaveAttribute(
				'content',
				node.answer
			);
			expect(await visibleStepIds(page)).toEqual(nodeView(node).steps.map((step) => step.id));
			await expect(page.locator('[data-state="current"]')).toHaveAttribute(
				'data-step',
				nodeState(node).step
			);
			await context.close();
		});

		test(`${node.id} says where you are when you go back to the map`, async ({ page }) => {
			await page.goto(pathOf(node.id));
			await page.locator('.workspace[data-ready="true"]').waitFor();
			await page.getByRole('link', { name: 'Map' }).click();
			await expect(nodeLink(page, node.id)).toHaveAttribute('aria-current', 'location');
			await expect(page.locator('[aria-current="location"]')).toHaveCount(1);
		});
	}
});

test.describe('the address of a node', () => {
	test('that used to say advanced mode still says it', async ({ page }) => {
		await page.goto(`${pathOf('why-401')}?mode=advanced`);
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect(page.locator('[data-mode="advanced"]')).toHaveAttribute('aria-pressed', 'true');
		await expect(page.locator('[data-state="current"]')).toHaveAttribute(
			'data-step',
			'api-response'
		);
	});

	for (const { id, step, stepCount, mode } of STABLE_NODES) {
		test(`${id} keeps opening the same state`, async ({ page }) => {
			await page.goto(pathOf(id));
			await page.locator('.workspace[data-ready="true"]').waitFor();
			await expect(page.locator('[data-step]')).toHaveCount(stepCount);
			await expect(page.locator('[data-state="current"]')).toHaveAttribute('data-step', step);
			await expect(page.locator(`[data-mode="${mode}"]`)).toHaveAttribute('aria-pressed', 'true');
		});
	}

	test('that does not exist gets the 404 page', async ({ page }) => {
		const response = await page.goto('authorization-code/no-such-node/');
		expect(response?.status()).toBe(404);
	});

	test('takes a query on top of it', async ({ page }) => {
		await page.goto(`${pathOf('how-access-works')}?step=callback`);
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect(page.locator('[data-state="current"]')).toHaveAttribute('data-step', 'callback');
	});
});

test.describe('leaving a node', () => {
	test('stepping keeps the address of the question, and says exactly where you are', async ({
		page
	}) => {
		await page.goto(pathOf('stolen-code'));
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await page.getByTestId('next').click();
		await expect(page).toHaveURL(
			/authorization-code\/stolen-code\/\?.*step=attacker-token-request/
		);
		await page.reload();
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect(page.locator('[data-state="current"]')).toHaveAttribute(
			'data-step',
			'attacker-token-request'
		);
		await expect(page.getByTestId('title')).toHaveText('What if someone steals the code?');
	});

	test('flipping a setting by hand has an address, with or without a node', async ({ page }) => {
		await page.goto(pathOf('how-access-works'));
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await page.locator('[data-setting="oidc"] input').check();
		await expect(page).toHaveURL(/authorization-code\/\?oidc=1/);
		await expectMatchesModel(page, 'oidc=1');
	});

	test('still animates from where it was, because it is the same screen', async ({ page }) => {
		await page.goto(pathOf('how-access-works'));
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await page.locator('[data-step="token-request"]').evaluate((row) => {
			row.setAttribute('data-kept', 'yes');
		});
		await page.locator('[data-setting="oidc"] input').check();
		await expect(page.locator('[data-step="token-request"]')).toHaveAttribute('data-kept', 'yes');
	});

	test('Back returns to the node', async ({ page }) => {
		await page.goto(pathOf('how-access-works'));
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await page.locator('[data-setting="oidc"] input').check();
		await expect(page).toHaveURL(/oidc=1/);
		await page.goBack();
		await expect(page).toHaveURL(/how-access-works\/$/);
		await expectMatchesModel(page, '');
	});
});

test.describe('the way back', () => {
	test('is one click from the application screen', async ({ page }) => {
		await open(page, 'oidc=1&step=token-response');
		await page.getByRole('link', { name: 'Map' }).click();
		await expect(page.getByTestId('map')).toBeVisible();
	});

	test('marks no node for a state that has none', async ({ page }) => {
		await page.goto(`${FLOW_PATH}?oidc=1&binding=dpop`);
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await page.getByRole('link', { name: 'Map' }).click();
		await expect(page.getByTestId('map')).toBeVisible();
		await expect(page.locator('[aria-current="location"]')).toHaveCount(0);
	});

	test('marks the node when someone reaches its state by hand', async ({ page }) => {
		await page.goto(FLOW_PATH);
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await page.locator('[data-setting="oidc"] input').check();
		await expect(page).toHaveURL(/oidc=1/);
		await page.getByRole('link', { name: 'Map' }).click();
		await expect(nodeLink(page, 'who-logged-in')).toHaveAttribute('aria-current', 'location');
	});
});
