import { expect, test, type Page } from '@playwright/test';
import { mapNodes, nextQuestion, nodeView } from '../../src/lib/map/nodes.ts';
import { open } from './helpers.ts';

const node = (id: string) => mapNodes.find((candidate) => candidate.id === id)!;
const title = (page: Page) => page.getByTestId('title');

async function openNode(page: Page, id: string, search = '') {
	await page.goto(`authorization-code/${id}/${search}`);
	await page.locator('.workspace[data-ready="true"]').waitFor();
}

test.describe('the question someone came with', () => {
	test('stays on screen', async ({ page }) => {
		await openNode(page, 'how-access-works');
		await expect(title(page)).toHaveText('How does an app get access?');
		await page.getByTestId('next').click();
		await expect(title(page)).toHaveText('How does an app get access?');
	});

	test('stays when moving on, and is not taken for another with the same settings', async ({
		page
	}) => {
		await openNode(page, 'what-is-in-my-token');
		await page.getByTestId('next').click();
		await expect(title(page)).toHaveText('Why does my access token say that?');
	});

	test('stays when switching mode, because the flow on screen is the same', async ({ page }) => {
		await openNode(page, 'how-access-works');
		await page.locator('[data-mode="advanced"]').click();
		await expect(title(page)).toHaveText('How does an app get access?');
	});

	test('goes when a setting means it is no longer what is on screen', async ({ page }) => {
		await openNode(page, 'how-access-works');
		await page.locator('[data-setting="oidc"] input').check();
		await expect(title(page)).toHaveText('Authorization code flow');
	});

	test('is marked on the map on the way back', async ({ page }) => {
		await openNode(page, 'what-is-in-my-token');
		await page.getByTestId('next').click();
		await page.getByRole('link', { name: 'Map', exact: true }).click();
		const marked = page.getByTestId('node-what-is-in-my-token');
		await expect(marked).toHaveAttribute('aria-current', 'location');
		await expect(marked).toBeInViewport();
	});

	test('survives a reload, and being stepped back to where it started', async ({ page }) => {
		await openNode(page, 'pkce');
		await page.getByTestId('next').click();
		await expect(page).toHaveURL(/step=redirect-to-idp/);
		await page.reload();
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect(title(page)).toHaveText('How does PKCE work?');
		await page.keyboard.press('Home');
		await expect(page).toHaveURL(/step=open-app/);
		await page.reload();
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect(page.locator('[data-state="current"]')).toHaveAttribute('data-step', 'open-app');
	});

	test('survives switching mode and reloading, whichever mode it opens in', async ({ page }) => {
		await openNode(page, 'redirect-uri-error');
		await page.locator('[data-mode="simple"]').click();
		await expect(page).toHaveURL(/mode=simple/);
		await page.reload();
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect(page.locator('[data-mode="simple"]')).toHaveAttribute('aria-pressed', 'true');
		await expect(title(page)).toHaveText('Why do I get Invalid parameter: redirect_uri?');
	});

	test('is not made up for a link that did not come from the map', async ({ page }) => {
		await open(page, 'mode=simple');
		await expect(title(page)).toHaveText('Authorization code flow');
	});
});

test.describe('at the end of the setup', () => {
	test('the way on is the flow it was for', async ({ page }) => {
		await page.goto('authorization-code/adding-login/');
		await expect(page.getByTestId('workspace')).toHaveAttribute('data-ready', 'true');
		await page.keyboard.press('End');
		await expect(page.getByTestId('next-question')).toHaveText('On to the user flow');
		await page.getByTestId('next-question').click();
		await expect(page.getByTestId('workspace')).toHaveAttribute('data-diagram', 'flow');
		await expect(page).toHaveURL(/oidc=1/);
		await expect(page.getByTestId('from-question')).toContainText('I have to add login');
	});
});

test.describe('the end of a flow', () => {
	test('says where to go next, and goes there', async ({ page }) => {
		await openNode(page, 'how-access-works');
		const next = nextQuestion(node('how-access-works'))!;
		expect(next.id).toBe('why-a-code');
		await page.keyboard.press('End');
		await expect(page.getByTestId('onward')).toContainText(next.title);
		await page.getByTestId('next-question').click();
		await expect(title(page)).toHaveText(next.title);
		await expect(page).toHaveURL(new RegExp(`${next.id}/$`));
		await expect(page.locator('[data-step]')).toHaveCount(nodeView(next).steps.length);
	});

	test('does not get in the way before the end', async ({ page }) => {
		await openNode(page, 'how-access-works');
		await expect(page.getByTestId('onward')).toHaveCount(0);
		await expect(page.getByTestId('next-question')).toHaveCount(0);
		await expect(page.getByTestId('next')).toBeEnabled();
	});

	test('points back to the map when there is no next question', async ({ page }) => {
		await open(page, 'mode=simple&step=api-response');
		await expect(page.getByTestId('onward')).toHaveCount(0);
		await expect(page.getByTestId('next')).toBeDisabled();
		await page.getByTestId('onward-map').click();
		await expect(page.getByTestId('map')).toBeVisible();
	});
});

test.describe('what is on every step', () => {
	test('says how a message travels when that changes, and not on every step', async ({ page }) => {
		await open(page, 'mode=advanced');
		await expect(page.getByTestId('channel-why')).toBeVisible();
		await page.keyboard.press('ArrowRight');
		await expect(page.getByTestId('step-channel')).toContainText('Through the browser');
		await expect(page.getByTestId('channel-why')).toHaveCount(0);
		await open(page, 'mode=advanced&step=token-request');
		await expect(page.getByTestId('step-channel')).toContainText('Direct');
		await expect(page.getByTestId('channel-why')).toBeVisible();
	});

	test('does not repeat itself under the title', async ({ page }) => {
		await open(page, 'oidc=1&step=token-response');
		await expect(page.getByTestId('step-detail').locator('.plain')).toHaveCount(0);
		await open(page, 'step=token-request');
		await expect(page.getByTestId('step-detail').locator('.plain')).toHaveText(
			'The app trades the code for tokens'
		);
	});

	test('does not name specs to someone new', async ({ page }) => {
		await open(page, 'mode=simple');
		await expect(page.getByTestId('provenance')).toHaveCount(0);
		await expect(page.locator('main')).not.toContainText('RFC');
	});
});

test.describe('someone told to add login', () => {
	test('finds their question on the map, and it starts with what they have to do', async ({
		page
	}) => {
		await page.goto('./');
		await page.locator('main[data-ready="true"]').waitFor();
		await page.getByTestId('node-adding-login').click();
		await expect(title(page)).toHaveText('I have to add login to an app. What do I do?');
		await expect(page.locator('.workspace')).toHaveAttribute('data-diagram', 'setup');
		await expect(page.locator('[data-lifeline="app-team"]')).toContainText('You');
		await expect(page.getByTestId('step-practice')).toContainText('each new address');
	});

	test('is told which part is theirs and which a library does', async ({ page }) => {
		await open(page, 'mode=simple&step=configure-app', 'setup');
		await expect(page.getByTestId('step-practice')).toContainText(
			'most of what you write for a login'
		);
		await open(page, 'mode=simple&step=token-request');
		await expect(page.getByTestId('step-practice')).toContainText('A library does this');
		await expect(page.getByTestId('step-practice')).toContainText('out of your code');
		await open(page, 'mode=simple&client=public&pkce=1&step=token-request');
		await expect(page.getByTestId('step-practice')).toContainText('no secret to keep');
		await open(page, 'mode=simple&step=api-request');
		await expect(page.getByTestId('step-practice')).toContainText('your code');
	});

	test('is told which setting is login', async ({ page }) => {
		await open(page, 'mode=simple');
		await expect(page.locator('[data-setting="oidc"]')).toContainText('If you are adding login');
		await expect(page.getByTestId('intro')).toContainText('OpenID Connect adds who the user is');
	});

	test('is not told about their app on a step that has nothing to do with it', async ({ page }) => {
		await open(page, 'mode=simple&step=login-page');
		await expect(page.getByTestId('step-practice')).toHaveCount(0);
	});
});

test.describe('someone who asks why not just send the token', () => {
	test('has that question, and gets the answer at the step that matters', async ({ page }) => {
		await openNode(page, 'why-a-code');
		await expect(page.locator('[data-state="current"]')).toHaveAttribute(
			'data-step',
			'redirect-with-code'
		);
		await expect(page.getByTestId('step-detail')).toContainText('so it should not be a token');
		const pitfall = page.getByTestId('step-pitfall');
		await pitfall.locator('summary').click();
		await expect(pitfall).toContainText('implicit flow');
	});
});

test.describe('a token', () => {
	test('says which setting put what in it', async ({ page }) => {
		await openNode(page, 'what-is-in-my-token');
		await page.getByTestId('jwt').first().locator('summary').click();
		const settings = page.getByTestId('token-settings');
		await expect(settings).toContainText('aud');
		await expect(settings).toContainText('Audience mapper');
		await expect(settings).toContainText('Client scopes');
		await expect(settings).toContainText('Access Token Lifespan');
	});

	test('opens the note about one of them', async ({ page }) => {
		await openNode(page, 'what-is-in-my-token');
		await page.getByTestId('jwt').first().locator('summary').click();
		const note = page.locator('[data-note="audience"]');
		await expect(note).not.toHaveAttribute('open');
		await page.locator('[data-open-note="audience"]').click();
		await expect(note).toHaveAttribute('open');
		await expect(note).toContainText('accept account');
	});

	test('says nothing about one server when server notes are off', async ({ page }) => {
		await open(page, 'keycloak=off&step=token-response');
		await page.getByTestId('jwt').first().locator('summary').click();
		await expect(page.getByTestId('token-settings')).toHaveCount(0);
	});
});

test.describe('the map', () => {
	test('says which questions open in advanced mode, in those words', async ({ page }) => {
		await page.goto('./');
		await expect(page.getByTestId('node-on-the-wire')).toContainText('Advanced');
		await expect(page.getByTestId('node-how-access-works')).not.toContainText('Advanced');
	});
});
