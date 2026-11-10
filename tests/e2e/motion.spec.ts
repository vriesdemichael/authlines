import { expect, test, type Page } from '@playwright/test';
import { open, watchForErrors } from './helpers.ts';

// The other tests run with reduced motion, which hides everything in this file.
test.use({ contextOptions: { reducedMotion: 'no-preference' } });

const diagram = (page: Page) => page.getByTestId('diagram');

/** Counts the diagram starting to animate, from inside the page, so a fast one cannot be missed. */
async function watchAnimating(page: Page) {
	const seen = await diagram(page).evaluateHandle((element) => {
		const counted = { times: 0 };
		new MutationObserver(() => {
			if (element.getAttribute('data-animating') === 'true') counted.times++;
		}).observe(element, { attributes: true, attributeFilter: ['data-animating'] });
		return counted;
	});
	return () => seen.evaluate((counted) => counted.times);
}

test.describe('stepping', () => {
	test('does not play the transition, in either direction', async ({ page }) => {
		await open(page, 'step=authorize');
		const times = await watchAnimating(page);
		await page.getByTestId('next').click();
		await page.getByTestId('next').click();
		await page.getByTestId('back').click();
		await page.keyboard.press('ArrowRight');
		await expect(page.getByTestId('position')).toContainText('Step 5');
		expect(await times()).toBe(0);
	});

	test('leaves a hand scroll alone while the step stays in view', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 620 });
		await open(page, 'step=authorize');
		const scroller = page.locator('.scroller');
		const scrollTo = (top: number) =>
			scroller.evaluate((element, value) => {
				element.scrollTop = value;
			}, top);
		const scrolled = () => scroller.evaluate((element) => element.scrollTop);
		await scrollTo(40);
		await page.getByTestId('next').click();
		await expect(page.getByTestId('position')).toContainText('Step 4');
		expect(await scrolled()).toBe(40);
	});

	test('still brings a step into view when it would leave', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 620 });
		await open(page, 'oidc=1');
		await page.keyboard.press('End');
		await expect(page.locator('[data-state="current"] .hit')).toBeInViewport();
	});
});

test.describe('sending a message', () => {
	const marker = (page: Page) => page.locator('.packet');
	const opacity = (locator: ReturnType<Page['locator']>) =>
		locator.evaluate((element) => Number(getComputedStyle(element).opacity));

	test('Next moves one marker, along the arrow it is on', async ({ page }) => {
		await open(page, 'step=authorize');
		await page.getByTestId('next').click();
		await expect(marker(page)).toHaveCount(1);
		await expect(page.locator('[data-state="current"] .packet')).toHaveCount(1);
	});

	test('Back and a jump move nothing', async ({ page }) => {
		await open(page, 'step=authorize');
		await page.getByTestId('next').click();
		await expect(marker(page)).toHaveCount(1);
		await page.getByTestId('back').click();
		await expect(page.getByTestId('position')).toContainText('Step 3');
		await expect(marker(page)).toHaveCount(0);
		await page.locator('[data-step="token-request"]').click();
		await expect(page.getByTestId('position')).toContainText('Step 8');
		await expect(marker(page)).toHaveCount(0);
		await page.getByTestId('timeline').locator('[data-tick="callback"]').click();
		await expect(page.getByTestId('position')).toContainText('Step 7');
		await expect(marker(page)).toHaveCount(0);
	});

	test('nothing moves on arriving, flipping a setting, or a step that sends nothing', async ({
		page
	}) => {
		await open(page, 'pkce=1&step=open-app');
		await expect(marker(page)).toHaveCount(0);
		await page.getByTestId('next').click();
		await expect(page.locator('[data-state="current"]')).toHaveAttribute(
			'data-step',
			'make-verifier'
		);
		await expect(marker(page)).toHaveCount(0);
		await page.getByTestId('next').click();
		await expect(marker(page)).toHaveCount(1);
		await page.getByRole('checkbox', { name: /OpenID Connect/ }).click();
		await expect(marker(page)).toHaveCount(0);
	});

	test('what it carries shows once it gets there', async ({ page }) => {
		await open(page, 'step=login-page');
		await page.getByTestId('next').click();
		const held = page.locator('[data-held="idp:password"]');
		await expect(held).toHaveClass(/landing/);
		const label = page.locator('[data-state="current"] .label');
		expect(await opacity(label)).toBeLessThan(0.5);
		await expect.poll(() => opacity(label)).toBe(1);
		await expect.poll(() => opacity(held)).toBe(1);
	});

	test('what someone had already seen does not land again', async ({ page }) => {
		await open(page, 'step=login-page');
		await page.getByTestId('next').click();
		await expect(page.locator('.held.landing')).not.toHaveCount(0);
		await expect(page.locator('[data-held="browser:session"].landing')).toHaveCount(0);
	});

	test('a refusal travels with nothing in it, and an answer with something', async ({ page }) => {
		await open(page, 'client=public&attacker=1&pkce=1&step=attacker-token-request');
		await page.getByTestId('next').click();
		await expect(page.locator('[data-state="current"]')).toHaveAttribute(
			'data-step',
			'attacker-token-response'
		);
		await expect(page.locator('.packet.empty')).toHaveCount(1);
		await expect(page.locator('.held.landing')).toHaveCount(0);

		await open(page, 'client=public&attacker=1&step=attacker-token-request');
		await page.getByTestId('next').click();
		await expect(marker(page)).toHaveCount(1);
		await expect(page.locator('.packet.empty')).toHaveCount(0);
		await expect(page.locator('[data-held="attacker:access-token"].landing')).toHaveCount(1);
	});

	test('Execute sends it too', async ({ page }) => {
		await open(page, 'mode=advanced&step=token-request');
		await page.getByTestId('execute').click();
		await expect(page.locator('[data-state="current"]')).toHaveAttribute(
			'data-step',
			'token-response'
		);
		await expect(page.locator('[data-state="current"] .packet')).toHaveCount(1);
	});
});

test.describe('filmed frame by frame', () => {
	const films: [string, string, string][] = [
		['OpenID Connect', 'step=token-response', 'oidc'],
		['an external provider', 'step=token-request', 'broker'],
		['the attacker', 'step=token-request', 'attacker'],
		['the attacker, early on', 'step=authorize', 'attacker'],
		['PKCE', 'step=token-request', 'pkce']
	];

	const looks = () => {
		const scroller = document.querySelector('.scroller')!;
		const view = scroller.getBoundingClientRect();
		const opacityOf = (element: Element | null) => {
			let opacity = 1;
			for (let at = element; at && at !== scroller; at = at.parentElement) {
				opacity *= Number(getComputedStyle(at).opacity);
			}
			return opacity;
		};
		const boxes = (selector: string, enough = 0.15) =>
			[...scroller.querySelectorAll(selector)]
				.filter((element) => opacityOf(element) > enough)
				.map((element) => element.getBoundingClientRect())
				.filter((box) => box.width && box.bottom > view.top && box.top < view.bottom);
		const words = boxes('.row .label tspan');
		const chips = boxes('.chip:not(.future) .tag');
		const crossing = chips.filter((chip) =>
			words.some(
				(word) =>
					Math.min(chip.right, word.right) - Math.max(chip.left, word.left) > 2 &&
					Math.min(chip.bottom, word.bottom) - Math.max(chip.top, word.top) > 2
			)
		).length;
		// What is coming in counts as soon as it can be seen, and what is ahead is faint anyway.
		const lowest = Math.max(0, ...boxes('.row line, .row polygon', 0.01).map((box) => box.bottom));
		return { crossing, lowest: lowest - view.top };
	};

	for (const [name, query, setting] of films) {
		test(`no frame is blank and no chip crosses a label, turning on ${name}`, async ({ page }) => {
			await page.clock.install();
			await open(page, query);
			const before = await page.evaluate(looks);
			await page.locator(`[data-setting="${setting}"] input`).click();
			for (let frame = 0; frame < 60; frame++) {
				const { crossing, lowest } = await page.evaluate(looks);
				expect.soft(crossing, `frame ${frame}`).toBe(0);
				expect.soft(lowest, `frame ${frame}`).toBeGreaterThan(before.lowest * 0.5);
				await page.clock.runFor(16);
			}
			await expect(diagram(page)).toHaveAttribute('data-animating', 'false');
		});
	}
});

test.describe('flipping a setting', () => {
	test('plays the transition', async ({ page }) => {
		await open(page, '');
		const times = await watchAnimating(page);
		await page.getByRole('checkbox', { name: /OpenID Connect/ }).click();
		await expect.poll(times).toBeGreaterThan(0);
		await expect(diagram(page)).toHaveAttribute('data-animating', 'false');
	});

	test('a row on its way out cannot be stepped to', async ({ page }) => {
		const check = watchForErrors(page);
		await open(page, 'oidc=1');
		const leaving = page.locator('.row:not([data-step])');
		await page.getByRole('checkbox', { name: /OpenID Connect/ }).click();
		// Clicked from inside the page, because a click from here can arrive after it has gone.
		await leaving
			.first()
			.evaluate((row) => row.dispatchEvent(new MouseEvent('click', { bubbles: true })));
		await expect(diagram(page)).toHaveAttribute('data-animating', 'false');
		await expect(page).not.toHaveURL(/step=userinfo/);
		check();
	});

	test('a new step ahead still looks like what is ahead', async ({ page }) => {
		await open(page, 'step=authorize');
		await page.getByRole('checkbox', { name: /OpenID Connect/ }).click();
		await expect(diagram(page)).toHaveAttribute('data-animating', 'false');
		const added = page.locator('.row.fresh.future').first();
		await expect(added).toBeVisible();
		const opacity = await added
			.locator('line, path')
			.first()
			.evaluate((line) => Number(getComputedStyle(line).opacity));
		expect(opacity).toBeLessThan(1);
	});
});

test.describe('what changed', () => {
	const why = (page: Page) => page.getByTestId('change-why');
	const oidc = (page: Page) => page.getByRole('checkbox', { name: /OpenID Connect/ });

	test('explains a flip', async ({ page }) => {
		await open(page, '');
		await oidc(page).click();
		await expect(why(page)).toContainText('OAuth');
	});

	test('does not explain Back with the words of another setting', async ({ page }) => {
		await open(page, '');
		await oidc(page).click();
		await expect(page).toHaveURL(/oidc=1/);
		await page.getByRole('radio', { name: 'DPoP' }).click();
		await expect(why(page)).toContainText('bearer token');
		// The state moves at once and the address catches up, and Back goes by the address.
		await expect(page).toHaveURL(/binding=dpop/);
		await page.goBack();
		await expect(page.getByRole('radio', { name: 'DPoP' })).not.toBeChecked();
		await page.goBack();
		await expect(oidc(page)).not.toBeChecked();
		await expect(page.getByTestId('change-summary')).toBeVisible();
		await expect(why(page)).toHaveCount(0);
	});

	test('does not say something was reset once Back has restored it', async ({ page }) => {
		await open(page, 'broker=1&upstream=v2');
		await page.getByRole('radio', { name: /Public/ }).click();
		await expect(page.getByTestId('change-summary')).toContainText('was reset');
		await expect(page).toHaveURL(/client=public/);
		await page.goBack();
		await expect(page.getByRole('radio', { name: /Public/ })).not.toBeChecked();
		await expect(page.getByTestId('change-summary')).not.toContainText('was reset');
	});
});

test.describe('Execute', () => {
	test('does not point at a step that a setting has since removed', async ({ page }) => {
		await open(page, 'step=submit-credentials');
		await page.getByTestId('execute').click();
		await expect(page.getByTestId('answer-to')).toBeVisible();
		await page.getByRole('checkbox', { name: /External IdP/ }).click();
		await expect(page.locator('body')).not.toContainText('The answer to step .');
	});
});

test.describe('keys', () => {
	for (const modifier of ['Shift', 'Alt', 'Control', 'Meta']) {
		test(`${modifier} with an arrow is not a step`, async ({ page }) => {
			await open(page, 'step=authorize');
			await page.keyboard.press(`${modifier}+ArrowRight`);
			await expect(page.getByTestId('position')).toContainText('Step 3');
		});
	}

	test('a plain arrow is', async ({ page }) => {
		await open(page, 'step=authorize');
		await page.keyboard.press('ArrowRight');
		await expect(page.getByTestId('position')).toContainText('Step 4');
	});
});
