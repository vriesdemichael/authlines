import { mkdirSync } from 'node:fs';
import type { Browser, Page } from '@playwright/test';
import { pageShots, type ShotId } from '#lib/flow/vocabulary.ts';
import {
	Admin,
	BROKERED_REALM,
	CONFIDENTIAL_CLIENT,
	DEVICE_CLIENT,
	KEYCLOAK,
	LOCAL_REALM,
	PASSWORD,
	REDIRECT_URI,
	setUpFor,
	UPSTREAM_REALM,
	USERNAME
} from './keycloak.ts';

export const PAGES_FOLDER = 'static/recordings/pages';

/** Half the width of the panel's picture twice over, so it stays sharp on a dense screen. */
const VIEWPORT = { width: 640, height: 480 };
const QUALITY = 70;

const authorize = (realm: string, extra: Record<string, string> = {}) =>
	`${KEYCLOAK}/realms/${realm}/protocol/openid-connect/auth?${new URLSearchParams({
		response_type: 'code',
		client_id: CONFIDENTIAL_CLIENT,
		redirect_uri: REDIRECT_URI,
		state: 'a-page-to-look-at',
		...extra
	})}`;

async function logIn(page: Page, realm: string) {
	await page.goto(authorize(realm));
	await page.fill('#username', USERNAME);
	await page.fill('#password', PASSWORD);
	await page.click('#kc-login');
}

const loggedIn = (page: Page) => page.getByRole('heading', { name: 'Done' }).waitFor();

/**
 * Looks at the pages a person gets, on a real server, and takes a picture of each. A picture is only
 * ever of one server's default look, so only pixels change between releases, and those are not
 * compared. A page that stopped appearing is, which is what comes back.
 */
export async function capturePages(
	browser: Browser,
	admin: Admin,
	write: boolean
): Promise<ShotId[]> {
	const seen: ShotId[] = [];
	if (write) mkdirSync(PAGES_FOLDER, { recursive: true });

	const capture = async (shot: ShotId, reach: (page: Page) => Promise<void>) => {
		const context = await browser.newContext({ viewport: VIEWPORT, colorScheme: 'light' });
		const page = await context.newPage();
		page.setDefaultTimeout(10_000);
		try {
			await reach(page);
			if (write) {
				await page.screenshot({
					path: `${PAGES_FOLDER}/${shot}.jpg`,
					type: 'jpeg',
					quality: QUALITY
				});
			}
			seen.push(shot);
		} catch (error) {
			console.log(`The page ${shot} did not appear: ${String(error).split('\n')[0]}`);
		} finally {
			await context.close();
		}
	};

	await capture('login', async (page) => {
		await page.goto(authorize(LOCAL_REALM));
		await page.locator('#username').waitFor();
	});
	await capture('login-again', async (page) => {
		await logIn(page, LOCAL_REALM);
		await loggedIn(page);
		await page.goto(authorize(LOCAL_REALM, { prompt: 'login' }));
		await page.locator('#password').waitFor();
	});
	await capture('login-upstream', async (page) => {
		await page.goto(authorize(BROKERED_REALM));
		await page.locator('#username').waitFor();
		if (!page.url().includes(`/realms/${UPSTREAM_REALM}/`)) {
			throw new Error(`Stayed on ${page.url()}`);
		}
	});
	await capture('wrong-redirect', async (page) => {
		await page.goto(authorize(LOCAL_REALM, { redirect_uri: 'http://elsewhere.example/callback' }));
		await page.getByText(/Invalid parameter/).waitFor();
	});
	await capture('logout-question', async (page) => {
		await logIn(page, LOCAL_REALM);
		await loggedIn(page);
		await page.goto(`${KEYCLOAK}/realms/${LOCAL_REALM}/protocol/openid-connect/logout`);
		await page.locator('#kc-logout').waitFor();
	});

	const onDefaults = { clientType: 'confidential', upstreamTokens: 'v1' } as const;
	await setUpFor(admin, LOCAL_REALM, { ...onDefaults, consent: true });
	await capture('consent', async (page) => {
		await logIn(page, LOCAL_REALM);
		await page.locator('[name="accept"]').waitFor();
	});
	await setUpFor(admin, LOCAL_REALM, { ...onDefaults, consent: false });

	const typeACode = async (page: Page) => {
		const asked = await fetch(
			`${KEYCLOAK}/realms/${LOCAL_REALM}/protocol/openid-connect/auth/device`,
			{
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({ client_id: DEVICE_CLIENT }).toString()
			}
		);
		const { verification_uri: address, user_code: code } = (await asked.json()) as {
			verification_uri: string;
			user_code: string;
		};
		await page.goto(address);
		await page.locator('[name="device_user_code"]').waitFor();
		return async () => {
			await page.fill('[name="device_user_code"]', code);
			await page.click('[type="submit"]');
			await page.fill('#username', USERNAME);
			await page.fill('#password', PASSWORD);
			await page.click('#kc-login');
			await page.locator('[name="accept"]').waitFor();
		};
	};
	await capture('device-code', async (page) => {
		await typeACode(page);
	});
	await capture('device-consent', async (page) => {
		await (
			await typeACode(page)
		)();
	});
	await capture('device-denied', async (page) => {
		await (
			await typeACode(page)
		)();
		await page.locator('[name="cancel"]').click();
		await page.getByText('Consent denied').waitFor();
	});
	await capture('device-done', async (page) => {
		await (
			await typeACode(page)
		)();
		await page.locator('[name="accept"]').click();
		await page.getByText('Device Login Successful').waitFor();
	});

	return pageShots.filter((shot) => seen.includes(shot));
}
