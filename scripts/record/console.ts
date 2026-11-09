// Goes through a real admin console, to see that each note says where a setting really is.
import type { Browser, Page } from '@playwright/test';
import { noteDefs, type ConsolePage, type NoteDef } from '#lib/keycloak/notes.ts';
import {
	Admin,
	ADMIN_PASSWORD,
	API_CLIENT,
	BROKERED_REALM,
	CONFIDENTIAL_CLIENT,
	DIRECTORY_REALM,
	KEYCLOAK,
	LOCAL_REALM,
	UPSTREAM_REALM
} from './keycloak.ts';
import { COMPANIES_REALM } from './companies.ts';

const LOOK_FOR_MS = 8000;

/** Whether these words are on the screen, as someone would read them. The page is still loading. */
async function seen(page: Page, text: string) {
	const until = Date.now() + LOOK_FOR_MS;
	while (Date.now() < until) {
		if ((await page.locator('body').innerText()).includes(text)) return true;
		await page.waitForTimeout(250);
	}
	return false;
}

/** What each note says it can find, on the server this is, in the words of its console. */
export async function lookInConsole(
	browser: Browser,
	admin: Admin,
	flagsOn: readonly string[],
	notes: readonly NoteDef[] = noteDefs
) {
	const [client] = await admin.call<{ id: string }[]>(
		'GET',
		`/realms/${LOCAL_REALM}/clients?clientId=${CONFIDENTIAL_CLIENT}`
	);
	const [api] = await admin.call<{ id: string }[]>(
		'GET',
		`/realms/${LOCAL_REALM}/clients?clientId=${API_CLIENT}`
	);
	const root = `${KEYCLOAK}/admin/master/console/#`;
	const onClient = `${root}/${LOCAL_REALM}/clients/${client.id}`;
	const onTheApi = `${root}/${LOCAL_REALM}/clients/${api.id}`;
	const [directory] = await admin.call<{ id: string }[]>(
		'GET',
		`/realms/${DIRECTORY_REALM}/components?type=org.keycloak.storage.UserStorageProvider`
	);
	const [acme] = await admin.call<{ id: string }[]>(
		'GET',
		`/realms/${COMPANIES_REALM}/organizations?search=Acme&exact=true`
	);
	const pages: Record<ConsolePage, string> = {
		'organization-domains': `${root}/${COMPANIES_REALM}/organizations/${acme?.id}/domains`,
		'client-settings': `${onClient}/settings`,
		'client-advanced': `${onClient}/advanced`,
		'client-scopes': `${onClient}/clientScopes`,
		'client-dedicated-scope': `${onClient}/clientScopes/dedicated`,
		'api-client-settings': `${onTheApi}/settings`,
		'api-client-advanced': `${onTheApi}/advanced`,
		'api-client-scopes': `${onTheApi}/clientScopes`,
		'provider-settings': `${root}/${BROKERED_REALM}/identity-providers/oidc/${UPSTREAM_REALM}/settings`,
		'provider-mappers': `${root}/${BROKERED_REALM}/identity-providers/oidc/${UPSTREAM_REALM}/mappers`,
		'realm-settings': `${root}/${LOCAL_REALM}/realm-settings`,
		'realm-sessions': `${root}/${LOCAL_REALM}/realm-settings/sessions`,
		'realm-tokens': `${root}/${LOCAL_REALM}/realm-settings/tokens`,
		'browser-flow': `${root}/${BROKERED_REALM}/authentication`,
		'directory-settings': `${root}/${DIRECTORY_REALM}/user-federation/ldap/${directory?.id}`
	};

	const context = await browser.newContext({ viewport: { width: 1600, height: 1400 } });
	const page = await context.newPage();
	await page.goto(`${KEYCLOAK}/admin/master/console/`);
	await page.fill('#username', 'admin');
	await page.fill('#password', ADMIN_PASSWORD);
	await page.click('#kc-login');
	await page.getByRole('link', { name: 'Clients' }).first().waitFor({ timeout: 60_000 });

	const found: Record<string, { found: string[]; missing: string[] }> = {};
	for (const note of notes) {
		const { place } = note;
		if (!place) continue;
		const here = place.needsFlag ? flagsOn.includes(place.needsFlag) : flagsOn.length === 0;
		if (!here) continue;
		await page.goto(pages[place.page]);
		await page.reload();
		if (place.opens) {
			const name = { name: place.opens, exact: true };
			await page
				.getByRole('link', name)
				.or(page.getByRole('button', name))
				.or(page.getByRole('tab', name))
				.first()
				.click({ timeout: LOOK_FOR_MS });
		}
		const looked = await Promise.all(
			place.shows.map(async (text) => [text, await seen(page, text)] as const)
		);
		found[note.id] = {
			found: looked.filter(([, there]) => there).map(([text]) => text),
			missing: looked.filter(([, there]) => !there).map(([text]) => text)
		};
	}
	await context.close();
	return found;
}
