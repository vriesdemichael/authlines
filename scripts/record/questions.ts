// Things the diagram makes a claim about, tried for real. Each answer is what the server did, so a
// claim in the flow data can be held against it (docs/research/followup-checks.md).
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import type { Browser, BrowserContext } from '@playwright/test';
import { defaultSettings } from '#lib/flow/settings.ts';
import type { Demo } from './demo.ts';
import {
	Admin,
	API,
	APP,
	BROKERED_REALM,
	connectDirectory,
	DIRECTORY_REALM,
	CLIENT_SECRET,
	CONFIDENTIAL_CLIENT,
	KEYCLOAK,
	LOCAL_REALM,
	SERVICE_CLIENT,
	DEVICE_CLIENT,
	DEVICE_GRANT_ON,
	PASSWORD,
	PKCE_CLIENT,
	PUBLIC_CLIENT,
	REDIRECT_URI,
	UPSTREAM_REALM,
	USERNAME,
	API_CLIENT,
	BACKCHANNEL_URL,
	POST_LOGOUT_URI,
	namesTheApi
} from './keycloak.ts';
import {
	DIRECTORY_URL,
	directoryLogLength,
	passThrough,
	SERVICE_DN,
	SERVICE_PASSWORD,
	startDirectory,
	stopDirectory,
	USERS_DN,
	whatALoginAsked
} from './directory.ts';

const b64 = (value: string | Buffer) => Buffer.from(value).toString('base64url');
const sha256 = (value: string) => createHash('sha256').update(value).digest('base64url');
const random = () => randomBytes(16).toString('base64url');

function proofKey() {
	const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
	const { kty, crv, x, y } = publicKey.export({ format: 'jwk' }) as Record<string, string>;
	const jwk = { crv, kty, x, y };
	const prove = (method: string, url: string, extra: Record<string, string> = {}) => {
		const signing = `${b64(JSON.stringify({ typ: 'dpop+jwt', alg: 'ES256', jwk }))}.${b64(
			JSON.stringify({
				jti: random(),
				htm: method,
				htu: url,
				iat: Math.floor(Date.now() / 1000),
				...extra
			})
		)}`;
		const signature = sign('sha256', Buffer.from(signing), {
			key: privateKey,
			dsaEncoding: 'ieee-p1363'
		});
		return `${signing}.${signature.toString('base64url')}`;
	};
	return Object.assign(prove, { thumbprint: sha256(JSON.stringify(jwk)) });
}

/** Logs in through a real browser and hands back the code, without the demo app finishing the job. */
async function codeFor(
	browser: Browser,
	demo: Demo,
	realm: string,
	clientId: string,
	extra: Record<string, string> = {}
) {
	const context = await browser.newContext();
	const page = await context.newPage();
	demo.lastCode = '';
	const query = new URLSearchParams({
		response_type: 'code',
		client_id: clientId,
		redirect_uri: REDIRECT_URI,
		state: random(),
		...extra
	});
	const response = await page.goto(
		`${KEYCLOAK}/realms/${realm}/protocol/openid-connect/auth?${query}`
	);
	if (await page.locator('#username').count()) {
		await page.fill('#username', USERNAME);
		await page.fill('#password', PASSWORD);
		await page.click('#kc-login');
		await page.getByRole('heading', { name: 'Done' }).waitFor();
	}
	const landed = page.url();
	await context.close();
	return { code: demo.lastCode, firstStatus: response?.status() ?? 0, landed };
}

async function token(realm: string, body: Record<string, string>, headers = {}) {
	const url = `${KEYCLOAK}/realms/${realm}/protocol/openid-connect/token`;
	const response = await fetch(url, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
		body: new URLSearchParams(body).toString()
	});
	return {
		url,
		status: response.status,
		nonce: response.headers.get('dpop-nonce'),
		json: (await response.json()) as Record<string, string>
	};
}

const confidentialBody = (code: string) => ({
	grant_type: 'authorization_code',
	code,
	redirect_uri: REDIRECT_URI,
	client_id: CONFIDENTIAL_CLIENT,
	client_secret: CLIENT_SECRET
});

async function outcome(response: Response) {
	const text = await response.text();
	return {
		status: response.status,
		wwwAuthenticate: response.headers.get('www-authenticate'),
		// Only the shape of a success, because the body of one is a token or someone's profile.
		body: response.ok ? 'a successful answer' : text.slice(0, 160)
	};
}

const statusOf = async (url: string, headers: Record<string, string>) =>
	outcome(await fetch(url, { headers }));

async function dpopBoundBrokeredToken(browser: Browser, demo: Demo, admin: Admin) {
	await admin.forgetBrokeredUsers();
	const proof = proofKey();
	const { code } = await codeFor(browser, demo, BROKERED_REALM, CONFIDENTIAL_CLIENT);
	const url = `${KEYCLOAK}/realms/${BROKERED_REALM}/protocol/openid-connect/token`;
	const result = await token(BROKERED_REALM, confidentialBody(code), { dpop: proof('POST', url) });
	return { proof, accessToken: result.json.access_token, tokenType: result.json.token_type };
}

const brokerTokenUrl = `${KEYCLOAK}/realms/${BROKERED_REALM}/broker/${UPSTREAM_REALM}/token`;

const claimsOf = (jwt: string) =>
	JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()) as Record<string, unknown>;

interface Client {
	id: string;
	attributes?: Record<string, string>;
}

/** A client of its own for each try, so changing a setting cannot disturb anything else. */
async function freshClient(admin: Admin, clientId: string, extra: object = {}) {
	await admin.call('POST', `/realms/${LOCAL_REALM}/clients`, {
		clientId,
		enabled: true,
		standardFlowEnabled: true,
		redirectUris: [REDIRECT_URI],
		publicClient: false,
		clientAuthenticatorType: 'client-secret',
		secret: CLIENT_SECRET,
		...extra
	});
	const [client] = await admin.call<Client[]>(
		'GET',
		`/realms/${LOCAL_REALM}/clients?clientId=${clientId}`
	);
	return client;
}

const tokensFor = async (
	browser: Browser,
	demo: Demo,
	clientId: string,
	send: Record<string, string> = { client_secret: CLIENT_SECRET }
) => {
	const { code } = await codeFor(browser, demo, LOCAL_REALM, clientId);
	return token(LOCAL_REALM, {
		grant_type: 'authorization_code',
		code,
		redirect_uri: REDIRECT_URI,
		client_id: clientId,
		...send
	});
};

/**
 * What each Keycloak note says: change the setting, and see the behaviour change. Each answer is
 * what the server did before and after, on a real login.
 */
async function behindTheNotes(browser: Browser, demo: Demo, admin: Admin) {
	const answers: Record<string, unknown> = {};
	const onClient = (client: Client) => `/realms/${LOCAL_REALM}/clients/${client.id}`;
	const change = (client: Client, changes: object) =>
		admin.call('PUT', onClient(client), { ...client, ...changes });

	{
		const client = await freshClient(admin, 'note-redirect');
		const elsewhere = `${APP}/elsewhere`;
		const ask = async () => {
			const answer = await fetch(
				`${KEYCLOAK}/realms/${LOCAL_REALM}/protocol/openid-connect/auth?${new URLSearchParams({
					response_type: 'code',
					client_id: 'note-redirect',
					redirect_uri: elsewhere,
					state: random()
				})}`,
				{ redirect: 'manual' }
			);
			const text = await answer.text();
			return { status: answer.status, says: text.match(/Invalid parameter[^<]*/)?.[0] ?? null };
		};
		const before = await ask();
		await change(client, { redirectUris: [REDIRECT_URI, elsewhere] });
		answers.validRedirectUris = { before, after: await ask() };
	}

	{
		// What a wildcard lets through. The attacker's address is only ever asked about, never visited.
		const client = await freshClient(admin, 'note-wildcard');
		const ask = async (redirectUri: string) => {
			const answer = await fetch(
				`${KEYCLOAK}/realms/${LOCAL_REALM}/protocol/openid-connect/auth?${new URLSearchParams({
					response_type: 'code',
					client_id: 'note-wildcard',
					redirect_uri: redirectUri,
					state: random()
				})}`,
				{ redirect: 'manual' }
			);
			await answer.text();
			return answer.status;
		};
		const attackers = 'https://someone-else.test/callback';
		await change(client, { redirectUris: [`${APP}/*`] });
		const atTheEnd = { sameSite: await ask(`${APP}/elsewhere`), otherSite: await ask(attackers) };
		await change(client, { redirectUris: [`${APP}*`] });
		const noSlash = {
			sameSite: await ask(`${APP}/elsewhere`),
			otherSite: await ask(attackers),
			startingTheSame: await ask(`${APP}.someone-else.test/callback`)
		};
		await change(client, { redirectUris: ['*'] });
		answers.validRedirectUris = {
			...(answers.validRedirectUris as object),
			wildcard: {
				atTheEnd,
				noSlash,
				alone: { sameSite: await ask(`${APP}/elsewhere`), otherSite: await ask(attackers) }
			}
		};
	}

	{
		// The way that did send the token through the browser, and whether it is still there.
		const client = await freshClient(admin, 'note-implicit');
		const ask = async () => {
			const answer = await fetch(
				`${KEYCLOAK}/realms/${LOCAL_REALM}/protocol/openid-connect/auth?${new URLSearchParams({
					response_type: 'token',
					client_id: 'note-implicit',
					redirect_uri: REDIRECT_URI,
					state: random()
				})}`,
				{ redirect: 'manual' }
			);
			await answer.text();
			const location = answer.headers.get('location') ?? '';
			return { status: answer.status, allowed: answer.status === 200 && !location };
		};
		const before = await ask();
		await change(client, { implicitFlowEnabled: true });
		const discovery = await fetch(
			`${KEYCLOAK}/realms/${LOCAL_REALM}/.well-known/openid-configuration`
		);
		const { response_types_supported: types } = (await discovery.json()) as {
			response_types_supported: string[];
		};
		answers.implicitFlow = {
			serverLists: types.includes('token'),
			before,
			after: await ask()
		};
	}

	{
		// A public client in a page calls the token endpoint from that page, so the browser has a say.
		// Created through this API with none, a client copies them from its redirect URIs. In the
		// console it starts with the list empty, so that is what this starts from.
		const client = await freshClient(admin, 'note-origins', { publicClient: true, webOrigins: [] });
		const fromThePage = async () => {
			const { code } = await codeFor(browser, demo, LOCAL_REALM, 'note-origins');
			const context = await browser.newContext();
			const page = await context.newPage();
			await page.goto(`${APP}/callback`);
			const result = await page.evaluate(
				async ({ url, body }) => {
					try {
						const answer = await fetch(url, {
							method: 'POST',
							headers: { 'content-type': 'application/x-www-form-urlencoded' },
							body
						});
						return { blocked: false, status: answer.status };
					} catch {
						return { blocked: true, status: null };
					}
				},
				{
					url: `${KEYCLOAK}/realms/${LOCAL_REALM}/protocol/openid-connect/token`,
					body: new URLSearchParams({
						grant_type: 'authorization_code',
						code,
						redirect_uri: REDIRECT_URI,
						client_id: 'note-origins'
					}).toString()
				}
			);
			await context.close();
			// Whether the server answered anyway, and the browser only kept it from the page.
			const again = await token(LOCAL_REALM, {
				grant_type: 'authorization_code',
				code,
				redirect_uri: REDIRECT_URI,
				client_id: 'note-origins'
			});
			return { ...result, theSameCodeAfterwards: again.status };
		};
		const before = await fromThePage();
		await change(client, { webOrigins: [APP] });
		answers.webOrigins = { before, after: await fromThePage() };
	}

	{
		const client = await freshClient(admin, 'note-consent');
		const logIn = async (
			answer?: 'accept' | 'cancel',
			clientId = 'note-consent',
			scope?: string
		) => {
			const context = await browser.newContext();
			const page = await context.newPage();
			const query = new URLSearchParams({
				response_type: 'code',
				client_id: clientId,
				redirect_uri: REDIRECT_URI,
				state: random(),
				...(scope ? { scope } : {})
			});
			demo.lastCode = '';
			await page.goto(`${KEYCLOAK}/realms/${LOCAL_REALM}/protocol/openid-connect/auth?${query}`);
			await page.fill('#username', USERNAME);
			await page.fill('#password', PASSWORD);
			await page.click('#kc-login');
			await page.waitForLoadState('networkidle');
			const asked = (await page.locator('[name="accept"]').count()) > 0;
			const lists = asked
				? (await page.locator('#kc-oauth li, #kc-content li').allInnerTexts()).map((t) => t.trim())
				: [];
			if (asked && answer) {
				await page.locator(`[name="${answer}"]`).first().click();
				await page.waitForLoadState('networkidle');
			}
			const landed = new URL(page.url());
			await context.close();
			const code = demo.lastCode;
			const tokens =
				code && clientId === 'note-consent'
					? await token(LOCAL_REALM, {
							grant_type: 'authorization_code',
							code,
							redirect_uri: REDIRECT_URI,
							client_id: 'note-consent',
							client_secret: CLIENT_SECRET
						})
					: null;
			const claims = tokens?.json.access_token ? claimsOf(tokens.json.access_token) : null;
			return {
				asked,
				lists,
				error: landed.searchParams.get('error'),
				code,
				audience: claims?.aud ?? null,
				hasRoles: claims ? 'realm_access' in claims : null
			};
		};
		const before = await logIn();
		await change(client, { consentRequired: true });
		const declined = await logIn('cancel');
		const agreed = await logIn('accept');
		const again = await logIn();
		const noSecret = await freshClient(admin, 'note-consent-public', { publicClient: true });
		await change(noSecret, { consentRequired: true });
		const onPublic = async (scope?: string) => {
			const { asked, lists } = await logIn('accept', 'note-consent-public', scope);
			return { asked, lists };
		};
		const first = await onPublic();
		const second = await onPublic();
		const withANewScope = await onPublic('phone');
		const withThatScopeAgain = await onPublic('phone');
		answers.consentRequired = {
			before: { asked: before.asked, audience: before.audience, hasRoles: before.hasRoles },
			after: {
				asked: agreed.asked,
				lists: agreed.lists,
				audience: agreed.audience,
				hasRoles: agreed.hasRoles,
				gotCode: Boolean(agreed.code),
				secondLoginAsked: again.asked,
				whenDeclined: declined.error
			},
			onAPublicClient: { first, second, withANewScope, withThatScopeAgain }
		};
	}

	{
		const client = await freshClient(admin, 'note-type');
		const noSecret = {};
		const before = await tokensFor(browser, demo, 'note-type', noSecret);
		await change(client, { publicClient: true });
		const after = await tokensFor(browser, demo, 'note-type', noSecret);
		answers.clientAuthentication = {
			before: { status: before.status, error: before.json.error },
			after: { status: after.status, gotTokens: 'access_token' in after.json }
		};
	}

	{
		const client = await freshClient(admin, 'note-pkce', { publicClient: true });
		const before = await codeFor(browser, demo, LOCAL_REALM, 'note-pkce');
		await change(client, { attributes: { 'pkce.code.challenge.method': 'S256' } });
		const after = await codeFor(browser, demo, LOCAL_REALM, 'note-pkce');
		answers.requirePkce = {
			before: { gotCode: Boolean(before.code) },
			after: {
				gotCode: Boolean(after.code),
				says: new URL(after.landed).searchParams.get('error_description')
			}
		};
		const withSecret = await freshClient(admin, 'note-pkce-secret');
		await change(withSecret, { attributes: { 'pkce.code.challenge.method': 'S256' } });
		const refused = await codeFor(browser, demo, LOCAL_REALM, 'note-pkce-secret');
		answers.requirePkceWithASecret = {
			gotCode: Boolean(refused.code),
			says: new URL(refused.landed).searchParams.get('error_description')
		};
	}

	{
		const client = await freshClient(admin, 'note-scopes');
		const said = (claims: Record<string, unknown>) => ({
			hasName: 'name' in claims,
			hasEmail: 'email' in claims,
			scope: claims.scope
		});
		const before = await tokensFor(browser, demo, 'note-scopes');
		const scopes = await admin.call<{ id: string; name: string }[]>(
			'GET',
			`${onClient(client)}/default-client-scopes`
		);
		for (const scope of scopes.filter(({ name }) => name === 'profile' || name === 'email')) {
			await admin.call('DELETE', `${onClient(client)}/default-client-scopes/${scope.id}`);
		}
		const after = await tokensFor(browser, demo, 'note-scopes');
		answers.clientScopes = {
			before: said(claimsOf(before.json.access_token)),
			after: said(claimsOf(after.json.access_token))
		};
	}

	{
		const client = await freshClient(admin, 'note-audience');
		const said = (aud: unknown) => ({ aud, namesTheApi: [aud].flat().includes('my-api') });
		const before = await tokensFor(browser, demo, 'note-audience');
		const demoApi = await statusOf(`${API}/resource`, {
			authorization: `Bearer ${before.json.access_token}`
		});
		await admin.call('POST', `${onClient(client)}/protocol-mappers/models`, {
			name: 'my-api',
			protocol: 'openid-connect',
			protocolMapper: 'oidc-audience-mapper',
			config: { 'included.custom.audience': 'my-api', 'access.token.claim': 'true' }
		});
		const after = await tokensFor(browser, demo, 'note-audience');
		const noRoles = await freshClient(admin, 'note-audience-roles');
		const defaults = await admin.call<{ id: string; name: string }[]>(
			'GET',
			`${onClient(noRoles)}/default-client-scopes`
		);
		for (const scope of defaults.filter(({ name }) => name === 'roles')) {
			await admin.call('DELETE', `${onClient(noRoles)}/default-client-scopes/${scope.id}`);
		}
		const withoutRoles = await tokensFor(browser, demo, 'note-audience-roles');
		answers.audience = {
			before: { ...said(claimsOf(before.json.access_token).aud), demoApi: demoApi.status },
			after: said(claimsOf(after.json.access_token).aud),
			withoutTheRolesScope: { aud: claimsOf(withoutRoles.json.access_token).aud ?? null }
		};
	}

	{
		const client = await freshClient(admin, 'note-dpop');
		const before = await tokensFor(browser, demo, 'note-dpop');
		await change(client, { attributes: { 'dpop.bound.access.tokens': 'true' } });
		const after = await tokensFor(browser, demo, 'note-dpop');
		answers.requireDpop = {
			before: { status: before.status, tokenType: before.json.token_type },
			after: { status: after.status, error: after.json.error }
		};
	}

	{
		const client = await freshClient(admin, 'note-lifespan');
		const before = await tokensFor(browser, demo, 'note-lifespan');
		await change(client, { attributes: { 'access.token.lifespan': '60' } });
		const after = await tokensFor(browser, demo, 'note-lifespan');
		answers.tokenLifespan = {
			before: { expiresIn: before.json.expires_in },
			after: { expiresIn: after.json.expires_in }
		};
	}

	Object.assign(answers, await questionsWhenPushed(admin));

	{
		const issuerOf = async (realm: string) => {
			const answer = await fetch(`${KEYCLOAK}/realms/${realm}/.well-known/openid-configuration`);
			return ((await answer.json()) as { issuer: string }).issuer;
		};
		const [local, brokered] = [await issuerOf(LOCAL_REALM), await issuerOf(BROKERED_REALM)];
		answers.issuerPerRealm = {
			issuers: [local, brokered],
			realmsDiffer: local !== brokered,
			endsWithRealm: local.endsWith(`/realms/${LOCAL_REALM}`)
		};
	}

	return answers;
}

/** What the notes on a pushed request say: change the setting, and see the behaviour change. */
export async function questionsWhenPushed(admin: Admin) {
	const answers: Record<string, unknown> = {};
	const onClient = (client: Client) => `/realms/${LOCAL_REALM}/clients/${client.id}`;
	const change = (client: Client, changes: object) =>
		admin.call('PUT', onClient(client), { ...client, ...changes });

	{
		// A client that has to push its request first, asked for a login the ordinary way.
		const client = await freshClient(admin, 'note-par');
		const ask = async () => {
			const answer = await fetch(
				`${KEYCLOAK}/realms/${LOCAL_REALM}/protocol/openid-connect/auth?${new URLSearchParams({
					response_type: 'code',
					client_id: 'note-par',
					redirect_uri: REDIRECT_URI,
					state: random()
				})}`,
				{ redirect: 'manual' }
			);
			const page = await answer.text();
			const sentBack = new URL(answer.headers.get('location') ?? REDIRECT_URI);
			return {
				status: answer.status,
				loginPage: page.includes('kc-login'),
				backToTheApp: (answer.headers.get('location') ?? '').startsWith(REDIRECT_URI),
				error: sentBack.searchParams.get('error'),
				says: sentBack.searchParams.get('error_description')
			};
		};
		const before = await ask();
		await change(client, {
			attributes: { ...client.attributes, 'require.pushed.authorization.requests': 'true' }
		});
		answers.requirePar = { before, after: await ask() };
	}

	{
		// How long a pushed request lasts, which is the realm's and not the client's.
		const push = async () => {
			const answer = await fetch(
				`${KEYCLOAK}/realms/${LOCAL_REALM}/protocol/openid-connect/ext/par/request`,
				{
					method: 'POST',
					headers: { 'content-type': 'application/x-www-form-urlencoded' },
					body: new URLSearchParams({
						response_type: 'code',
						client_id: CONFIDENTIAL_CLIENT,
						client_secret: CLIENT_SECRET,
						redirect_uri: REDIRECT_URI,
						state: random()
					}).toString()
				}
			);
			const json = (await answer.json()) as { expires_in?: number };
			return { status: answer.status, expiresIn: json.expires_in };
		};
		const realm = await admin.call<{ attributes?: Record<string, string> }>(
			'GET',
			`/realms/${LOCAL_REALM}`
		);
		const lifespan = (seconds: string) =>
			admin.call('PUT', `/realms/${LOCAL_REALM}`, {
				attributes: { ...realm.attributes, parRequestUriLifespan: seconds }
			});
		const before = await push();
		await lifespan('30');
		const after = await push();
		await lifespan(realm.attributes?.parRequestUriLifespan ?? '60');
		answers.parLifespan = { before, after };
	}

	{
		// An address the client does not have, pushed, which is where it gets refused, and then the
		// same once the client has it.
		const client = await freshClient(admin, 'note-par-redirect');
		const ask = async () => {
			const answer = await fetch(
				`${KEYCLOAK}/realms/${LOCAL_REALM}/protocol/openid-connect/ext/par/request`,
				{
					method: 'POST',
					headers: { 'content-type': 'application/x-www-form-urlencoded' },
					body: new URLSearchParams({
						response_type: 'code',
						client_id: 'note-par-redirect',
						client_secret: CLIENT_SECRET,
						redirect_uri: `${APP}/elsewhere`,
						state: random()
					}).toString()
				}
			);
			const json = (await answer.json()) as { error_description?: string };
			return { status: answer.status, says: json.error_description ?? null };
		};
		const before = await ask();
		await change(client, { redirectUris: [REDIRECT_URI, `${APP}/elsewhere`] });
		const after = await ask();
		// The same, from an app that has nothing to show who it is.
		await freshClient(admin, 'note-par-redirect-public', { publicClient: true });
		const withNoSecret = await fetch(
			`${KEYCLOAK}/realms/${LOCAL_REALM}/protocol/openid-connect/ext/par/request`,
			{
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({
					response_type: 'code',
					client_id: 'note-par-redirect-public',
					redirect_uri: `${APP}/elsewhere`,
					state: random()
				}).toString()
			}
		);
		const refused = (await withNoSecret.json()) as { error_description?: string };
		answers.pushedRedirect = {
			before,
			after,
			withNoSecret: { status: withNoSecret.status, says: refused.error_description ?? null }
		};
	}

	return answers;
}

/** Whether the app can get the stored token, for a user who logs in for the first time now. */
async function storedTokenStatus(browser: Browser, demo: Demo, admin: Admin) {
	await admin.forgetBrokeredUsers();
	const { code } = await codeFor(browser, demo, BROKERED_REALM, CONFIDENTIAL_CLIENT);
	const result = await token(BROKERED_REALM, confidentialBody(code));
	const answer = await statusOf(brokerTokenUrl, {
		authorization: `Bearer ${result.json.access_token}`
	});
	return { status: answer.status, says: answer.body };
}

async function behindTheBrokeringNotes(browser: Browser, demo: Demo, admin: Admin) {
	const onProvider = `/realms/${BROKERED_REALM}/identity-provider/instances/${UPSTREAM_REALM}`;
	const provider = await admin.call<object>('GET', onProvider);
	const setProvider = (changes: object) =>
		admin.call('PUT', onProvider, { ...provider, ...changes });

	// Whether a provider stores anything if nobody says so.
	await admin.call('POST', `/realms/${BROKERED_REALM}/identity-provider/instances`, {
		alias: 'on-its-defaults',
		providerId: 'oidc',
		config: { authorizationUrl: `${KEYCLOAK}/x`, tokenUrl: `${KEYCLOAK}/x`, clientId: 'x' }
	});
	// Left out of the answer when false, which is itself how it comes back from the server.
	const byDefault = await admin.call<{ storeToken?: boolean; addReadTokenRoleOnCreate?: boolean }>(
		'GET',
		`/realms/${BROKERED_REALM}/identity-provider/instances/on-its-defaults`
	);
	await admin.call(
		'DELETE',
		`/realms/${BROKERED_REALM}/identity-provider/instances/on-its-defaults`
	);

	const before = await storedTokenStatus(browser, demo, admin);
	await setProvider({ storeToken: false });
	const storeOff = await storedTokenStatus(browser, demo, admin);
	await setProvider({ addReadTokenRoleOnCreate: false });
	await setProvider({ storeToken: true, addReadTokenRoleOnCreate: false });
	const readableOff = await storedTokenStatus(browser, demo, admin);
	await setProvider({});

	// Last, because it changes the login for everything after it, and the server stops after this.
	const authorize = async (extra: Record<string, string> = {}) => {
		const answer = await fetch(
			`${KEYCLOAK}/realms/${BROKERED_REALM}/protocol/openid-connect/auth?${new URLSearchParams({
				response_type: 'code',
				client_id: CONFIDENTIAL_CLIENT,
				redirect_uri: REDIRECT_URI,
				state: random(),
				...extra
			})}`,
			{ redirect: 'manual' }
		);
		const location = answer.headers.get('location') ?? '';
		return { status: answer.status, redirects: location.includes(`/broker/${UPSTREAM_REALM}/`) };
	};
	const redirecting = await authorize();
	const executions = await admin.call<{ providerId?: string; authenticationConfig?: string }[]>(
		'GET',
		`/realms/${BROKERED_REALM}/authentication/flows/browser/executions`
	);
	const redirector = executions.find((e) => e.providerId === 'identity-provider-redirector');
	await admin.call(
		'DELETE',
		`/realms/${BROKERED_REALM}/authentication/config/${redirector?.authenticationConfig}`
	);
	const notRedirecting = await authorize();
	const withHint = await authorize({ kc_idp_hint: UPSTREAM_REALM });

	return {
		storeTokens: {
			byDefault: { storeToken: Boolean(byDefault.storeToken) },
			before,
			after: storeOff
		},
		storedTokensReadable: {
			byDefault: { addReadTokenRoleOnCreate: Boolean(byDefault.addReadTokenRoleOnCreate) },
			before,
			after: readableOff
		},
		brokerRedirector: { before: redirecting, after: notRedirecting, withHint }
	};
}

/** What a server does about an app with no user, each one tried both ways. */
/** The login page, without a browser, because only what it answers matters here. */
async function throughTheLoginPage(
	clientId: string,
	username: string,
	password: string,
	session = ''
) {
	const redirect = encodeURIComponent(REDIRECT_URI);
	const page = await fetch(
		`${KEYCLOAK}/realms/${DIRECTORY_REALM}/protocol/openid-connect/auth?response_type=code&client_id=${clientId}&redirect_uri=${redirect}`,
		{ redirect: 'manual', headers: session ? { cookie: session } : {} }
	);
	if (page.status === 302) return { status: 302, askedToLogIn: false, session, says: null };
	const html = await page.text();
	const action = html.match(/action="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&');
	if (!action) throw new Error(`No login page: ${page.status} ${html.slice(0, 200)}`);
	const answer = await fetch(action, {
		method: 'POST',
		redirect: 'manual',
		headers: {
			cookie: page.headers
				.getSetCookie()
				.map((cookie) => cookie.split(';')[0])
				.join('; '),
			'content-type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams({ username, password })
	});
	const body = await answer.text();
	return {
		status: answer.status,
		askedToLogIn: true,
		session: answer.headers
			.getSetCookie()
			.map((cookie) => cookie.split(';')[0])
			.join('; '),
		says: body.match(/instruction">\s*([^<]+)/)?.[1]?.trim() ?? null
	};
}

/** What a directory changes about a login, and what still works with one that is not there. */
export async function questionsWithADirectory(admin: Admin) {
	const clientId = 'directory-question';
	const realm = `/realms/${DIRECTORY_REALM}`;
	await startDirectory();
	const connection = passThrough();
	try {
		const provider = await connectDirectory(
			admin,
			DIRECTORY_URL,
			USERS_DN,
			SERVICE_DN,
			SERVICE_PASSWORD
		);
		await admin.call('POST', `${realm}/clients`, {
			clientId,
			enabled: true,
			publicClient: true,
			standardFlowEnabled: true,
			directAccessGrantsEnabled: true,
			redirectUris: [REDIRECT_URI]
		});
		const logIn = () =>
			token(DIRECTORY_REALM, {
				grant_type: 'password',
				client_id: clientId,
				username: USERNAME,
				password: PASSWORD
			});
		const forgetCopies = () =>
			admin.call('POST', `${realm}/user-storage/${provider}/remove-imported-users`);
		const emailVerified = async () => {
			await forgetCopies();
			const { json } = await logIn();
			const [, payload] = json.access_token.split('.');
			return JSON.parse(Buffer.from(payload, 'base64url').toString()).email_verified;
		};
		const before = { emailVerified: await emailVerified() };
		const stored = await admin.call<{ config: object }>('GET', `${realm}/components/${provider}`);
		await admin.call('PUT', `${realm}/components/${provider}`, {
			...stored,
			config: { ...stored.config, trustEmail: ['true'] }
		});
		const after = { emailVerified: await emailVerified() };
		await admin.call('PUT', `${realm}/components/${provider}`, stored);
		await forgetCopies();

		const login = async (password: string) => {
			const since = directoryLogLength();
			const answer = await throughTheLoginPage(clientId, USERNAME, password);
			return { status: answer.status, ...whatALoginAsked(since) };
		};
		const firstLogin = await login(PASSWORD);
		const secondLogin = await login(PASSWORD);
		const wrongPassword = await login('not-the-password');

		const [copy] = await admin.call<{ id: string; federationLink?: string }[]>(
			'GET',
			`${realm}/users?username=${USERNAME}&exact=true`
		);
		const credentials = await admin.call<{ federationLink?: string }[]>(
			'GET',
			`${realm}/users/${copy.id}/credentials`
		);

		await admin.call('POST', `${realm}/users`, {
			username: 'kept-in-the-provider',
			enabled: true,
			firstName: 'Kept',
			lastName: 'Here',
			email: 'kept@example.test',
			emailVerified: true,
			credentials: [{ type: 'password', value: PASSWORD, temporary: false }]
		});
		const { session } = await throughTheLoginPage(clientId, USERNAME, PASSWORD);
		const { json: tokens } = await logIn();

		stopDirectory();
		const atTheForm = await throughTheLoginPage(clientId, USERNAME, PASSWORD);
		const atTheToken = await logIn();
		const withASession = await throughTheLoginPage(clientId, USERNAME, PASSWORD, session);
		const keptHere = await throughTheLoginPage(clientId, 'kept-in-the-provider', PASSWORD);
		const refreshed = await token(DIRECTORY_REALM, {
			grant_type: 'refresh_token',
			client_id: clientId,
			refresh_token: tokens.refresh_token
		});
		return {
			trustEmail: { before, after },
			directoryLogin: {
				firstLogin,
				secondLogin,
				wrongPassword,
				keepsACopy: Boolean(copy.federationLink),
				passwordIsElsewhere:
					credentials.length > 0 && credentials.every(({ federationLink }) => federationLink)
			},
			directoryDown: {
				form: { status: atTheForm.status, says: atTheForm.says },
				token: { status: atTheToken.status, error: atTheToken.json.error },
				withASession: { askedToLogIn: withASession.askedToLogIn },
				keptInTheProvider: { status: keptHere.status },
				refresh: { status: refreshed.status }
			}
		};
	} finally {
		connection.stop();
		stopDirectory();
	}
}

export async function questionsWithNoUser(admin: Admin) {
	const onClients = `/realms/${LOCAL_REALM}/clients`;
	const ask = async (clientId: string) =>
		token(
			LOCAL_REALM,
			{ grant_type: 'client_credentials' },
			{
				authorization: `Basic ${Buffer.from(`${clientId}:${CLIENT_SECRET}`).toString('base64')}`
			}
		);
	const tryWith = async (overrides: Record<string, unknown>) => {
		const clientId = `demo-try-${random().slice(0, 8)}`;
		await admin.call('POST', onClients, {
			clientId,
			secret: CLIENT_SECRET,
			publicClient: false,
			standardFlowEnabled: false,
			...overrides
		});
		const answer = await ask(clientId);
		const [found] = await admin.call<{ id: string }[]>('GET', `${onClients}?clientId=${clientId}`);
		await admin.call('DELETE', `${onClients}/${found.id}`);
		return answer;
	};

	const on = await ask(SERVICE_CLIENT);
	const payload = JSON.parse(
		Buffer.from(on.json.access_token.split('.')[1], 'base64url').toString()
	) as { preferred_username: string };
	const off = await tryWith({ serviceAccountsEnabled: false });
	const withRefresh = await tryWith({
		serviceAccountsEnabled: true,
		attributes: { 'client_credentials.use_refresh_token': 'true' }
	});
	const withOpenId = await token(
		LOCAL_REALM,
		{ grant_type: 'client_credentials', scope: 'openid' },
		{
			authorization: `Basic ${Buffer.from(`${SERVICE_CLIENT}:${CLIENT_SECRET}`).toString('base64')}`
		}
	);
	return {
		idTokenWhenAsked: {
			withoutAsking: Boolean(on.json.id_token),
			askedForOpenId: Boolean(withOpenId.json.id_token)
		},
		serviceAccountsOff: {
			before: { status: on.status },
			after: { status: off.status, error: off.json.error },
			name: payload.preferred_username
		},
		refreshForClientCredentials: {
			before: { gotRefreshToken: Boolean(on.json.refresh_token) },
			after: { gotRefreshToken: Boolean(withRefresh.json.refresh_token) }
		}
	};
}

/** What a server does in the device flow, including what is not on the way a run goes. */
export async function questionsOnADevice(browser: Browser, admin: Admin) {
	const endpoint = `${KEYCLOAK}/realms/${LOCAL_REALM}/protocol/openid-connect`;
	const onClients = `/realms/${LOCAL_REALM}/clients`;
	const send = async (url: string, values: Record<string, string>, headers = {}) => {
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
			body: new URLSearchParams(values).toString()
		});
		return {
			status: response.status,
			json: (await response.json()) as Record<string, string & number>
		};
	};
	const start = (clientId: string, headers = {}) =>
		send(`${endpoint}/auth/device`, { client_id: clientId }, headers);
	const ask = (clientId: string, deviceCode: string, headers = {}) =>
		send(
			`${endpoint}/token`,
			{
				grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
				device_code: deviceCode,
				client_id: clientId
			},
			headers
		);
	const wait = (seconds: number) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));
	const made: string[] = [];
	const clientWith = async (overrides: Record<string, unknown>) => {
		const clientId = `demo-try-${random().slice(0, 8)}`;
		await admin.call('POST', onClients, {
			clientId,
			publicClient: true,
			standardFlowEnabled: false,
			...overrides
		});
		const [found] = await admin.call<{ id: string }[]>('GET', `${onClients}?clientId=${clientId}`);
		made.push(found.id);
		return clientId;
	};

	/** What someone sees going through it, as far as this says, in the words on each page. */
	const goThrough = async (
		address: string,
		userCode: string | null,
		answer: 'accept' | 'cancel' = 'accept'
	) => {
		const context = await browser.newContext();
		const page = await context.newPage();
		const said = async () => (await page.locator('body').innerText()).replace(/\s+/g, ' ');
		await page.goto(address);
		const asksForTheCode = (await page.locator('[name="device_user_code"]').count()) > 0;
		let pages = await said();
		if (asksForTheCode && userCode) {
			await page.fill('[name="device_user_code"]', userCode);
			await page.click('[type="submit"]');
			pages += ` ${await said()}`;
		}
		const toLogIn = (await page.locator('#username').count()) > 0;
		if (toLogIn) {
			await page.fill('#username', USERNAME);
			await page.fill('#password', PASSWORD);
			await page.click('#kc-login');
			await page.locator('[name="accept"]').waitFor();
			pages += ` ${await said()}`;
		}
		const asked = (await page.locator('[name="accept"]').count()) > 0;
		if (asked) {
			await page.locator(`[name="${answer}"]`).click();
			await page
				.getByText(/Device Login/)
				.first()
				.waitFor();
			pages += ` ${await said()}`;
		}
		const cookies = await context.cookies();
		await context.close();
		const session = cookies.some(({ name }) => name === 'KEYCLOAK_IDENTITY');
		return { asksForTheCode, asked, pages, session };
	};

	const on = await start(DEVICE_CLIENT);
	const off = await start(await clientWith({}));
	const first = await ask(DEVICE_CLIENT, on.json.device_code);
	const tooSoon = await ask(DEVICE_CLIENT, on.json.device_code);
	await wait(on.json.interval);
	const afterWaiting = await ask(DEVICE_CLIENT, on.json.device_code);

	const agreed = await goThrough(on.json.verification_uri, on.json.user_code);
	await wait(on.json.interval);
	const fromAnotherClient = await ask(
		await clientWith({ attributes: DEVICE_GRANT_ON }),
		on.json.device_code
	);
	const got = await ask(DEVICE_CLIENT, on.json.device_code);
	await wait(on.json.interval);
	const usedTwice = await ask(DEVICE_CLIENT, on.json.device_code);
	const neverIssued = await ask(DEVICE_CLIENT, 'a-device-code-nobody-was-given');
	const typedAgain = await goThrough(on.json.verification_uri, on.json.user_code);

	const challenged = await send(`${endpoint}/auth/device`, {
		client_id: DEVICE_CLIENT,
		code_challenge: createHash('sha256').update('a-verifier-for-this-question').digest('base64url'),
		code_challenge_method: 'S256'
	});
	await goThrough(challenged.json.verification_uri, challenged.json.user_code);
	await wait(challenged.json.interval);
	const noVerifier = await ask(DEVICE_CLIENT, challenged.json.device_code);

	const consentOn = await clientWith({ attributes: DEVICE_GRANT_ON, consentRequired: true });
	const withConsent = await start(consentOn);
	const asksAnyway = await start(DEVICE_CLIENT);
	const secondLogin = await goThrough(asksAnyway.json.verification_uri, asksAnyway.json.user_code);
	const withConsentAsked = await goThrough(
		withConsent.json.verification_uri,
		withConsent.json.user_code
	);
	const withConsentAgain = await start(consentOn);
	const withConsentAgainAsked = await goThrough(
		withConsentAgain.json.verification_uri,
		withConsentAgain.json.user_code
	);

	const full = await start(DEVICE_CLIENT);
	const throughFull = await goThrough(full.json.verification_uri_complete, null);

	const denied = await start(DEVICE_CLIENT);
	const saidNo = await goThrough(denied.json.verification_uri, denied.json.user_code, 'cancel');
	await wait(denied.json.interval);
	const afterNo = await ask(DEVICE_CLIENT, denied.json.device_code);

	const quick = await clientWith({
		attributes: { ...DEVICE_GRANT_ON, 'oauth2.device.code.lifespan': '1' }
	});
	const running = await start(quick);
	await wait(2);
	const ranOut = await ask(quick, running.json.device_code);
	const tooLate = await goThrough(running.json.verification_uri, running.json.user_code);

	const set = await start(
		await clientWith({
			attributes: {
				...DEVICE_GRANT_ON,
				'oauth2.device.code.lifespan': '60',
				'oauth2.device.polling.interval': '1'
			}
		})
	);

	const withSecret = await clientWith({
		attributes: DEVICE_GRANT_ON,
		publicClient: false,
		clientAuthenticatorType: 'client-secret',
		secret: CLIENT_SECRET
	});
	const basic = {
		authorization: `Basic ${Buffer.from(`${withSecret}:${CLIENT_SECRET}`).toString('base64')}`
	};
	const noSecret = await start(withSecret);
	const itsSecret = await start(withSecret, basic);
	const askedWithNoSecret = await ask(withSecret, itsSecret.json.device_code);
	const askedWithItsSecret = await ask(withSecret, itsSecret.json.device_code, basic);

	const answers = {
		deviceGrantOff: {
			before: { status: on.status },
			after: {
				status: off.status,
				error: off.json.error,
				description: off.json.error_description
			}
		},
		devicePolling: {
			first: first.json.error,
			description: first.json.error_description,
			tooSoon: tooSoon.json.error,
			afterWaiting: afterWaiting.json.error
		},
		deviceConsent: {
			consentRequiredOff: { asked: secondLogin.asked },
			consentRequiredOn: { asked: withConsentAsked.asked },
			afterAgreeingBefore: { asked: withConsentAgainAsked.asked }
		},
		deviceFullAddress: {
			asksForTheCode: throughFull.asksForTheCode,
			showsTheCode: throughFull.pages.includes(full.json.user_code),
			stillAsksToAgree: throughFull.asked
		},
		deviceDenied: {
			status: afterNo.status,
			error: afterNo.json.error,
			description: afterNo.json.error_description,
			leftASession: saidNo.session,
			afterAgreeingLeftASession: agreed.session
		},
		deviceExpired: {
			status: ranOut.status,
			error: ranOut.json.error,
			description: ranOut.json.error_description,
			onThePage: tooLate.pages.includes('The code has expired.') ? 'The code has expired.' : null
		},
		deviceUsedCode: {
			onThePage: typedAgain.pages.includes('Invalid code, please try again.')
				? 'Invalid code, please try again.'
				: null
		},
		deviceWrongCode: {
			onThePage: (await goThrough(on.json.verification_uri, 'WRON-GCOD')).pages.includes(
				'Invalid code, please try again.'
			)
				? 'Invalid code, please try again.'
				: null
		},
		deviceTimings: {
			byDefault: { expiresIn: on.json.expires_in, interval: on.json.interval },
			setOnTheClient: { expiresIn: set.json.expires_in, interval: set.json.interval }
		},
		deviceCodeUse: {
			fromAnotherClient: { status: fromAnotherClient.status, error: fromAnotherClient.json.error },
			thenItsOwn: { status: got.status, gotTokens: Boolean(got.json.access_token) },
			usedTwice: {
				status: usedTwice.status,
				error: usedTwice.json.error,
				description: usedTwice.json.error_description
			},
			neverIssued: {
				status: neverIssued.status,
				error: neverIssued.json.error,
				description: neverIssued.json.error_description
			},
			fromAnotherClientSaid: fromAnotherClient.json.error_description
		},
		devicePkce: {
			startedWithAChallenge: { status: challenged.status },
			askedWithNoVerifier: {
				status: noVerifier.status,
				error: noVerifier.json.error,
				description: noVerifier.json.error_description
			}
		},
		deviceWithSecret: {
			startedWithNoSecret: { status: noSecret.status, error: noSecret.json.error },
			startedWithItsSecret: { status: itsSecret.status },
			askedWithNoSecret: { status: askedWithNoSecret.status, error: askedWithNoSecret.json.error },
			askedWithItsSecret: {
				status: askedWithItsSecret.status,
				error: askedWithItsSecret.json.error
			}
		}
	};
	for (const id of made) await admin.call('DELETE', `${onClients}/${id}`);
	return answers;
}

export async function questionsWithApiV1(browser: Browser, demo: Demo, admin: Admin) {
	const answers: Record<string, unknown> = {
		...(await behindTheNotes(browser, demo, admin))
	};

	// Does Keycloak ever ask for a DPoP nonce?
	{
		const proof = proofKey();
		const { code } = await codeFor(browser, demo, LOCAL_REALM, CONFIDENTIAL_CLIENT, {
			scope: 'openid'
		});
		const url = `${KEYCLOAK}/realms/${LOCAL_REALM}/protocol/openid-connect/token`;
		const result = await token(LOCAL_REALM, confidentialBody(code), { dpop: proof('POST', url) });
		answers.dpopNonce = {
			tokenStatus: result.status,
			tokenType: result.json.token_type,
			askedForNonce: result.status === 400 && result.json.error === 'use_dpop_nonce',
			dpopNonceHeader: result.nonce
		};

		// Does UserInfo take a DPoP-bound token the way the diagram shows?
		const accessToken = result.json.access_token;
		const userinfo = `${KEYCLOAK}/realms/${LOCAL_REALM}/protocol/openid-connect/userinfo`;
		answers.userinfoWithDpopToken = {
			withProof: await statusOf(userinfo, {
				authorization: `DPoP ${accessToken}`,
				dpop: proof('GET', userinfo, { ath: sha256(accessToken) })
			}),
			withoutProof: await statusOf(userinfo, { authorization: `DPoP ${accessToken}` }),
			asBearer: await statusOf(userinfo, { authorization: `Bearer ${accessToken}` })
		};
	}

	// Does API V1 take a DPoP-bound access token?
	{
		const { proof, accessToken, tokenType } = await dpopBoundBrokeredToken(browser, demo, admin);
		answers.apiV1WithDpopToken = {
			tokenType,
			asBearer: await statusOf(brokerTokenUrl, { authorization: `Bearer ${accessToken}` }),
			asDpop: await statusOf(brokerTokenUrl, {
				authorization: `DPoP ${accessToken}`,
				dpop: proof('GET', brokerTokenUrl, { ath: sha256(accessToken) })
			})
		};
	}

	// Is a public client without PKCE accepted?
	{
		const { code, landed } = await codeFor(browser, demo, LOCAL_REALM, PUBLIC_CLIENT);
		const result = code
			? await token(LOCAL_REALM, {
					grant_type: 'authorization_code',
					code,
					redirect_uri: REDIRECT_URI,
					client_id: PUBLIC_CLIENT
				})
			: null;
		const required = await codeFor(browser, demo, LOCAL_REALM, PKCE_CLIENT);
		answers.publicClientWithoutPkce = {
			byDefault: {
				gotCode: Boolean(code),
				tokenStatus: result?.status ?? null,
				landed: landed.split('?')[0]
			},
			withPkceRequiredOnTheClient: {
				gotCode: Boolean(required.code),
				landed: required.landed.split('&state')[0]
			}
		};
	}

	// What can someone do with a code they intercepted? Every try here is a code from a real login.
	{
		const verifier = random() + random();
		const pkce = { code_challenge: sha256(verifier), code_challenge_method: 'S256' };
		const attempt = async (clientId: string, extra: Record<string, string>, send: object) => {
			const { code } = await codeFor(browser, demo, LOCAL_REALM, clientId, extra);
			const body = { grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI };
			const tried = await token(LOCAL_REALM, { ...body, client_id: clientId, ...send });
			// What the real app would send next, with what it holds, once someone else has tried.
			const again = await token(LOCAL_REALM, {
				...body,
				client_id: clientId,
				...('code_challenge' in extra ? { code_verifier: verifier } : {}),
				...(clientId === CONFIDENTIAL_CLIENT ? { client_secret: CLIENT_SECRET } : {})
			});
			return {
				status: tried.status,
				error: tried.json.error ?? null,
				description: tried.json.error_description ?? null,
				gotTokens: 'access_token' in tried.json,
				theRealAppAfterwards: {
					status: again.status,
					description: again.json.error_description ?? null
				}
			};
		};
		const secret = { client_secret: CLIENT_SECRET };
		answers.interceptedCode = {
			publicWithoutPkce: await attempt(PUBLIC_CLIENT, {}, {}),
			publicWithPkceNoVerifier: await attempt(PUBLIC_CLIENT, pkce, {}),
			publicWithPkceWrongVerifier: await attempt(PUBLIC_CLIENT, pkce, {
				code_verifier: random() + random()
			}),
			publicWithPkceRightVerifier: await attempt(PUBLIC_CLIENT, pkce, { code_verifier: verifier }),
			confidentialNoPkceNoSecret: await attempt(CONFIDENTIAL_CLIENT, {}, {}),
			confidentialWithPkceSecretButNoVerifier: await attempt(CONFIDENTIAL_CLIENT, pkce, secret),
			confidentialWithPkceSecretButWrongVerifier: await attempt(CONFIDENTIAL_CLIENT, pkce, {
				...secret,
				code_verifier: random() + random()
			})
		};
	}

	// The same theft with DPoP. A login can name the app's key with dpop_jkt (RFC 9449 section 10).
	{
		const url = `${KEYCLOAK}/realms/${LOCAL_REALM}/protocol/openid-connect/token`;
		const appKey = proofKey();
		const theirKey = proofKey();
		const named = { dpop_jkt: appKey.thumbprint };
		const tryIt = async (extra: Record<string, string>, key?: ReturnType<typeof proofKey>) => {
			const { code } = await codeFor(browser, demo, LOCAL_REALM, PUBLIC_CLIENT, extra);
			const result = await token(
				LOCAL_REALM,
				{
					grant_type: 'authorization_code',
					code,
					redirect_uri: REDIRECT_URI,
					client_id: PUBLIC_CLIENT
				},
				key ? { dpop: key('POST', url) } : {}
			);
			return {
				status: result.status,
				error: result.json.error ?? null,
				description: result.json.error_description ?? null,
				tokenType: result.json.token_type ?? null
			};
		};
		const withDpop = {
			namedKeyNoProof: await tryIt(named),
			namedKeyOtherProof: await tryIt(named, theirKey),
			namedKeyRightProof: await tryIt(named, appKey),
			noNamedKeyNoProof: await tryIt({}),
			noNamedKeyTheirOwnProof: await tryIt({}, theirKey)
		};
		const required = { 'dpop.bound.access.tokens': 'true' };
		await admin.setClientAttributes(LOCAL_REALM, PUBLIC_CLIENT, required);
		const requiredNoProof = await tryIt({});
		const requiredTheirOwnProof = await tryIt({}, theirKey);
		await admin.setClientAttributes(LOCAL_REALM, PUBLIC_CLIENT, {
			'dpop.bound.access.tokens': 'false'
		});
		(answers.interceptedCode as Record<string, unknown>).withDpop = {
			...withDpop,
			requiredNoProof,
			requiredTheirOwnProof
		};
	}

	// What a real server's own API answers, in each case an API can say no.
	{
		const userinfo = `${KEYCLOAK}/realms/${LOCAL_REALM}/protocol/openid-connect/userinfo`;
		const { code } = await codeFor(browser, demo, LOCAL_REALM, CONFIDENTIAL_CLIENT, {
			scope: 'openid'
		});
		const good = await token(LOCAL_REALM, confidentialBody(code));
		const access = good.json.access_token;
		const noOpenid = await codeFor(browser, demo, LOCAL_REALM, CONFIDENTIAL_CLIENT, {
			scope: 'email'
		});
		const without = await token(LOCAL_REALM, confidentialBody(noOpenid.code));
		const said = async (headers: Record<string, string>) => {
			const answer = await fetch(userinfo, { headers });
			await answer.text();
			return { status: answer.status, wwwAuthenticate: answer.headers.get('www-authenticate') };
		};
		const [head, body, signature] = access.split('.');
		answers.howAnApiSaysNo = {
			goodToken: await said({ authorization: `Bearer ${access}` }),
			noToken: await said({}),
			notAToken: await said({ authorization: 'Bearer not-a-token' }),
			changed: await said({
				authorization: `Bearer ${head}.${body}.${signature.slice(0, -6)}AAAAAA`
			}),
			withoutOpenid: await said({ authorization: `Bearer ${without.json.access_token}` })
		};
	}

	// Does a second app in the same browser get past the login, and who has the session?
	{
		await freshClient(admin, 'note-sso-one');
		await freshClient(admin, 'note-sso-two');
		const auth = `${KEYCLOAK}/realms/${LOCAL_REALM}/protocol/openid-connect/auth`;
		const visit = async (
			context: BrowserContext,
			clientId: string,
			extra: Record<string, string> = {},
			submit = true
		) => {
			const page = await context.newPage();
			demo.lastCode = '';
			const query = new URLSearchParams({
				response_type: 'code',
				client_id: clientId,
				redirect_uri: REDIRECT_URI,
				state: random(),
				scope: 'openid',
				...extra
			});
			await page.goto(`${auth}?${query}`);
			const sawForm = (await page.locator('#password').count()) > 0;
			if (sawForm && submit) {
				await page.fill('#username', USERNAME);
				await page.fill('#password', PASSWORD);
				await page.click('#kc-login');
				await page.getByRole('heading', { name: 'Done' }).waitFor();
			}
			const landed = new URL(page.url());
			await page.close();
			return { sawForm, code: demo.lastCode, error: landed.searchParams.get('error') };
		};
		const trade = async (clientId: string, code: string) =>
			claimsOf(
				(
					await token(LOCAL_REALM, {
						grant_type: 'authorization_code',
						code,
						redirect_uri: REDIRECT_URI,
						client_id: clientId,
						client_secret: CLIENT_SECRET
					})
				).json.id_token
			);

		const context = await browser.newContext();
		const first = await visit(context, 'note-sso-one');
		const second = await visit(context, 'note-sso-two');
		const firstToken = await trade('note-sso-one', first.code);
		const secondToken = await trade('note-sso-two', second.code);
		const insists = await visit(context, 'note-sso-two', { prompt: 'login' }, false);
		const noForm = await visit(context, 'note-sso-two', { prompt: 'none' });
		const cookie = (await context.cookies()).find(({ name }) => name === 'KEYCLOAK_IDENTITY');
		await context.close();

		const elsewhere = await browser.newContext();
		const noSession = await visit(elsewhere, 'note-sso-two', { prompt: 'none' });
		await elsewhere.close();

		answers.singleSignOn = {
			first: { sawForm: first.sawForm },
			second: { sawForm: second.sawForm, gotACode: Boolean(second.code) },
			sameSession: firstToken.sid === secondToken.sid,
			sameLoginTime: firstToken.auth_time === secondToken.auth_time,
			audiences: [firstToken.aud, secondToken.aud],
			insists: { sawForm: insists.sawForm },
			told: {
				withASession: { sawForm: noForm.sawForm, gotACode: Boolean(noForm.code) },
				inANewBrowser: { sawForm: noSession.sawForm, error: noSession.error }
			},
			cookie: { name: cookie?.name, httpOnly: cookie?.httpOnly, domain: cookie?.domain }
		};

		// How long it lasts. Idle has a two minute margin on top, so Max is the one that can be watched.
		const onRealm = `/realms/${LOCAL_REALM}`;
		const realm = await admin.call<{
			ssoSessionIdleTimeout: number;
			ssoSessionMaxLifespan: number;
		}>('GET', onRealm);
		const before = await browser.newContext();
		await visit(before, 'note-sso-one');
		const stillThere = await visit(before, 'note-sso-two');
		await before.close();
		await admin.call('PUT', onRealm, { ssoSessionMaxLifespan: 3 });
		const after = await browser.newContext();
		await visit(after, 'note-sso-one');
		await new Promise((resolve) => setTimeout(resolve, 4100));
		const gone = await visit(after, 'note-sso-two', {}, false);
		await after.close();
		await admin.call('PUT', onRealm, { ssoSessionMaxLifespan: realm.ssoSessionMaxLifespan });
		answers.ssoSessionMax = {
			before: {
				idle: realm.ssoSessionIdleTimeout,
				max: realm.ssoSessionMaxLifespan,
				secondSawForm: stillThere.sawForm
			},
			after: { max: 3, secondSawForm: gone.sawForm }
		};

		// What logging out ends and what it leaves. One app logs out, and another is told or is not.
		await freshClient(admin, 'note-logout-one', {
			attributes: { 'post.logout.redirect.uris': POST_LOGOUT_URI },
			protocolMappers: [namesTheApi]
		});
		await freshClient(admin, 'note-logout-two', {
			attributes: { 'backchannel.logout.url': BACKCHANNEL_URL }
		});
		await freshClient(admin, 'note-logout-quiet');
		const base = `${KEYCLOAK}/realms/${LOCAL_REALM}/protocol/openid-connect`;
		const tokensFrom = async (clientId: string, code: string) =>
			(
				await token(LOCAL_REALM, {
					grant_type: 'authorization_code',
					code,
					redirect_uri: REDIRECT_URI,
					client_id: clientId,
					client_secret: CLIENT_SECRET
				})
			).json;
		const refreshed = async (clientId: string, refreshToken: string) => {
			const answer = await token(LOCAL_REALM, {
				grant_type: 'refresh_token',
				refresh_token: refreshToken,
				client_id: clientId,
				client_secret: CLIENT_SECRET
			});
			return {
				status: answer.status,
				error: answer.json.error ?? null,
				description: answer.json.error_description ?? null
			};
		};
		const activeFor = async (asker: string, accessToken: string) => {
			const answer = await fetch(`${base}/token/introspect`, {
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({
					token: accessToken,
					client_id: asker,
					client_secret: CLIENT_SECRET
				}).toString()
			});
			return ((await answer.json()) as { active: boolean }).active;
		};
		const logoutAddress = (idToken: string, address: string) =>
			`${base}/logout?${new URLSearchParams({
				id_token_hint: idToken,
				post_logout_redirect_uri: address,
				state: 'kept'
			})}`;

		const twoApps = await browser.newContext();
		const logsOut = await tokensFrom(
			'note-logout-one',
			(await visit(twoApps, 'note-logout-one')).code
		);
		const isTold = await tokensFrom(
			'note-logout-two',
			(await visit(twoApps, 'note-logout-two')).code
		);
		const bearer = { authorization: `Bearer ${logsOut.access_token}` };
		const named = await activeFor(API_CLIENT, logsOut.access_token);
		const notNamed = await activeFor('note-logout-one', logsOut.access_token);
		const onlyTheAppForgets = await visit(twoApps, 'note-logout-one');

		const logoutPage = await twoApps.newPage();
		const notRegistered = await logoutPage.goto(
			logoutAddress(logsOut.id_token, `${APP}/elsewhere`)
		);
		const refused = {
			status: notRegistered?.status(),
			saysInvalidRedirect: (await logoutPage.locator('body').innerText()).includes(
				'Invalid redirect uri'
			)
		};
		demo.logoutTokens.length = 0;
		await logoutPage.goto(logoutAddress(logsOut.id_token, POST_LOGOUT_URI));
		await logoutPage.getByRole('heading', { name: 'Logged out' }).waitFor();
		const backAt = new URL(logoutPage.url());
		await logoutPage.close();
		await new Promise((resolve) => setTimeout(resolve, 500));
		const told = [...demo.logoutTokens];

		const userinfoAddress = `${base}/userinfo`;
		const secondsLeft = Number(claimsOf(logsOut.access_token).exp) - Date.now() / 1000;
		answers.loggingOut = {
			onlyTheAppForgets: { nextLoginSawForm: onlyTheAppForgets.sawForm },
			withAnIdToken: {
				backAtTheApp: backAt.pathname === '/bye',
				state: backAt.searchParams.get('state')
			},
			after: {
				tokenNotExpired: secondsLeft > 0,
				demoApi: (await statusOf(`${API}/resource`, bearer)).status,
				userinfo: (await statusOf(userinfoAddress, bearer)).status,
				otherAppUserinfo: (
					await statusOf(userinfoAddress, { authorization: `Bearer ${isTold.access_token}` })
				).status,
				refresh: await refreshed('note-logout-one', logsOut.refresh_token),
				otherAppRefresh: await refreshed('note-logout-two', isTold.refresh_token),
				otherAppNextLoginSawForm: (await visit(twoApps, 'note-logout-two', {}, false)).sawForm
			}
		};
		answers.whoMayAsk = {
			before: { asker: 'not named in the token', active: notNamed },
			after: { asker: 'named in the token', active: named },
			afterALogout: { active: await activeFor(API_CLIENT, logsOut.access_token) }
		};
		answers.postLogoutAddress = {
			before: refused,
			after: { backAtTheApp: backAt.pathname === '/bye' }
		};
		await twoApps.close();

		// With nothing registered, an app is not told.
		const noAddress = await browser.newContext();
		const logsOutAgain = await tokensFrom(
			'note-logout-one',
			(await visit(noAddress, 'note-logout-one')).code
		);
		await visit(noAddress, 'note-logout-quiet');
		demo.logoutTokens.length = 0;
		const quietPage = await noAddress.newPage();
		await quietPage.goto(logoutAddress(logsOutAgain.id_token, POST_LOGOUT_URI));
		await quietPage.getByRole('heading', { name: 'Logged out' }).waitFor();
		await new Promise((resolve) => setTimeout(resolve, 500));
		answers.backchannelLogoutUrl = {
			before: { delivered: demo.logoutTokens.length },
			after: {
				delivered: told.length,
				hasTheEvent: Boolean(told[0] && claimsOf(told[0]).events),
				aud: told[0] ? claimsOf(told[0]).aud : null
			}
		};
		await noAddress.close();

		// And with no ID token, it has to ask.
		const noHint = await browser.newContext();
		await visit(noHint, 'note-logout-one');
		const askPage = await noHint.newPage();
		await askPage.goto(`${base}/logout`);
		(answers.loggingOut as Record<string, unknown>).withNoIdToken = {
			asks: (await askPage.locator('body').innerText()).includes('Do you want to log out')
		};
		await noHint.close();
	}

	// What is a refresh token worth once a new one has come back? RFC 9700 section 2.2.2 wants a
	// public client's to work once or be tied to the sender.
	{
		const send = (clientId: string, refreshToken: string, extra: Record<string, string>) =>
			token(LOCAL_REALM, {
				grant_type: 'refresh_token',
				refresh_token: refreshToken,
				client_id: clientId,
				...extra
			});
		const said = (result: Awaited<ReturnType<typeof send>>) => ({
			status: result.status,
			error: result.json.error ?? null,
			description: result.json.error_description ?? null
		});
		const secret = { client_secret: CLIENT_SECRET };
		const onRealm = `/realms/${LOCAL_REALM}`;
		const realm = await admin.call<{
			revokeRefreshToken: boolean;
			refreshTokenMaxReuse: number;
			accessTokenLifespan: number;
		}>('GET', onRealm);

		await freshClient(admin, 'note-refresh');
		const first = await tokensFor(browser, demo, 'note-refresh');
		const second = await send('note-refresh', first.json.refresh_token, secret);
		const oldAgain = await send('note-refresh', first.json.refresh_token, secret);
		const withoutTheSecret = await send('note-refresh', second.json.refresh_token, {});

		await freshClient(admin, 'note-refresh-public', { publicClient: true });
		const open = await tokensFor(browser, demo, 'note-refresh-public', {});
		const openSecond = await send('note-refresh-public', open.json.refresh_token, {});
		const openAgain = await send('note-refresh-public', open.json.refresh_token, {});

		await freshClient(admin, 'note-refresh-short', {
			attributes: { 'access.token.lifespan': '1' }
		});
		const { code } = await codeFor(browser, demo, LOCAL_REALM, 'note-refresh-short', {
			scope: 'openid'
		});
		const short = await token(LOCAL_REALM, {
			grant_type: 'authorization_code',
			code,
			redirect_uri: REDIRECT_URI,
			client_id: 'note-refresh-short',
			...secret
		});
		await new Promise((resolve) => setTimeout(resolve, 2100));
		const pastItsLife = await statusOf(
			`${KEYCLOAK}/realms/${LOCAL_REALM}/protocol/openid-connect/userinfo`,
			{ authorization: `Bearer ${short.json.access_token}` }
		);
		const afterThat = await send('note-refresh-short', short.json.refresh_token, secret);

		await admin.call('PUT', onRealm, { revokeRefreshToken: true });
		await freshClient(admin, 'note-refresh-revoke');
		const start = await tokensFor(browser, demo, 'note-refresh-revoke');
		const next = await send('note-refresh-revoke', start.json.refresh_token, secret);
		const reused = await send('note-refresh-revoke', start.json.refresh_token, secret);
		const newest = await send('note-refresh-revoke', next.json.refresh_token, secret);
		await admin.call('PUT', onRealm, { revokeRefreshToken: false });

		answers.refreshTokens = {
			accessTokenLifespan: realm.accessTokenLifespan,
			first: { expiresIn: first.json.expires_in, refreshExpiresIn: first.json.refresh_expires_in },
			refresh: {
				status: second.status,
				cameBackNew: second.json.refresh_token !== first.json.refresh_token
			},
			withoutTheSecret: said(withoutTheSecret),
			pastItsLife: {
				userinfo: pastItsLife.status,
				thenARefresh: afterThat.status,
				idTokenAgain: Boolean(afterThat.json.id_token)
			}
		};
		answers.revokeRefreshToken = {
			before: {
				setting: realm.revokeRefreshToken,
				oldAgain: said(oldAgain),
				oldAgainWithNoSecret: { first: openSecond.status, again: openAgain.status }
			},
			after: { first: next.status, oldAgain: said(reused), newest: said(newest) }
		};
	}

	// Do the tokens someone stole survive the real app then trying the same code? RFC 6749 section
	// 4.1.2 says a server should revoke them.
	{
		const { code } = await codeFor(browser, demo, LOCAL_REALM, PUBLIC_CLIENT, { scope: 'openid' });
		const body = {
			grant_type: 'authorization_code',
			code,
			redirect_uri: REDIRECT_URI,
			client_id: PUBLIC_CLIENT
		};
		const stolen = await token(LOCAL_REALM, body);
		const userinfo = `${KEYCLOAK}/realms/${LOCAL_REALM}/protocol/openid-connect/userinfo`;
		const bearer = { authorization: `Bearer ${stolen.json.access_token}` };
		const looks = async () => ({
			userinfo: (await statusOf(userinfo, bearer)).status,
			demoApi: (await statusOf(`${API}/resource`, bearer)).status
		});
		const before = await looks();
		const theRealApp = await token(LOCAL_REALM, body);
		const after = await looks();
		const refresh = await token(LOCAL_REALM, {
			grant_type: 'refresh_token',
			refresh_token: stolen.json.refresh_token,
			client_id: PUBLIC_CLIENT
		});
		answers.stolenTokensAfterTheRealAppTried = {
			theRealApp: { status: theRealApp.status, description: theRealApp.json.error_description },
			before,
			after,
			refresh: { status: refresh.status, error: refresh.json.error ?? null }
		};
	}

	// The demo's own checks, because a step says it makes them and a recording only shows them pass.
	{
		const proof = proofKey();
		const { code } = await codeFor(browser, demo, LOCAL_REALM, CONFIDENTIAL_CLIENT);
		const url = `${KEYCLOAK}/realms/${LOCAL_REALM}/protocol/openid-connect/token`;
		const bound = await token(LOCAL_REALM, confidentialBody(code), { dpop: proof('POST', url) });
		const accessToken = bound.json.access_token;
		const resource = `${API}/resource`;
		const ath = { ath: sha256(accessToken) };
		const dpop = { authorization: `DPoP ${accessToken}` };
		const used = proof('GET', resource, ath);

		const noAudience = await freshClient(admin, 'note-no-audience');
		const scopes = await admin.call<{ id: string; name: string }[]>(
			'GET',
			`/realms/${LOCAL_REALM}/clients/${noAudience.id}/default-client-scopes`
		);
		for (const scope of scopes.filter(({ name }) => name === 'roles')) {
			await admin.call(
				'DELETE',
				`/realms/${LOCAL_REALM}/clients/${noAudience.id}/default-client-scopes/${scope.id}`
			);
		}
		const other = await tokensFor(browser, demo, 'note-no-audience');
		const stateCheck = await (async () => {
			const run = {
				settings: defaultSettings,
				realm: LOCAL_REALM,
				clientId: CONFIDENTIAL_CLIENT,
				clientSecret: CLIENT_SECRET,
				messages: []
			};
			await demo.discover(run);
			demo.current = run;
			await fetch(APP, { redirect: 'manual' });
			const answer = await fetch(`${APP}/callback?code=whatever&state=not-what-it-sent`);
			demo.current = null;
			return answer.status;
		})();

		answers.theDemoChecks = {
			appWithAnotherState: stateCheck,
			apiWithAGoodProof: (await statusOf(resource, { ...dpop, dpop: used })).status,
			apiWithTheSameProofAgain: (await statusOf(resource, { ...dpop, dpop: used })).status,
			apiWithNoProof: (await statusOf(resource, dpop)).status,
			apiAsBearer: (await statusOf(resource, { authorization: `Bearer ${accessToken}` })).status,
			apiWithAnotherKey: (
				await statusOf(resource, { ...dpop, dpop: proofKey()('GET', resource, ath) })
			).status,
			apiWithANoAudienceToken: {
				aud: claimsOf(other.json.access_token).aud ?? null,
				status: (await statusOf(resource, { authorization: `Bearer ${other.json.access_token}` }))
					.status
			}
		};
	}

	// A wrong redirect URI, which is the most-viewed Keycloak question there is.
	{
		const bad = await fetch(
			`${KEYCLOAK}/realms/${LOCAL_REALM}/protocol/openid-connect/auth?${new URLSearchParams({
				response_type: 'code',
				client_id: CONFIDENTIAL_CLIENT,
				redirect_uri: `${APP}/wrong`,
				state: random()
			})}`,
			{ redirect: 'manual' }
		);
		const text = await bad.text();
		answers.wrongRedirectUri = {
			status: bad.status,
			location: bad.headers.get('location'),
			message: text.match(/Invalid parameter[^<]*/)?.[0] ?? null
		};
	}

	// What a default client gives without openid, which the OpenID Connect switch has to get right.
	{
		const { code } = await codeFor(browser, demo, LOCAL_REALM, CONFIDENTIAL_CLIENT);
		const result = await token(LOCAL_REALM, confidentialBody(code));
		const claims = JSON.parse(
			Buffer.from(result.json.access_token.split('.')[1], 'base64url').toString()
		);
		answers.withoutOpenid = {
			hasIdToken: 'id_token' in result.json,
			accessTokenAudience: claims.aud,
			accessTokenNamesTheUser: 'preferred_username' in claims,
			responseFields: Object.keys(result.json).sort(),
			userinfo: await statusOf(
				`${KEYCLOAK}/realms/${LOCAL_REALM}/protocol/openid-connect/userinfo`,
				{ authorization: `Bearer ${result.json.access_token}` }
			)
		};
	}

	Object.assign(answers, await behindTheBrokeringNotes(browser, demo, admin));
	return answers;
}

export async function questionsWithApiV2(browser: Browser, demo: Demo, admin: Admin) {
	const { proof, accessToken, tokenType } = await dpopBoundBrokeredToken(browser, demo, admin);
	const post = async (headers: Record<string, string>) =>
		outcome(
			await fetch(brokerTokenUrl, {
				method: 'POST',
				headers: {
					'content-type': 'application/x-www-form-urlencoded',
					accept: 'application/json',
					...headers
				},
				body: new URLSearchParams({
					client_id: CONFIDENTIAL_CLIENT,
					client_secret: CLIENT_SECRET,
					token: accessToken
				}).toString()
			})
		);

	// Whether this client may ask at all is a setting of the client.
	const asked = async () => {
		await admin.forgetBrokeredUsers();
		const { code } = await codeFor(browser, demo, BROKERED_REALM, CONFIDENTIAL_CLIENT);
		const result = await token(BROKERED_REALM, confidentialBody(code));
		const answer = await fetch(brokerTokenUrl, {
			method: 'POST',
			headers: {
				'content-type': 'application/x-www-form-urlencoded',
				accept: 'application/json'
			},
			body: new URLSearchParams({
				client_id: CONFIDENTIAL_CLIENT,
				client_secret: CLIENT_SECRET,
				token: result.json.access_token
			}).toString()
		});
		return outcome(answer);
	};
	const allowed = await asked();
	await admin.setClientAttributes(BROKERED_REALM, CONFIDENTIAL_CLIENT, {
		'external.token.enabled': 'false'
	});
	const notAllowed = await asked();
	await admin.setClientAttributes(BROKERED_REALM, CONFIDENTIAL_CLIENT, {
		'external.token.enabled': 'true'
	});

	const onProvider = `/realms/${BROKERED_REALM}/identity-provider/instances/${UPSTREAM_REALM}`;
	const stored = async (storeToken: boolean, inSession: boolean) => {
		const provider = await admin.call<{ config: Record<string, string> }>('GET', onProvider);
		await admin.call('PUT', onProvider, {
			...provider,
			storeToken,
			config: { ...provider.config, storeTokenInSession: String(inSession) }
		});
		return (await asked()).status;
	};
	const storeTokensOnApiV2 = {
		neither: await stored(false, false),
		inSessionOnly: await stored(false, true),
		inDatabaseOnly: await stored(true, false),
		both: await stored(true, true)
	};

	return {
		storeTokensOnApiV2,
		allowExternalTokens: {
			before: { status: allowed.status },
			after: { status: notAllowed.status, says: notAllowed.body }
		},
		apiV2WithDpopToken: {
			tokenType,
			withoutProof: await post({}),
			withProof: await post({
				dpop: proof('POST', brokerTokenUrl, { ath: sha256(accessToken) })
			})
		},
		// The docs do not say whether enabling V2 turns V1 off.
		apiV1WhenV2IsEnabled: await statusOf(brokerTokenUrl, {
			authorization: `Bearer ${accessToken}`
		})
	};
}
