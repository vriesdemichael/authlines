import { expect, test, type Page } from '@playwright/test';
import { open } from './helpers.ts';

/** Whether the row for the current step is inside the visible part of the diagram. */
async function currentIsOnScreen(page: Page) {
	return page.locator('[data-state="current"] .hit').evaluate((hit) => {
		const scroller = hit.closest('.scroller')!;
		const row = hit.getBoundingClientRect();
		const view = scroller.getBoundingClientRect();
		return row.top >= view.top - 1 && row.bottom <= view.bottom + 1;
	});
}

const expectOnScreen = (page: Page) => expect.poll(() => currentIsOnScreen(page)).toBe(true);

/** Whether something a setting just changed can be seen, because that is what someone flipped it for. */
const freshIsOnScreen = (page: Page) =>
	page.locator('.scroller').evaluate((scroller) => {
		const view = scroller.getBoundingClientRect();
		return [...scroller.querySelectorAll('.row.fresh .hit')].some((hit) => {
			const row = hit.getBoundingClientRect();
			return row.top >= view.top - 1 && row.bottom <= view.bottom + 1;
		});
	});

test.describe('the current step stays on screen', () => {
	const sizes = [
		{ width: 1440, height: 900 },
		{ width: 1280, height: 720 }
	];

	for (const viewport of sizes) {
		test.describe(`at ${viewport.width} wide`, () => {
			test.use({ viewport });

			test('when a link opens at the last step of a long flow', async ({ page }) => {
				await open(page, 'mode=simple&client=public&attacker=1&step=real-app-refused');
				await expectOnScreen(page);
				await open(page, 'oidc=1&pkce=1&binding=dpop&broker=1&upstream=v1&step=call-upstream');
				await expectOnScreen(page);
			});

			test('at every step of a long flow', async ({ page }) => {
				await open(page, 'oidc=1&pkce=1&binding=dpop&broker=1&upstream=v1');
				const total = await page.locator('[data-step]').count();
				for (let i = 1; i < total; i++) {
					await page.keyboard.press('ArrowRight');
					await expectOnScreen(page);
				}
			});

			test('when a setting pushes it down', async ({ page }) => {
				await open(page, 'step=api-response');
				await expectOnScreen(page);
				await page.locator('[data-setting="oidc"] input').check();
				await expectOnScreen(page);
			});
		});
	}

	test.describe('with the transition playing', () => {
		test.use({
			viewport: { width: 1280, height: 720 },
			contextOptions: { reducedMotion: 'no-preference' }
		});

		test('and once it has finished', async ({ page }) => {
			await open(page, 'step=api-response');
			await page.locator('[data-setting="broker"] input').check();
			await expect(page.getByTestId('diagram')).toHaveAttribute('data-animating', 'false');
			await expect.poll(() => freshIsOnScreen(page)).toBe(true);
			await page.getByTestId('back').click();
			await expectOnScreen(page);
		});
	});

	test('when the window gets smaller', async ({ page }) => {
		await open(page, 'step=api-response');
		await page.setViewportSize({ width: 1280, height: 620 });
		await expectOnScreen(page);
	});

	test('but someone can still scroll away from it', async ({ page }) => {
		await open(page, 'oidc=1&pkce=1&binding=dpop&broker=1&upstream=v1&step=call-upstream');
		await page.locator('.scroller').evaluate((scroller) => (scroller.scrollTop = 0));
		await page.waitForTimeout(100);
		expect(await currentIsOnScreen(page)).toBe(false);
	});
});

test.describe('what a setting adds', () => {
	const isOnScreen = (page: Page, step: string) =>
		page.locator(`[data-step="${step}"] .hit`).evaluate((hit) => {
			const row = hit.getBoundingClientRect();
			const view = hit.closest('.scroller')!.getBoundingClientRect();
			return row.top >= view.top - 1 && row.bottom <= view.bottom + 1;
		});
	const flipPkceAtTheAttacker = async (page: Page) => {
		await open(page, 'mode=simple&client=public&attacker=1&step=attacker-token-response');
		await page.locator('[data-setting="pkce"] input').check();
	};

	// The transition is the moment the idea lands or does not (premise 5.2), so it has to be in view.
	test.describe('from the first step, on a small laptop', () => {
		test.use({ viewport: { width: 1280, height: 720 } });

		for (const setting of ['oidc', 'consent', 'pkce', 'attacker', 'broker']) {
			test(`${setting} is on screen when it is flipped`, async ({ page }) => {
				await open(page, 'mode=simple');
				await page.locator(`[data-setting="${setting}"] input`).check();
				await expect.poll(() => freshIsOnScreen(page)).toBe(true);
			});
		}

		test('a choice that changes messages is on screen too', async ({ page }) => {
			await open(page, 'mode=simple');
			await page.locator('[data-setting="appRuns"] input[value="page"]').check();
			await expect.poll(() => freshIsOnScreen(page)).toBe(true);
		});

		test('pointing at a switch moves nothing', async ({ page }) => {
			await open(page, 'mode=simple');
			await page.locator('[data-setting="oidc"] label').hover();
			await page.waitForTimeout(300);
			expect(await page.locator('.scroller').evaluate((scroller) => scroller.scrollTop)).toBe(0);
		});
	});

	test.describe('on a tall screen', () => {
		test.use({ viewport: { width: 1440, height: 1000 } });

		test('is on screen together with the current step', async ({ page }) => {
			await flipPkceAtTheAttacker(page);
			await expectOnScreen(page);
			await expect.poll(() => isOnScreen(page, 'make-verifier')).toBe(true);
		});
	});

	test.describe('on a laptop', () => {
		test.use({ viewport: { width: 1366, height: 768 } });

		test('goes first, and the next step brings back where someone was', async ({ page }) => {
			await flipPkceAtTheAttacker(page);
			await expect.poll(() => isOnScreen(page, 'make-verifier')).toBe(true);
			await expect(page.locator('[data-state="current"]')).toHaveAttribute(
				'data-step',
				'attacker-token-response'
			);
			await page.getByTestId('next').click();
			await expectOnScreen(page);
		});
	});
});

test.describe('the text in the diagram', () => {
	test.use({ viewport: { width: 1280, height: 720 } });

	/** The size it comes out on screen, because the diagram scales with its width. */
	const shownSize = (page: Page, selector: string) =>
		page
			.locator(selector)
			.first()
			.evaluate((text) => {
				const svg = (text as SVGElement).ownerSVGElement!;
				const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
				return parseFloat(getComputedStyle(text).fontSize) * scale;
			});

	test('can be read on a laptop', async ({ page }) => {
		await open(page, 'mode=simple&oidc=1&step=token-response');
		expect(await shownSize(page, '.row .label')).toBeGreaterThanOrEqual(10.4);
		expect(await shownSize(page, '.lane-head .name')).toBeGreaterThanOrEqual(10.8);
		expect(await shownSize(page, '.chip text')).toBeGreaterThanOrEqual(9.2);
		expect(await shownSize(page, '.held text')).toBeGreaterThanOrEqual(8.4);
	});
});

test.describe('the keys', () => {
	const stepAt = (page: Page) => page.locator('[data-state="current"]');

	test('still work after clicking a switch', async ({ page }) => {
		await open(page, 'step=authorize');
		await page.locator('[data-setting="oidc"] input').check();
		await expect(page.locator('[data-setting="oidc"] input')).toBeFocused();
		await page.keyboard.press('ArrowRight');
		await expect(stepAt(page)).toHaveAttribute('data-step', 'login-page');
		await page.keyboard.press('ArrowLeft');
		await expect(stepAt(page)).toHaveAttribute('data-step', 'authorize');
	});

	test('leave a choice to choose between', async ({ page }) => {
		await open(page, 'step=authorize');
		await page.locator('[data-setting="clientType"] input[value="confidential"]').focus();
		await page.keyboard.press('ArrowRight');
		await expect(stepAt(page)).toHaveAttribute('data-step', 'authorize');
	});

	test('go to the first and the last step', async ({ page }) => {
		await open(page, 'step=authorize');
		await page.keyboard.press('End');
		await expect(stepAt(page)).toHaveAttribute('data-step', 'api-response');
		await page.keyboard.press('Home');
		await expect(stepAt(page)).toHaveAttribute('data-step', 'open-app');
	});
});

test.describe('a setting that does not fit with another', () => {
	test('stays there and says why', async ({ page }) => {
		await open(page, 'mode=simple&binding=dpop');
		const attacker = page.locator('[data-setting="attacker"]');
		await expect(attacker).toBeVisible();
		await expect(attacker.locator('input')).toBeDisabled();
		await expect(attacker.getByTestId('blocked-because')).toContainText('plain case');
	});

	test('can be turned on again once it fits', async ({ page }) => {
		await open(page, 'broker=1');
		const attacker = page.locator('[data-setting="attacker"] input');
		await expect(attacker).toBeDisabled();
		await page.locator('[data-setting="broker"] input').uncheck();
		await expect(attacker).toBeEnabled();
	});

	test('one that needs another first only appears when it can be used', async ({ page }) => {
		await open(page);
		await expect(page.locator('[data-setting="dpopNonce"]')).toHaveCount(0);
		await page.locator('[data-setting="binding"] input[value="dpop"]').check();
		await expect(page.locator('[data-setting="dpopNonce"]')).toBeVisible();
	});
});

test.describe('in simple mode on the setup', () => {
	test('offers what changes something you can see, and says where the rest are', async ({
		page
	}) => {
		await open(page, 'mode=simple', 'setup');
		await expect(page.locator('[data-setting]')).toHaveCount(2);
		await expect(page.locator('[data-setting="broker"]')).toBeVisible();
		// With no secret there is nothing to hand over.
		await expect(page.locator('[data-setting="appRuns"]')).toBeVisible();
		const elsewhere = page.getByTestId('settings-elsewhere');
		await expect(elsewhere).toContainText('The others change the user flow, not this diagram.');
		await elsewhere.locator('a').click();
		await expect(page.locator('.workspace')).toHaveAttribute('data-diagram', 'flow');
		await expect(page.locator('[data-setting]')).toHaveCount(6);
		await expect(page.getByTestId('settings-elsewhere')).toHaveCount(0);
	});

	test('still offers everything on the user flow, even when one changes nothing just now', async ({
		page
	}) => {
		await open(page, 'mode=simple&client=public&attacker=1&step=real-app-refused');
		await expect(page.locator('[data-setting="oidc"]')).toBeVisible();
		await expect(page.getByTestId('settings-elsewhere')).toHaveCount(0);
	});

	test('keeps one that is on, so it can be turned off', async ({ page }) => {
		await open(page, 'mode=simple&pkce=1', 'setup');
		await expect(page.locator('[data-setting="pkce"] input')).toBeChecked();
	});
});

test.describe('what changed', () => {
	test('says what, before it says why', async ({ page }) => {
		await open(page, 'mode=simple');
		await page.locator('[data-setting="pkce"] input').check();
		const box = page.getByTestId('change-summary');
		const text = await box.innerText();
		expect(text.indexOf('steps added')).toBeGreaterThan(-1);
		expect(text.indexOf('steps added')).toBeLessThan(text.indexOf('The code goes through'));
	});
});

test.describe('the chips under a name', () => {
	test('explain themselves, not the name', async ({ page }) => {
		await open(page, 'mode=simple&step=api-response');
		await page.locator('[data-held="app:access-token"]').click();
		await expect(page.getByTestId('explanation')).toContainText('What the app shows an API');
	});

	test('do not say the browser has the password until it does', async ({ page }) => {
		await open(page, 'mode=simple');
		await expect(page.locator('[data-held="browser:password"]')).toHaveCount(0);
		await open(page, 'mode=simple&step=submit-credentials');
		await expect(page.locator('[data-held="browser:password"]')).toBeVisible();
	});
});
