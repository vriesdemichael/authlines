import { expect, test, type Page } from '@playwright/test';
import { currentSearch, open } from './helpers.ts';

const dialog = (page: Page) => page.getByTestId('explain-dialog');
const explanation = (page: Page) => page.getByTestId('explanation');

const overlap = (a: DOMRect, b: DOMRect) =>
	a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

test.describe('an explanation', () => {
	test('of a word, a party, a setting and a source is the same kind of dialog', async ({
		page
	}) => {
		const opening = [
			'explain=term.issuer',
			'explain=lifeline.idp',
			'explain=setting.oidc',
			'source=rfc6749&for=client&section=2.1'
		];
		for (const search of opening) {
			await open(page, `${search}&step=token-response`);
			await expect(dialog(page), search).toBeVisible();
			await expect(page.locator('dialog[open][data-testid="explain-dialog"]'), search).toHaveCount(
				1
			);
		}
	});

	test('leaves what someone was reading where it is', async ({ page }) => {
		await open(page, 'mode=simple&step=token-response');
		const title = page.locator('aside.detail h2').first();
		const where = await title.boundingBox();
		await page.getByTestId('how-to-read').click();
		await expect(dialog(page)).toBeVisible();
		await expect(page.locator('aside.detail').getByTestId('explanation')).toHaveCount(0);
		expect(await title.boundingBox()).toEqual(where);
	});

	test('closes with Esc and with Back, on the same step', async ({ page }) => {
		await open(page, 'step=token-response');
		await page.locator('[data-lifeline="idp"]').first().click();
		await expect(explanation(page)).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(explanation(page)).toHaveCount(0);
		await expect.poll(() => currentSearch(page)).not.toContain('explain');
		await expect.poll(() => currentSearch(page)).toContain('step=token-response');

		await page.locator('[data-lifeline="idp"]').first().click();
		await expect(explanation(page)).toBeVisible();
		await expect.poll(() => currentSearch(page)).toContain('explain');
		await page.goBack();
		await expect(explanation(page)).toHaveCount(0);
		await expect.poll(() => currentSearch(page)).toContain('step=token-response');
	});

	test('closes with a click beside it', async ({ page }) => {
		await open(page, 'explain=term.issuer');
		await expect(explanation(page)).toBeVisible();
		await page.mouse.click(4, 400);
		await expect(explanation(page)).toHaveCount(0);
	});

	// The maintainer, 2026-11-06: on a question that opens with an explanation, Close and a click beside
	// it seemed to do nothing, because the question's own address opened it again.
	for (const [how, close] of [
		['Close', (page: Page) => page.getByTestId('explain-dialog').getByText('Close').click()],
		['a click beside it', (page: Page) => page.mouse.click(4, 400)]
	] as const) {
		test(`opened by a question, closes with ${how} and stays closed`, async ({ page }) => {
			await page.goto('authorization-code/what-is-an-identity-provider/');
			await page.locator('.workspace[data-ready="true"]').waitFor();
			await expect(explanation(page)).toContainText('Identity provider');
			await close(page);
			await expect(explanation(page)).toHaveCount(0);
			await page.getByTestId('next').click();
			await expect.poll(() => currentSearch(page)).toContain('step=redirect-to-idp');
			await expect(explanation(page)).toHaveCount(0);
			await expect(page.getByTestId('title')).toHaveText(
				'What is an identity provider, and an issuer?'
			);
			await page.reload();
			await page.locator('.workspace[data-ready="true"]').waitFor();
			await expect(explanation(page)).toHaveCount(0);
		});
	}

	test('opens from a link, and a reload keeps it', async ({ page }) => {
		await open(page, 'explain=term.issuer&step=token-response');
		await expect(explanation(page)).toContainText('Issuer');
		await page.reload();
		await page.locator('.workspace[data-ready="true"]').waitFor();
		await expect(explanation(page)).toContainText('Issuer');
	});

	test('hands the focus back to where someone was', async ({ page }) => {
		await open(page, 'step=token-response');
		const why = page.locator('[data-why="oidc"]');
		await why.focus();
		await page.keyboard.press('Enter');
		await expect(explanation(page)).toBeVisible();
		await expect(explanation(page).getByRole('heading', { level: 2 })).toBeFocused();
		await page.keyboard.press('Escape');
		await expect(explanation(page)).toHaveCount(0);
		await expect(why).toBeFocused();
	});

	test('keeps the keys to itself, so stepping does not go on underneath', async ({ page }) => {
		await open(page, 'explain=term.issuer&step=callback');
		await expect(explanation(page)).toBeVisible();
		await page.keyboard.press('ArrowRight');
		await expect.poll(() => currentSearch(page)).toContain('step=callback');
	});

	test('stays clear of a lifeline it is about', async ({ page }) => {
		for (const line of ['browser', 'api']) {
			await open(page, `explain=lifeline.${line}&step=token-response`);
			await expect(explanation(page)).toBeVisible();
			const place = page.locator(`[data-lifeline="${line}"]`).first();
			const [head, box] = await Promise.all([
				place.evaluate((element) => element.getBoundingClientRect().toJSON()),
				dialog(page).evaluate((element) => element.getBoundingClientRect().toJSON())
			]);
			expect(overlap(head, box), line).toBe(false);
		}
	});

	test('stays clear of the arrow a word lights up', async ({ page }) => {
		await open(page, 'explain=term.redirect&step=token-response');
		await expect(explanation(page)).toBeVisible();
		const row = page.locator('.row.lit');
		await expect(row).toHaveCount(1);
		const [arrow, box] = await Promise.all([
			row
				.locator('line')
				.first()
				.evaluate((element) => element.getBoundingClientRect().toJSON()),
			dialog(page).evaluate((element) => element.getBoundingClientRect().toJSON())
		]);
		expect(overlap({ ...arrow, top: arrow.top - 1, bottom: arrow.bottom + 1 }, box)).toBe(false);
	});

	test('offers to show what it is about, when that is not on screen', async ({ page }) => {
		await open(page, 'explain=term.login-required&step=token-response');
		await expect(explanation(page)).toBeVisible();
		const seeIt = page.getByTestId('explanation-see-it');
		await expect(seeIt).toBeVisible();
		await seeIt.click();
		await expect(page.locator('.row.lit')).toHaveCount(1);
		await expect(explanation(page)).toBeVisible();
	});
});

// The maintainer, 2026-11-06: some explanations done in text "could be so much better" as a picture
// in the dialog (#167). The first is what an app does when its token runs out.
test.describe('a picture in an explanation', () => {
	test('has the room, and each part goes to its steps and Back comes back', async ({ page }) => {
		await open(page, 'mode=simple&step=token-response&explain=artifact.refresh-token');
		const picture = page.getByTestId('picture');
		await expect(picture).toBeVisible();
		await expect(picture).toHaveAttribute('data-picture', 'refresh');
		expect((await dialog(page).boundingBox())!.width).toBeGreaterThan(600);

		await picture.locator('[data-part="refreshes"]').click();
		await expect.poll(() => currentSearch(page)).toContain('refresh=1');
		await expect.poll(() => currentSearch(page)).toContain('step=refresh-request');
		await expect(picture).toHaveCount(0);

		await page.goBack();
		await expect(page.getByTestId('picture')).toBeVisible();
		await expect.poll(() => currentSearch(page)).toContain('explain=artifact.refresh-token');
	});

	test('can be gone through by keyboard', async ({ page }) => {
		await open(page, 'mode=simple&step=token-response&explain=setting.refresh');
		const part = page.getByTestId('picture').locator('[data-part="logs-in"]');
		await part.focus();
		await page.keyboard.press('Enter');
		await expect.poll(() => currentSearch(page)).toContain('step=redirect-to-idp');
	});

	// The relation diagram the maintainer asked for, with the app and the API joined (#167).
	test('shows who knows whom on the identity provider, and its rows open their steps', async ({
		page
	}) => {
		await page.goto('authorization-code/what-is-an-identity-provider/');
		await page.locator('.workspace[data-ready="true"]').waitFor();
		const picture = page.getByTestId('picture');
		await expect(picture).toHaveAttribute('data-picture', 'who-knows-whom');
		await expect(picture).toContainText('calls, with an access token');
		await picture.locator('[data-part="idp.apps"]').click();
		await expect.poll(() => currentSearch(page)).toContain('step=create-client');
		await expect(page).toHaveURL(/setup/);
		await page.goBack();
		await expect(page.getByTestId('picture')).toHaveAttribute('data-picture', 'who-knows-whom');
	});

	// The concept pictures of 2026-11-07, each in what explains its concept (#167).
	for (const [search, id, part, lands] of [
		[
			'mode=advanced&explain=setting.broker',
			'trust-across-providers',
			'directory',
			'step=directory-bind'
		],
		['explain=term.issuer', 'how-an-api-trusts-a-token', 'token.exp', 'send=expired'],
		['explain=term.token', 'which-token-is-for-whom', 'session.browser', 'step=redirect-with-code'],
		[
			'mode=advanced&explain=term.session',
			'how-long-each-lasts',
			'right-offline-token',
			'keeps=offline'
		],
		['explain=setting.pkce', 'what-stops-what', 'pkce.handed', 'attacker=1'],
		['explain=setting.appRuns', 'where-the-tokens-are', 'head-bff', 'runs=bff'],
		['mode=advanced&explain=term.oauth', 'what-each-spec-adds', 'dpop', 'binding=dpop'],
		[
			'mode=advanced&explain=term.realm',
			'what-is-in-a-token-here',
			'token.roles',
			'step=api-check-token'
		]
	] as const) {
		test(`${id} opens in its explanation, and a part goes to its steps`, async ({ page }) => {
			await open(page, search.includes('mode=') ? search : `mode=simple&${search}`);
			const picture = page.getByTestId('picture');
			await expect(picture).toHaveAttribute('data-picture', id);
			await picture.locator(`[data-part="${part}"]`).click();
			await expect.poll(() => currentSearch(page)).toContain(lands);
			await expect(page.getByTestId('picture')).toHaveCount(0);
			await page.goBack();
			await expect(page.getByTestId('picture')).toHaveAttribute('data-picture', id);
		});
	}

	// The maintainer decided on 2026-11-08 that simple mode leaves out what is tied to advanced settings.
	test('leaves out in simple mode what advanced mode adds', async ({ page }) => {
		await open(page, 'mode=simple&explain=term.oauth');
		const picture = page.getByTestId('picture');
		await expect(picture).toHaveAttribute('data-picture', 'what-each-spec-adds');
		await expect(picture.locator('[data-part="pkce"]')).toHaveCount(1);
		await expect(picture.locator('[data-part="dpop"]')).toHaveCount(0);
		await open(page, 'mode=advanced&explain=term.oauth');
		await expect(page.getByTestId('picture').locator('[data-part="dpop"]')).toHaveCount(1);
	});

	test('is not in an explanation it does not belong to', async ({ page }) => {
		await open(page, 'mode=simple&step=token-response&explain=artifact.code');
		await expect(explanation(page)).toBeVisible();
		await expect(page.getByTestId('picture')).toHaveCount(0);
		expect((await dialog(page).boundingBox())!.width).toBeLessThan(600);
	});
});

test.describe('a source', () => {
	test('can be read and moved through in the dialog', async ({ page, browserName }) => {
		await open(page, 'source=rfc6749&for=client&section=2.1');
		const text = page.getByTestId('source-text');
		await expect(text).toBeVisible();
		await expect(page.locator('[data-section="2.1"]').locator('b')).toBeInViewport();
		// Once the dialog has been drawn, because WebKit moves it back then and it moves on again.
		await page.waitForTimeout(300);
		await page.getByTestId('source-sections').selectOption('4.1');
		await expect.poll(() => currentSearch(page)).toContain('section=4.1');
		await expect(page.locator('[data-section="4.1"]').locator('b')).toBeInViewport();

		const box = (await dialog(page).boundingBox())!;
		expect(box.height).toBeGreaterThan(500);
		const scrolled = () => dialog(page).evaluate((element) => element.scrollTop);

		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		const before = await scrolled();
		await page.mouse.wheel(0, 600);
		await expect.poll(scrolled).toBeGreaterThan(before);

		// WebKit here does not take these keys from where the focus is. Not tried in Safari itself.
		if (browserName !== 'webkit') {
			const wheeled = await scrolled();
			await page.keyboard.press('PageDown');
			await expect.poll(scrolled).toBeGreaterThan(wheeled);
		}
	});
});
