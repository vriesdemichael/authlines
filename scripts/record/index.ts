// Records what a real Keycloak does for each named state. See ADR-005.
//
//   pnpm record                    records against the pinned version and writes the files
//   pnpm record --keycloak 27.0.0  records against another version
//   pnpm record --check            records, writes nothing, and exits 2 if what the screen says no
//                                  longer holds: the shape of a message, a flag, a note's evidence,
//                                  or a page a person gets
//   pnpm record --pages            only takes the pictures of those pages again
//   pnpm record --no-user          only records the flows with no user and no browser
//   pnpm record --presets a,b      only records those named states
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
	chromium,
	type Browser,
	type BrowserContext,
	type Page,
	type Request,
	type Response
} from '@playwright/test';
import {
	authorizationCodeBase as base,
	clientCredentialsBase,
	deviceBase
} from '#lib/flow/index.ts';
import { evidenceDifferences, pagesGone, whatChanged } from '#lib/recordings/check.ts';
import { defaultSettings, flagsInSettings, normalize, type Settings } from '#lib/flow/settings.ts';
import type { ShotId } from '#lib/flow/vocabulary.ts';
import type { FlagStatus, Recording, RecordingIndex } from '#lib/recordings/format.ts';
import { CLIENT_DOCUMENT, Demo, requestMessage, responseMessage, type Run } from './demo.ts';
import {
	COMPANIES_REALM,
	CUSTOMERS,
	OIDC_CUSTOMER,
	PERSON_AT,
	SAML_CUSTOMER,
	forgetCustomersPeople,
	questionsWhenSomeoneLeaves,
	questionsWithCompanies,
	setUpCompanies,
	turnOff
} from './companies.ts';
import {
	ATTACKER_SITE,
	Admin,
	APP,
	BROKERED_REALM,
	CLIENT_SECRET,
	CONFIDENTIAL_CLIENT,
	KEYCLOAK,
	LOCAL_REALM,
	LOOPBACK,
	PASSWORD,
	REDIRECT_URI,
	SECOND_APP,
	SECOND_CLIENT,
	SECOND_REDIRECT_URI,
	SERVICE_CLIENT,
	DEVICE_CLIENT,
	QUICK_DEVICE_CLIENT,
	SOMEONE_ELSE,
	allowClientDocuments,
	connectDirectory,
	DIRECTORY_REALM,
	makeInitialAccessToken,
	setUpFor,
	setUpRealms,
	startKeycloak,
	stopKeycloak,
	UPSTREAM_REALM,
	USERNAME
} from './keycloak.ts';
import { lookInConsole } from './console.ts';
import {
	DIRECTORY_URL,
	directoryLogLength,
	messagesFromTheLog,
	passThrough,
	SERVICE_DN,
	SERVICE_PASSWORD,
	startDirectory,
	stopDirectory,
	USERS_DN
} from './directory.ts';
import { capturePages } from './pages.ts';
import {
	questionsOnADevice,
	questionsWithADirectory,
	questionsWithApiV1,
	questionsWithApiV2,
	questionsWithNoUser,
	questionsWhenPushed,
	questionsWhenExchanged,
	questionsWhenTheApiReads,
	questionsWhenLinked,
	questionsWhenOffline,
	questionsWithAProgram
} from './questions.ts';
import { deviceNoteDefs, noteDefs, noUserNoteDefs } from '#lib/keycloak/notes.ts';

const { presets } = base;

export const PINNED_KEYCLOAK = '26.8.1';
const CIMD_FLAG = 'cimd';
const FOLDER = 'static/recordings/authorization-code';
const INDEX = 'src/lib/recordings/recorded.json';

// Turning on API V2 turns off API V1, which the docs do not say, so each needs a server of its own.
const API_V2_FLAG = 'identity-brokering-api:v2';

const argument = (name: string) => {
	const at = process.argv.indexOf(name);
	return at < 0 ? undefined : process.argv[at + 1];
};
const checking = process.argv.includes('--check');
const onlyPages = process.argv.includes('--pages');
const onlyNoUser = process.argv.includes('--no-user');
const onlyOnADevice = process.argv.includes('--device');
const onlyPresets = argument('--presets')?.split(',');
const version = argument('--keycloak') ?? PINNED_KEYCLOAK;

/** Which step of the diagram a message in the browser is, going by where it went. */
function classifyRequest(url: URL, method = 'GET'): string | null {
	const path = url.pathname;
	if (path === `/realms/${COMPANIES_REALM}/protocol/openid-connect/auth`) return 'authorize';
	if (path.startsWith(`/realms/${COMPANIES_REALM}/login-actions/authenticate`)) {
		return method === 'POST' ? 'submit-email' : null;
	}
	for (const customer of CUSTOMERS) {
		const at = `/realms/${customer}`;
		if (path === `${at}/protocol/openid-connect/auth` || path === `${at}/protocol/saml`) {
			return 'upstream-authorize';
		}
		if (path.startsWith(`${at}/login-actions/authenticate`)) {
			return method === 'POST' ? 'upstream-sign-in' : null;
		}
		if (path.endsWith(`/broker/${customer}/endpoint`)) return 'upstream-callback';
	}
	if (url.origin === ATTACKER_SITE) return 'code-to-attacker';
	// The answer, at the port a program on the user's computer is listening on (#178).
	if (url.hostname === '127.0.0.1' && path === '/callback') return 'callback';
	if (url.origin === SECOND_APP) return path === '/' ? 'second-open-app' : 'second-callback';
	const forSecond = url.searchParams.get('client_id') === SECOND_CLIENT;
	const inOurs = [LOCAL_REALM, BROKERED_REALM].map(
		(realm) => `/realms/${realm}/protocol/openid-connect/auth`
	);
	if (forSecond && inOurs.includes(path)) return 'second-authorize';
	if (forSecond && path.startsWith(`/realms/${LOCAL_REALM}/login-actions/authenticate`)) {
		return 'second-submit-credentials';
	}
	if (path.startsWith(`/realms/${LOCAL_REALM}/login-actions/required-action`)) {
		return method === 'POST' ? 'link-confirm' : null;
	}
	if (url.origin === APP) {
		const steps: Record<string, string> = {
			'/link': 'link-start',
			'/': 'open-app',
			'/callback': 'callback',
			'/logout': 'logout-start',
			'/bye': 'logged-out'
		};
		return steps[path] ?? null;
	}
	if (path.endsWith('/protocol/openid-connect/logout')) return 'end-session';
	if (path === `/realms/${LOCAL_REALM}/protocol/openid-connect/auth`) return 'authorize';
	if (path === `/realms/${BROKERED_REALM}/protocol/openid-connect/auth`) return 'authorize';
	if (path === `/realms/${DIRECTORY_REALM}/protocol/openid-connect/auth`) return 'authorize';
	if (path === `/realms/${UPSTREAM_REALM}/protocol/openid-connect/auth`)
		return 'upstream-authorize';
	if (path.endsWith(`/broker/${UPSTREAM_REALM}/endpoint`)) return 'upstream-callback';
	if (path.startsWith(`/realms/${UPSTREAM_REALM}/login-actions/authenticate`)) {
		return 'upstream-sign-in';
	}
	// Only the form being sent. A pushed request gets there by a redirect first, which is not drawn.
	if (path.startsWith(`/realms/${LOCAL_REALM}/login-actions/authenticate`)) {
		return method === 'POST' ? 'submit-credentials' : null;
	}
	if (path.startsWith(`/realms/${DIRECTORY_REALM}/login-actions/authenticate`)) {
		return 'submit-credentials';
	}
	// With another provider, the question is asked in the realm that hands the login over (#186).
	for (const realm of [LOCAL_REALM, BROKERED_REALM]) {
		if (path.startsWith(`/realms/${realm}/login-actions/consent`)) return 'consent-grant';
	}
	return null;
}

function classifyResponse(
	url: URL,
	status: number,
	location: string | null,
	method = 'GET'
): string | null {
	if (
		url.pathname === `/realms/${COMPANIES_REALM}/protocol/openid-connect/auth` &&
		status === 200
	) {
		return 'email-page';
	}
	for (const customer of CUSTOMERS) {
		// A redirect to OpenID Connect, or with SAML a page with a form that sends itself.
		if (url.pathname === `/realms/${COMPANIES_REALM}/broker/${customer}/login`) {
			return 'redirect-to-upstream';
		}
		if (location?.includes(`/broker/${customer}/endpoint`)) return 'upstream-redirect-back';
		const signedIn = url.pathname.startsWith(`/realms/${customer}/login-actions/authenticate`);
		if (signedIn && method === 'POST' && status === 200) return 'upstream-redirect-back';
	}
	if (url.origin === SECOND_APP) return url.pathname === '/' ? 'second-redirect-to-idp' : null;
	if (location?.startsWith(SECOND_REDIRECT_URI)) return 'second-redirect-with-code';
	if (
		url.searchParams.get('client_id') === SECOND_CLIENT &&
		url.pathname === `/realms/${LOCAL_REALM}/protocol/openid-connect/auth` &&
		status === 200
	) {
		return 'second-login-page';
	}
	if (url.origin === APP) {
		// An app in the page answers with itself, and the redirect is done from there.
		if (status !== 302) return null;
		const steps: Record<string, string> = {
			'/': 'redirect-to-idp',
			'/logout': 'logout-redirect',
			'/link': 'link-ask'
		};
		return steps[url.pathname] ?? null;
	}
	if (url.pathname.endsWith('/protocol/openid-connect/logout')) return 'logout-redirect-back';
	if (url.pathname === `/realms/${LOCAL_REALM}/protocol/openid-connect/auth` && status === 400) {
		return 'address-refused';
	}
	if (location?.startsWith(REDIRECT_URI)) return 'redirect-with-code';
	if (location?.startsWith(`${LOOPBACK}:`)) return 'redirect-with-code';
	if (location?.startsWith(ATTACKER_SITE)) return 'redirect-with-code';
	if (location?.includes(`/realms/${UPSTREAM_REALM}/protocol/openid-connect/auth`)) {
		return 'redirect-to-upstream';
	}
	if (location?.includes(`/broker/${UPSTREAM_REALM}/endpoint`)) return 'upstream-redirect-back';
	if (url.pathname === `/realms/${LOCAL_REALM}/protocol/openid-connect/auth` && status === 200) {
		return 'login-page';
	}
	if (
		url.pathname === `/realms/${DIRECTORY_REALM}/protocol/openid-connect/auth` &&
		status === 200
	) {
		return 'login-page';
	}
	// Where a pushed request is sent on to, for the login form.
	if (
		url.pathname === `/realms/${LOCAL_REALM}/login-actions/authenticate` &&
		method === 'GET' &&
		status === 200
	) {
		return 'login-page';
	}
	if (url.pathname.startsWith(`/realms/${LOCAL_REALM}/login-actions/`) && status === 200) {
		return 'consent-page';
	}
	// Only the question: the first login through another provider goes on by itself here (#186).
	if (
		url.pathname === `/realms/${BROKERED_REALM}/login-actions/required-action` &&
		url.searchParams.get('execution') === 'OAUTH_GRANT' &&
		status === 200
	) {
		return 'consent-page';
	}
	return null;
}

const isDocument = (request: Request) => request.resourceType() === 'document';

const AGAIN: Readonly<Record<string, string>> = {
	authorize: 'login-again',
	'redirect-with-code': 'code-again'
};
/** A link after the login goes the way a login does, and its hops are steps of their own (#179). */
const LINKING: Readonly<Record<string, string>> = {
	'redirect-to-upstream': 'link-to-upstream',
	'upstream-authorize': 'link-upstream-authorize',
	'upstream-sign-in': 'link-upstream-sign-in',
	'upstream-redirect-back': 'link-upstream-back',
	'upstream-callback': 'link-upstream-callback',
	'redirect-with-code': 'link-done',
	callback: 'link-callback',
	authorize: 'link-authorize',
	'consent-page': 'link-confirm-page'
};
const coming = (run: Run, step: string | null) =>
	run.again ? (AGAIN[step ?? ''] ?? null) : run.linking ? (LINKING[step ?? ''] ?? step) : step;

/** A page with a server behind it: the app's addresses mean something else, and the rest is as ever. */
const behindThePage = {
	request(url: URL) {
		if (url.origin !== APP) return classifyRequest(url);
		return (
			{ '/': 'open-app', '/login': 'bff-login', '/callback': 'callback' }[url.pathname] ?? null
		);
	},
	response(url: URL, status: number, location: string | null) {
		if (url.origin !== APP) return classifyResponse(url, status, location);
		return (
			{ '/': 'page-served', '/login': 'redirect-to-idp', '/callback': 'set-session' }[
				url.pathname
			] ?? null
		);
	}
};

/** The one cookie that is the session. The rest of them are how Keycloak keeps its forms going. */
const SESSION_COOKIE = /(?:^|\n|; )(KEYCLOAK_IDENTITY=[^\n]*)/;

/** Which step a message is, going by what it is about, for a login that goes somewhere else. */
const onADevice = {
	request(url: URL, method: string, saysNo: boolean): string | null {
		if (url.pathname === `/realms/${LOCAL_REALM}/device`) {
			return method === 'GET' ? 'open-page' : 'submit-code';
		}
		if (method !== 'POST') return null;
		if (url.pathname.endsWith('/login-actions/authenticate')) return 'submit-credentials';
		if (url.pathname.endsWith('/login-actions/consent')) {
			return saysNo ? 'consent-deny' : 'consent-grant';
		}
		return null;
	},
	response(url: URL, method: string, saysNo: boolean): string | null {
		if (url.pathname === `/realms/${LOCAL_REALM}/device`) {
			return method === 'GET' ? 'code-page' : 'login-page';
		}
		if (method !== 'POST') return null;
		if (url.pathname.endsWith('/login-actions/authenticate')) return 'consent-page';
		if (url.pathname.endsWith('/login-actions/consent')) {
			return saysNo ? 'denied-page' : 'done-page';
		}
		return null;
	}
};

/** Writes down what a page does, in order. Cookies arrive later, so they are added once they do. */
function watch(page: Page, run: Run, cookies: Promise<void>[], device = false) {
	const inBrowser = (url: string) =>
		url.startsWith(APP) ||
		url.startsWith(SECOND_APP) ||
		url.startsWith(KEYCLOAK) ||
		url.startsWith(ATTACKER_SITE) ||
		url.startsWith(`${LOOPBACK}:`);
	const behind = run.settings.appRuns === 'bff';
	// It loads the page and asks again after the login, and the diagram draws that once.
	const once = (step: string | null, direction: 'request' | 'response') =>
		behind &&
		run.messages.some((message) => message.step === step && message.direction === direction)
			? null
			: step;
	page.on('request', (request) => {
		if (!isDocument(request) || !inBrowser(request.url())) return;
		const message = requestMessage(
			coming(
				run,
				device
					? onADevice.request(
							new URL(request.url()),
							request.method(),
							run.settings.deviceEnds === 'says-no'
						)
					: behind
						? once(behindThePage.request(new URL(request.url())), 'request')
						: classifyRequest(new URL(request.url()), request.method())
			),
			request.method(),
			request.url(),
			request.headers(),
			request.postData() ?? ''
		);
		run.messages.push(message);
		if (!request.url().startsWith(KEYCLOAK)) return;
		cookies.push(
			request.allHeaders().then((all) => {
				const session = all.cookie
					?.split('; ')
					.find((part) => part.startsWith('KEYCLOAK_IDENTITY='));
				if (session) message.headers.cookie = session;
			})
		);
	});
	// What a page calls by itself, for an app that runs there.
	const fromThePage: Record<string, [string, string]> = behind
		? {
				'/session': ['session-check', 'no-session'],
				'/api/resource': ['page-calls-api', 'page-gets-answer']
			}
		: {
				'/protocol/openid-connect/token': ['token-request', 'token-response'],
				'/protocol/openid-connect/userinfo': ['userinfo-request', 'userinfo-response'],
				'/resource': ['api-request', 'api-response']
			};
	const calledFromThePage = (request: Request) => {
		if (request.resourceType() !== 'fetch') return null;
		const { pathname } = new URL(request.url());
		const key = Object.keys(fromThePage).find((end) => pathname.endsWith(end));
		return key ? fromThePage[key] : null;
	};
	page.on('request', (request) => {
		const steps = calledFromThePage(request);
		if (!steps) return;
		const step = once(steps[0], 'request');
		const at = run.messages.push(requestMessage(step, request.method(), request.url(), {})) - 1;
		cookies.push(
			request.allHeaders().then((headers) => {
				const message = requestMessage(
					step,
					request.method(),
					request.url(),
					headers,
					request.postData() ?? ''
				);
				// Only here does it mean anything: a form the server sent says only that it has none.
				if (headers.origin) message.headers.origin = headers.origin;
				// What the browser adds by itself, which the script cannot read.
				if (behind && headers.cookie) message.headers.cookie = headers.cookie;
				run.messages[at] = message;
			})
		);
	});
	page.on('response', (response: Response) => {
		const steps = calledFromThePage(response.request());
		if (!steps) return;
		const step = once(steps[1], 'response');
		const at = run.messages.push(responseMessage(step, response.status(), {})) - 1;
		cookies.push(
			Promise.all([response.allHeaders(), response.text()]).then(([headers, text]) => {
				run.messages[at] = responseMessage(step, response.status(), headers, text);
			})
		);
	});
	page.on('response', (response: Response) => {
		if (!isDocument(response.request()) || !inBrowser(response.url())) return;
		const headers = response.headers();
		const step = coming(
			run,
			device
				? onADevice.response(
						new URL(response.url()),
						response.request().method(),
						run.settings.deviceEnds === 'says-no'
					)
				: behind
					? once(
							behindThePage.response(
								new URL(response.url()),
								response.status(),
								headers.location ?? null
							),
							'response'
						)
					: classifyResponse(
							new URL(response.url()),
							response.status(),
							headers.location ?? null,
							response.request().method()
						)
		);
		const message = responseMessage(step, response.status(), headers);
		run.messages.push(message);
		if (step === 'set-session') {
			cookies.push(
				response.allHeaders().then((all) => {
					message.headers['set-cookie'] = all['set-cookie'];
				})
			);
		}
		if (!response.url().startsWith(KEYCLOAK)) return;
		cookies.push(
			response.allHeaders().then((all) => {
				const session = all['set-cookie']?.match(SESSION_COOKIE)?.[1];
				if (session) message.headers['set-cookie'] = session;
			})
		);
	});
}

/** The second app, in the same browser unless the setting says it is a new one. */
async function logInToSecondApp(
	browser: Browser,
	first: BrowserContext,
	run: Run,
	cookies: Promise<void>[]
) {
	const fresh = run.settings.ssoAsks === 'fresh';
	const context = fresh ? await browser.newContext() : first;
	const page = await context.newPage();
	watch(page, run, cookies);
	await page.goto(SECOND_APP);
	if (run.settings.ssoAsks === 'insists') {
		// Only the password, because it knows who they are.
		await page.fill('#password', PASSWORD);
		await page.click('#kc-login');
	}
	await page.getByRole('heading', { name: /Logged in|Not logged in|Failed/ }).waitFor();
	const outcome = await page.locator('body').innerText();
	if (outcome.includes('Failed')) throw new Error(`The second app failed: ${outcome}`);
	if (fresh !== outcome.includes('Not logged in')) throw new Error(`The second app: ${outcome}`);
	if (fresh) await context.close();
}

async function login(browser: Browser, run: Run, demo?: Demo) {
	const context = await browser.newContext();
	const page = await context.newPage();
	const cookies: Promise<void>[] = [];
	watch(page, run, cookies);

	// A link someone else made, which the user opens, so the app has no part in it.
	const link = run.settings.attackerGets === 'link';
	if (link && !demo) throw new Error('A link of theirs needs the demo app to make it');
	// A program on the user's computer opens the browser at the login address itself (#178).
	const program = run.settings.appRuns === 'program';
	if (program && !demo) throw new Error('A program needs the demo app to listen for it');
	await page.goto(
		link && demo ? demo.theirLink() : program && demo ? await demo.startProgram() : APP
	);
	if (run.settings.address === 'other' || (link && run.settings.registered === 'exact')) {
		await page.getByText('Invalid parameter: redirect_uri').waitFor();
		await Promise.all(cookies);
		await context.close();
		return;
	}
	if (run.settings.companies) {
		const { email } =
			PERSON_AT[run.settings.customerSpeaks === 'saml' ? SAML_CUSTOMER : OIDC_CUSTOMER];
		await page.locator('#username').waitFor();
		await page.fill('#username', email);
		await page.click('#kc-login');
		await page.locator('#password').waitFor({ timeout: 15_000 });
	}
	await page.locator('#username').waitFor();
	if (!run.settings.companies) await page.fill('#username', USERNAME);
	else if (!(await page.inputValue('#username'))) {
		const { email } =
			PERSON_AT[run.settings.customerSpeaks === 'saml' ? SAML_CUSTOMER : OIDC_CUSTOMER];
		await page.fill('#username', email);
	}
	await page.fill('#password', PASSWORD);
	await page.click('#kc-login');
	if (run.settings.consent) {
		// The same button id, on the page that asks.
		await page.locator('[name="accept"]').click();
	}
	await page
		.getByRole('heading', { name: /Logged in|Refused|Failed|Got it/ })
		.waitFor({ timeout: 30_000 })
		.catch(async (error) => {
			// A timeout says what it waited for, and what was on the screen is what anyone needs to know.
			const shown = (await page.locator('body').innerText()).slice(0, 400);
			throw new Error(`Stuck at ${page.url()}, showing: ${shown}`, { cause: error });
		});
	await Promise.all(cookies);
	const outcome = await page.locator('body').innerText();
	if (outcome.includes('Failed')) throw new Error(`Login failed: ${outcome}`);
	if (run.settings.sso) await logInToSecondApp(browser, context, run, cookies);
	if (run.settings.linkAccount) {
		await Promise.all(cookies);
		run.linking = true;
		await page.goto(`${APP}/link`);
		const name = run.settings.linkEnds === 'cancelled' ? 'Cancel' : 'Continue';
		await page
			.getByRole('button', { name })
			.or(page.locator(`input[type="submit"][value="${name}"]`))
			.first()
			.click();
		if (run.settings.linkEnds !== 'cancelled') {
			await page.locator('#username').waitFor();
			await page.fill('#username', USERNAME);
			await page.fill('#password', PASSWORD);
			await page.click('#kc-login');
		}
		await page
			.getByRole('heading', { name: /Linked|Not linked/ })
			.waitFor({ timeout: 30_000 })
			.catch(async (error) => {
				const shown = (await page.locator('body').innerText()).slice(0, 400);
				throw new Error(`Linking stuck at ${page.url()}, showing: ${shown}`, { cause: error });
			});
		const said = await page.locator('body').innerText();
		const expected = run.settings.linkEnds !== 'cancelled' ? 'Linked' : 'Not linked';
		if (!said.includes(expected) || (expected === 'Linked' && said.includes('Not linked'))) {
			throw new Error(`The link: ${said}`);
		}
		await Promise.all(cookies);
		run.linking = false;
	}
	if (run.settings.leaves) {
		await Promise.all(cookies);
		run.again = true;
		await page.goto(APP);
		await page.getByRole('heading', { name: 'Back' }).waitFor({ timeout: 15_000 });
		await Promise.all(cookies);
		run.again = false;
	}
	if (run.settings.logout) {
		await page.goto(`${APP}/logout`);
		await page.getByRole('heading', { name: 'Logged out' }).waitFor();
	}
	await Promise.all(cookies);
	await context.close();
}

/** Section 6.1 of RFC 10017 says what a script there can still do, so this asks a real page. */
async function whatAScriptCan(browser: Browser, demo: Demo, admin: Admin) {
	const settings = normalize({
		...defaultSettings,
		appRuns: 'bff',
		clientType: 'confidential',
		pkce: true
	}).settings;
	const run = runFor(settings);
	await setUpFor(admin, run.realm, settings);
	await demo.discover(run);
	demo.current = run;
	const context = await browser.newContext();
	const page = await context.newPage();
	await page.goto(APP);
	await page.locator('#username').waitFor();
	await page.fill('#username', USERNAME);
	await page.fill('#password', PASSWORD);
	await page.click('#kc-login');
	await page.getByRole('heading', { name: 'Logged in' }).waitFor({ timeout: 30_000 });
	const seen = await page.evaluate(async () => ({
		cookies: document.cookie,
		stored: JSON.stringify({ ...localStorage, ...sessionStorage }),
		throughTheServer: (await fetch('/api/resource')).status
	}));
	await context.close();
	demo.current = null;
	return {
		scriptBehindThePage: {
			readsTheCookie: seen.cookies.includes('session'),
			findsAToken: seen.stored.includes('eyJ'),
			throughTheServer: seen.throughTheServer
		}
	};
}

/** Adds answers asked on their own, with when, because the file's date is when all of them were. */
function addToQuestions(
	on: string,
	answers: Record<string, unknown>,
	looked: Record<string, unknown> = {}
) {
	const file = `${FOLDER}/questions.json`;
	const asked = JSON.parse(readFileSync(file, 'utf8'));
	Object.assign(asked.answers, answers);
	Object.assign(asked.answers.console, looked);
	const keys = [...Object.keys(answers), ...Object.keys(looked).map((page) => `console.${page}`)];
	asked.askedOn = { ...asked.askedOn, ...Object.fromEntries(keys.map((key) => [key, on])) };
	writeFileSync(file, `${JSON.stringify(asked, null, '\t')}\n`);
}

function runFor(settings: Settings): Run {
	return {
		settings,
		realm: settings.companies
			? COMPANIES_REALM
			: settings.federation
				? DIRECTORY_REALM
				: settings.broker
					? BROKERED_REALM
					: LOCAL_REALM,
		clientId: CONFIDENTIAL_CLIENT,
		clientSecret: settings.clientType === 'public' ? null : CLIENT_SECRET,
		messages: []
	};
}

async function record(
	browser: Browser,
	demo: Demo,
	admin: Admin,
	preset: (typeof presets)[number]
) {
	const settings = normalize({ ...defaultSettings, ...preset.settings }).settings;
	const run = runFor(settings);
	if (settings.oldWay) {
		demo.current = run;
		await demo.theOldWay(run);
		demo.current = null;
		return run;
	}
	await setUpFor(admin, run.realm, settings);
	if (settings.registration === 'cimd') {
		await allowClientDocuments(admin, run.realm);
		run.clientId = CLIENT_DOCUMENT;
		run.clientSecret = null;
	}

	// Setup's one HTTP exchange. Everything else in setup is people, or the admin calls in keycloak.ts.
	await demo.discover(
		run,
		settings.registration === 'dcr' ? await makeInitialAccessToken(admin, run.realm) : undefined
	);

	await admin.forgetBrokeredUsers();
	await forgetCustomersPeople(admin);
	demo.current = run;
	if (settings.federation) await loginThroughTheDirectory(browser, admin, run);
	else {
		const customer = settings.customerSpeaks === 'saml' ? SAML_CUSTOMER : OIDC_CUSTOMER;
		if (settings.leaves) demo.meanwhile = () => turnOff(admin, customer);
		try {
			await login(browser, run, demo);
		} finally {
			demo.meanwhile = null;
			if (settings.leaves) await turnOff(admin, customer, false);
			if (settings.appRuns === 'program') await demo.stopProgram();
		}
	}
	demo.current = null;
	return run;
}

/** The same login, with a real LDAP server behind it, and what that was asked put where it happened. */
async function loginThroughTheDirectory(browser: Browser, admin: Admin, run: Run) {
	await startDirectory();
	const connection = passThrough();
	try {
		await connectDirectory(admin, DIRECTORY_URL, USERS_DN, SERVICE_DN, SERVICE_PASSWORD);
		const before = directoryLogLength();
		await login(browser, run);
		const at = run.messages.findIndex(({ step }) => step === 'submit-credentials');
		if (at < 0) throw new Error('This login has no step where the password is submitted.');
		run.messages.splice(at + 1, 0, ...messagesFromTheLog(before, connection.sawPassword()));
	} finally {
		connection.stop();
		stopDirectory();
	}
}

/** No user and no browser, so it is only what the app sends and gets, and the real server's keys. */
async function recordWithNoUser(demo: Demo, keycloak: string, recordedAt: string) {
	const recordings: Recording[] = [];
	for (const preset of clientCredentialsBase.presets) {
		const settings = normalize({ ...defaultSettings, ...preset.settings }).settings;
		const run: Run = {
			settings,
			realm: LOCAL_REALM,
			clientId: SERVICE_CLIENT,
			clientSecret: CLIENT_SECRET,
			messages: []
		};
		await demo.discover(run);
		demo.current = run;
		await demo.asItself(run);
		demo.current = null;
		console.log(`${preset.id}: ${run.messages.length} messages`);
		// The same messages as in the other flow, and a step id only ever means one thing.
		const messages = run.messages.map((message) => ({
			...message,
			step: message.step && `service-${message.step}`
		}));
		recordings.push({ preset: preset.id, keycloak, recordedAt, settings, messages });
	}
	return recordings;
}

function writeWithNoUser(recordings: readonly Recording[]) {
	const folder = `static/recordings/${clientCredentialsBase.id}`;
	mkdirSync(folder, { recursive: true });
	for (const recording of recordings) {
		writeFileSync(
			`${folder}/${recording.preset}.json`,
			`${JSON.stringify(recording, null, '\t')}\n`
		);
	}
	const known = new Set(
		Object.values(clientCredentialsBase.diagrams).flatMap(({ steps }) => steps.map(({ id }) => id))
	);
	const steps = new Set(recordings.flatMap((r) => r.messages.flatMap((m) => m.step ?? [])));
	for (const step of steps) {
		if (!known.has(step)) throw new Error(`Recorded a step the model does not have: ${step}`);
	}
	return {
		[clientCredentialsBase.id]: {
			presets: clientCredentialsBase.presets.map((preset) => preset.id),
			steps: [...steps].sort()
		}
	};
}

/** A browser somewhere else, which only ever talks to the identity provider. */
async function logInElsewhere(
	browser: Browser,
	run: Run,
	address: string,
	userCode: string,
	who = USERNAME
) {
	const context = await browser.newContext();
	const page = await context.newPage();
	const cookies: Promise<void>[] = [];
	watch(page, run, cookies, true);
	await page.goto(address);
	await page.fill('[name="device_user_code"]', userCode);
	await page.click('[type="submit"]');
	await page.locator('#username').waitFor();
	await page.fill('#username', who);
	await page.fill('#password', PASSWORD);
	await page.click('#kc-login');
	if (run.settings.deviceEnds === 'says-no') {
		await page.locator('[name="cancel"]').click();
		await page.getByText('Consent denied').waitFor();
	} else {
		await page.locator('[name="accept"]').click();
		await page.getByText('Device Login Successful').waitFor();
	}
	await Promise.all(cookies);
	await context.close();
}

/** Someone who read the code finishes first, in a browser of their own, and then the user tries. */
async function getThereFirst(browser: Browser, run: Run, address: string, userCode: string) {
	const from = run.messages.length;
	await logInElsewhere(browser, run, address, userCode, SOMEONE_ELSE);
	const drawn: Record<string, string> = {
		'submit-code': 'read-submit-code',
		'submit-credentials': 'read-submit-credentials',
		'consent-grant': 'read-agree'
	};
	for (const message of run.messages.slice(from)) {
		message.step = (message.step && drawn[message.step]) ?? null;
	}

	const tried = run.messages.length;
	const context = await browser.newContext();
	const page = await context.newPage();
	const cookies: Promise<void>[] = [];
	watch(page, run, cookies, true);
	await page.goto(address);
	await page.fill('[name="device_user_code"]', userCode);
	await page.click('[type="submit"]');
	await page.getByText('Invalid code').waitFor();
	await Promise.all(cookies);
	await context.close();
	for (const message of run.messages.slice(tried)) {
		if (message.step === 'login-page') message.step = 'read-code-refused';
	}
}

// To the identity provider they are the app, so these are the same requests, drawn coming from them.
const THEIRS = new Set([
	'request',
	'response',
	'poll',
	'pending',
	'poll-again',
	'token-response',
	'denied-response',
	'expired-response',
	'api-request',
	'api-response'
]);

async function recordDevice(browser: Browser, demo: Demo, keycloak: string, recordedAt: string) {
	const recordings: Recording[] = [];
	for (const preset of deviceBase.presets) {
		const settings = normalize({ ...defaultSettings, ...preset.settings }).settings;
		const run: Run = {
			settings,
			realm: LOCAL_REALM,
			clientId: settings.deviceEnds === 'runs-out' ? QUICK_DEVICE_CLIENT : DEVICE_CLIENT,
			clientSecret: null,
			messages: []
		};
		await demo.discover(run);
		demo.current = run;
		await demo.onADevice(run, (address, code) =>
			settings.deviceAttack === 'reads-code'
				? getThereFirst(browser, run, address, code)
				: logInElsewhere(browser, run, address, code)
		);
		demo.current = null;
		console.log(`${preset.id}: ${run.messages.length} messages`);
		const named = (step: string) => {
			if (step.startsWith('read-')) return step;
			return settings.deviceAttack === 'sends-code' && THEIRS.has(step)
				? `sent-${step}`
				: `device-${step}`;
		};
		const messages = run.messages.map((message) => ({
			...message,
			step: message.step && named(message.step)
		}));
		// Not a setting on this flow, and not what the run's settings would otherwise say.
		const asRun: Settings = { ...settings, clientType: 'public' };
		recordings.push({ preset: preset.id, keycloak, recordedAt, settings: asRun, messages });
	}
	return recordings;
}

function writeDevice(recordings: readonly Recording[]) {
	const folder = `static/recordings/${deviceBase.id}`;
	mkdirSync(folder, { recursive: true });
	for (const recording of recordings) {
		writeFileSync(
			`${folder}/${recording.preset}.json`,
			`${JSON.stringify(recording, null, '\t')}\n`
		);
	}
	const known = new Set(
		Object.values(deviceBase.diagrams).flatMap(({ steps }) => steps.map(({ id }) => id))
	);
	const steps = new Set(recordings.flatMap((r) => r.messages.flatMap((m) => m.step ?? [])));
	for (const step of steps) {
		if (!known.has(step)) throw new Error(`Recorded a step the model does not have: ${step}`);
	}
	return {
		[deviceBase.id]: {
			presets: deviceBase.presets.map((preset) => preset.id),
			steps: [...steps].sort()
		}
	};
}

async function recordOnlyOnADevice() {
	const demo = new Demo();
	await demo.start();
	const browser = await chromium.launch();
	try {
		await startKeycloak(version, []);
		const admin = await Admin.connect();
		await setUpRealms(admin);
		await setUpCompanies(admin);
		const keycloak = await admin.serverVersion();
		const recordedAt = new Date().toISOString().slice(0, 10);
		const recordings = await recordDevice(browser, demo, keycloak, recordedAt);
		const answers = {
			...(await questionsOnADevice(browser, admin)),
			console: await lookInConsole(browser, admin, [], deviceNoteDefs)
		};
		const written = writeDevice(recordings);
		writeFileSync(
			`static/recordings/${deviceBase.id}/questions.json`,
			`${JSON.stringify({ keycloak, answers }, null, '\t')}\n`
		);
		const index = JSON.parse(readFileSync(INDEX, 'utf8')) as RecordingIndex;
		const flows = { ...index.flows, ...written };
		const recordedOn = {
			...index.recordedOn,
			...Object.fromEntries(recordings.map(({ preset, recordedAt: on }) => [preset, on]))
		};
		writeFileSync(INDEX, `${JSON.stringify({ ...index, recordedOn, flows }, null, '\t')}\n`);
		const differences = evidenceDifferences(answers, deviceNoteDefs);
		if (differences.length) console.log(differences.join('\n'));
	} finally {
		await browser.close();
		demo.stop();
		stopKeycloak();
	}
	process.exit(0);
}

/** Only that flow, because a whole run changes every value in every recording. */
async function recordOnlyWithNoUser() {
	const demo = new Demo();
	await demo.start();
	try {
		await startKeycloak(version, []);
		const admin = await Admin.connect();
		await setUpRealms(admin);
		await setUpCompanies(admin);
		const keycloak = await admin.serverVersion();
		const recordings = await recordWithNoUser(
			demo,
			keycloak,
			new Date().toISOString().slice(0, 10)
		);
		const browser = await chromium.launch();
		const answers = {
			...(await questionsWithNoUser(admin)),
			console: await lookInConsole(browser, admin, [], noUserNoteDefs)
		};
		await browser.close();
		writeFileSync(
			`static/recordings/${clientCredentialsBase.id}/questions.json`,
			`${JSON.stringify({ keycloak, answers }, null, '\t')}\n`
		);
		const index = JSON.parse(readFileSync(INDEX, 'utf8')) as RecordingIndex;
		const flows = { ...index.flows, ...writeWithNoUser(recordings) };
		const recordedOn = {
			...index.recordedOn,
			...Object.fromEntries(recordings.map(({ preset, recordedAt }) => [preset, recordedAt]))
		};
		writeFileSync(INDEX, `${JSON.stringify({ ...index, recordedOn, flows }, null, '\t')}\n`);
	} finally {
		demo.stop();
		stopKeycloak();
	}
	process.exit(0);
}

interface ServerFeature extends FlagStatus {
	name: string;
}

/** The flags the settings name, in what a server on its defaults says about them. */
function flagsFrom(features: readonly ServerFeature[]): Record<string, FlagStatus> {
	return Object.fromEntries(
		[
			...new Set(
				[...flagsInSettings(), ...noteDefs.flatMap(({ flag }) => flag ?? [])].map(
					({ name }) => name
				)
			)
		].map((name) => {
			const onServer = name.toUpperCase().replaceAll(/[-:]/g, '_');
			const found = features.find((feature) => feature.name === onServer);
			if (!found) throw new Error(`The server has no feature ${onServer}`);
			return [name, { type: found.type, enabled: found.enabled }];
		})
	);
}

function indexOf(
	recordings: Recording[],
	keycloak: string,
	recordedAt: string,
	flags: Record<string, FlagStatus>
): RecordingIndex {
	const known = new Set(
		[...base.diagrams.flow.steps, ...base.diagrams.setup.steps].map((step) => step.id)
	);
	const steps = new Set(recordings.flatMap((r) => r.messages.flatMap((m) => m.step ?? [])));
	for (const step of steps) {
		if (!known.has(step)) throw new Error(`Recorded a step the model does not have: ${step}`);
	}
	return {
		keycloak,
		recordedAt,
		flows: { [base.id]: { presets: presets.map((preset) => preset.id), steps: [...steps].sort() } },
		flags
	};
}

const needsV2 = (preset: (typeof presets)[number]) => preset.settings.upstreamTokens === 'v2';
const needsCimd = (preset: (typeof presets)[number]) => preset.settings.registration === 'cimd';

/** Only those, because a whole run changes every value in every recording. */
async function recordOnlyPresets(ids: readonly string[]) {
	const demo = new Demo();
	await demo.start();
	const browser = await chromium.launch();
	try {
		// One or the other, because the flag changes what discovery says for everything recorded with it.
		// API V2 turns V1 off, so a run that needs it has nothing else in it either.
		const wanted = presets.filter(({ id }) => ids.includes(id));
		const features = wanted.some(needsCimd)
			? [CIMD_FLAG]
			: wanted.some(needsV2)
				? [API_V2_FLAG]
				: [];
		const mixed = wanted.some(needsV2) && wanted.some((preset) => !needsV2(preset));
		if (mixed || (wanted.some(needsV2) && wanted.some(needsCimd))) {
			throw new Error('Record presets that need API V2 on their own, because it turns V1 off');
		}
		// The flag shows in discovery, so a preset with no document recorded beside one would say it (#186).
		if (wanted.some(needsCimd) && wanted.some((preset) => !needsCimd(preset))) {
			throw new Error(
				'Record presets that point at a document on their own, because the flag changes discovery'
			);
		}
		await startKeycloak(version, features);
		const admin = await Admin.connect();
		const keycloak = await admin.serverVersion();
		await setUpRealms(admin);
		await setUpCompanies(admin);
		const recordedAt = new Date().toISOString().slice(0, 10);
		const index = JSON.parse(readFileSync(INDEX, 'utf8')) as RecordingIndex;
		const steps = new Set(index.flows[base.id].steps);
		const recordedOn = { ...index.recordedOn };
		for (const id of ids) {
			const preset = presets.find((candidate) => candidate.id === id);
			if (!preset) throw new Error(`No named state ${id}`);
			const run = await record(browser, demo, admin, preset);
			console.log(`${id}: ${run.messages.length} messages`);
			for (const message of run.messages) if (message.step) steps.add(message.step);
			const recording: Recording = {
				preset: id,
				keycloak,
				recordedAt,
				settings: run.settings,
				messages: run.messages
			};
			writeFileSync(`${FOLDER}/${id}.json`, `${JSON.stringify(recording, null, '\t')}\n`);
			recordedOn[id] = recordedAt;
		}
		if (wanted.some(({ settings }) => settings.federation)) {
			const directoryNotes = noteDefs.filter(({ place }) => place?.page === 'directory-settings');
			const looked = await lookInConsole(browser, admin, [], directoryNotes);
			addToQuestions(recordedAt, await questionsWithADirectory(admin), looked);
		}
		if (wanted.some(({ settings }) => settings.par)) {
			const parNotes = noteDefs.filter(({ id }) =>
				['require-par', 'par-lifespan', 'redirect-checked-at-push'].includes(id)
			);
			const looked = await lookInConsole(browser, admin, [], parNotes);
			addToQuestions(recordedAt, await questionsWhenPushed(admin), looked);
		}
		if (wanted.some(({ settings }) => settings.exchange)) {
			const exchangeNotes = noteDefs.filter(({ id }) =>
				[
					'standard-token-exchange',
					'exchange-audience',
					'exchange-subject',
					'exchange-refresh'
				].includes(id)
			);
			// On its defaults again, so the console shows a client with nothing added, as the notes do.
			await setUpFor(admin, LOCAL_REALM, {
				clientType: 'confidential',
				consent: false,
				upstreamTokens: 'v1'
			});
			const looked = await lookInConsole(browser, admin, [], exchangeNotes);
			addToQuestions(recordedAt, await questionsWhenExchanged(admin), looked);
		}
		// A preset names only what it changes, so one that does not name a reader is the app reading.
		if (wanted.some(({ settings }) => (settings.upstreamReader ?? 'app') !== 'app')) {
			const readerNotes = noteDefs.filter(({ id }) => id === 'api-reads-external-tokens');
			const looked = await lookInConsole(browser, admin, features, readerNotes);
			addToQuestions(recordedAt, await questionsWhenTheApiReads(browser, demo, admin), looked);
		}
		if (wanted.some(({ settings }) => settings.logoutKeeps === 'offline')) {
			const offlineNotes = noteDefs.filter(({ id }) =>
				['session-lifetimes', 'offline-session-lifetimes'].includes(id)
			);
			const looked = await lookInConsole(browser, admin, [], offlineNotes);
			addToQuestions(recordedAt, await questionsWhenOffline(admin), looked);
		}
		if (wanted.some(({ settings }) => settings.appRuns === 'program')) {
			const programNotes = noteDefs.filter(({ id }) => id === 'loopback-redirects');
			const looked = await lookInConsole(browser, admin, [], programNotes);
			addToQuestions(recordedAt, await questionsWithAProgram(admin), looked);
		}
		if (wanted.some(({ settings }) => settings.linkAccount)) {
			addToQuestions(recordedAt, await questionsWhenLinked(browser, demo, admin));
		}
		if (wanted.some(({ settings }) => settings.appRuns === 'bff')) {
			addToQuestions(recordedAt, await whatAScriptCan(browser, demo, admin));
		}
		if (wanted.some(({ settings }) => settings.leaves)) {
			addToQuestions(recordedAt, await questionsWhenSomeoneLeaves(browser, admin));
		}
		if (wanted.some(({ settings }) => settings.companies)) {
			const domainNotes = noteDefs.filter(({ place }) => place?.page === 'organization-domains');
			const looked = await lookInConsole(browser, admin, [], domainNotes);
			addToQuestions(recordedAt, await questionsWithCompanies(admin), looked);
		}
		const flow = { presets: presets.map(({ id }) => id), steps: [...steps].sort() };
		const flows = { ...index.flows, [base.id]: flow };
		// What a server on its defaults says about each flag, which one started with a flag would not.
		const flags = wanted.some(needsCimd)
			? index.flags
			: {
					...index.flags,
					...flagsFrom(
						(await admin.call<{ features: ServerFeature[] }>('GET', '/serverinfo')).features
					)
				};
		writeFileSync(INDEX, `${JSON.stringify({ ...index, recordedOn, flows, flags }, null, '\t')}\n`);
	} finally {
		await browser.close();
		demo.stop();
		stopKeycloak();
	}
	process.exit(0);
}

/** Only the pictures, because a whole run changes every value in every recording. */
async function takePictures() {
	const demo = new Demo();
	await demo.start();
	const browser = await chromium.launch();
	try {
		await startKeycloak(version, []);
		const admin = await Admin.connect();
		await setUpRealms(admin);
		await setUpCompanies(admin);
		const onDefaults = {
			clientType: 'confidential',
			consent: false,
			upstreamTokens: 'v1'
		} as const;
		await setUpFor(admin, LOCAL_REALM, onDefaults);
		await setUpFor(admin, BROKERED_REALM, onDefaults);
		const gone = pagesGone(await capturePages(browser, admin, true));
		if (gone.length) throw new Error(gone.join('\n'));
	} finally {
		await browser.close();
		demo.stop();
		stopKeycloak();
	}
	process.exit(0);
}

async function main() {
	const demo = new Demo();
	await demo.start();
	const browser = await chromium.launch();
	const recordedAt = new Date().toISOString().slice(0, 10);
	const recordings: Recording[] = [];
	let withNoUser: Recording[] = [];
	let noUserAnswers: Record<string, unknown> = {};
	let onDevice: Recording[] = [];
	let deviceAnswers: Record<string, unknown> = {};
	const answers: Record<string, unknown> = {};
	let flags: Record<string, FlagStatus> = {};
	const inConsole: Record<string, unknown> = {};
	let keycloak = version;
	let failed = false;
	let pagesSeen: ShotId[] = [];

	try {
		for (const [features, wanted, questions] of [
			[[], presets.filter((preset) => !needsV2(preset) && !needsCimd(preset)), questionsWithApiV1],
			[
				[API_V2_FLAG],
				presets.filter(needsV2),
				async (browser: Browser, demo: Demo, admin: Admin) => ({
					...(await questionsWithApiV2(browser, demo, admin)),
					...(await questionsWhenTheApiReads(browser, demo, admin))
				})
			],
			[[CIMD_FLAG], presets.filter(needsCimd), async () => ({})]
		] as const) {
			console.log(`Starting Keycloak ${version} ${features.join(' ')}`);
			await startKeycloak(version, features);
			const admin = await Admin.connect();
			keycloak = await admin.serverVersion();
			await setUpRealms(admin);
			await setUpCompanies(admin);

			for (const preset of wanted) {
				const run = await record(browser, demo, admin, preset);
				console.log(`${preset.id}: ${run.messages.length} messages`);
				recordings.push({
					preset: preset.id,
					keycloak,
					recordedAt,
					settings: run.settings,
					messages: run.messages
				});
			}
			const forQuestions = {
				clientType: 'confidential',
				consent: false,
				upstreamTokens: features.length ? 'v2' : 'v1'
			} as const;
			await setUpFor(admin, LOCAL_REALM, forQuestions);
			await setUpFor(admin, BROKERED_REALM, forQuestions);
			if (!features.length) {
				withNoUser = await recordWithNoUser(demo, keycloak, recordedAt);
				noUserAnswers = {
					...(await questionsWithNoUser(admin)),
					console: await lookInConsole(browser, admin, [], noUserNoteDefs)
				};
				onDevice = await recordDevice(browser, demo, keycloak, recordedAt);
				deviceAnswers = {
					...(await questionsOnADevice(browser, admin)),
					console: await lookInConsole(browser, admin, [], deviceNoteDefs)
				};
				pagesSeen = await capturePages(browser, admin, !checking);
			}
			Object.assign(inConsole, await lookInConsole(browser, admin, features));
			Object.assign(answers, await questions(browser, demo, admin));
			if (!features.length) {
				Object.assign(answers, await questionsWithADirectory(admin));
				Object.assign(answers, await questionsWhenExchanged(admin));
				Object.assign(answers, await questionsWhenLinked(browser, demo, admin));
				Object.assign(answers, await questionsWhenOffline(admin));
				Object.assign(answers, await questionsWithAProgram(admin));
				Object.assign(answers, await whatAScriptCan(browser, demo, admin));
				Object.assign(answers, await questionsWithCompanies(admin));
				Object.assign(answers, await questionsWhenSomeoneLeaves(browser, admin));
			}
			if (!features.length) {
				const info = await admin.call<{ features: ServerFeature[] }>('GET', '/serverinfo');
				flags = flagsFrom(info.features);
			}
			stopKeycloak();
		}
		answers.console = inConsole;
		console.log(JSON.stringify(answers, null, '\t'));

		if (checking) {
			const committedIndex = JSON.parse(readFileSync(INDEX, 'utf8')) as RecordingIndex;
			// As it would be written, because a key holding nothing is gone from the file and not from memory.
			const asWritten = (recording: Recording) =>
				JSON.parse(JSON.stringify(recording)) as Recording;
			const changes = [
				...whatChanged({
					recordings: [
						...recordings.map((now) => ({
							committed: JSON.parse(
								readFileSync(`${FOLDER}/${now.preset}.json`, 'utf8')
							) as Recording,
							now: asWritten(now)
						})),
						...withNoUser.map((now) => ({
							committed: JSON.parse(
								readFileSync(
									`static/recordings/${clientCredentialsBase.id}/${now.preset}.json`,
									'utf8'
								)
							) as Recording,
							now: asWritten(now)
						})),
						...onDevice.map((now) => ({
							committed: JSON.parse(
								readFileSync(`static/recordings/${deviceBase.id}/${now.preset}.json`, 'utf8')
							) as Recording,
							now: asWritten(now)
						}))
					],
					flags: { committed: committedIndex.flags, now: flags },
					answers
				}),
				...pagesGone(pagesSeen),
				...evidenceDifferences(noUserAnswers, noUserNoteDefs),
				...evidenceDifferences(deviceAnswers, deviceNoteDefs)
			];
			failed = changes.length > 0;
			console.log(
				failed
					? `\nWhat the screen says no longer holds:\n${changes.join('\n')}`
					: '\nWhat the screen says still holds.'
			);
			// What this run recorded, kept apart, so that a difference that comes from where it ran
			// rather than from the server can be committed from where the check runs.
			if (failed) {
				const keep = (folder: string, all: readonly Recording[]) => {
					mkdirSync(`drift/${folder}`, { recursive: true });
					for (const recording of all) {
						writeFileSync(
							`drift/${folder}/${recording.preset}.json`,
							`${JSON.stringify(recording, null, '\t')}\n`
						);
					}
				};
				keep(FOLDER, recordings);
				keep(`static/recordings/${clientCredentialsBase.id}`, withNoUser);
				keep(`static/recordings/${deviceBase.id}`, onDevice);
			}
		} else {
			mkdirSync(FOLDER, { recursive: true });
			const write = (path: string, value: unknown) =>
				writeFileSync(path, `${JSON.stringify(value, null, '\t')}\n`);
			for (const recording of recordings) write(`${FOLDER}/${recording.preset}.json`, recording);
			write(`${FOLDER}/questions.json`, { keycloak, recordedAt, answers });
			// Only this flow's entry, because this run says nothing about another flow's recordings.
			const others = JSON.parse(readFileSync(INDEX, 'utf8')) as RecordingIndex;
			const index = indexOf(recordings, keycloak, recordedAt, flags);
			const noUser = writeWithNoUser(withNoUser);
			write(`static/recordings/${clientCredentialsBase.id}/questions.json`, {
				keycloak,
				answers: noUserAnswers
			});
			const devices = writeDevice(onDevice);
			write(`static/recordings/${deviceBase.id}/questions.json`, {
				keycloak,
				answers: deviceAnswers
			});
			write(INDEX, { ...index, flows: { ...others.flows, ...index.flows, ...noUser, ...devices } });
		}
	} finally {
		await browser.close();
		demo.stop();
		stopKeycloak();
	}
	process.exit(failed ? 2 : 0);
}

await (onlyPages
	? takePictures()
	: onlyNoUser
		? recordOnlyWithNoUser()
		: onlyOnADevice
			? recordOnlyOnADevice()
			: onlyPresets
				? recordOnlyPresets(onlyPresets)
				: main());
