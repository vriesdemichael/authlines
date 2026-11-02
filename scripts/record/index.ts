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
import { Demo, requestMessage, responseMessage, type Run } from './demo.ts';
import {
	Admin,
	APP,
	BROKERED_REALM,
	CLIENT_SECRET,
	CONFIDENTIAL_CLIENT,
	KEYCLOAK,
	LOCAL_REALM,
	PASSWORD,
	REDIRECT_URI,
	SECOND_APP,
	SECOND_CLIENT,
	SECOND_REDIRECT_URI,
	SERVICE_CLIENT,
	DEVICE_CLIENT,
	QUICK_DEVICE_CLIENT,
	SOMEONE_ELSE,
	setUpFor,
	setUpRealms,
	startKeycloak,
	stopKeycloak,
	UPSTREAM_REALM,
	USERNAME
} from './keycloak.ts';
import { lookInConsole } from './console.ts';
import { capturePages } from './pages.ts';
import {
	questionsOnADevice,
	questionsWithApiV1,
	questionsWithApiV2,
	questionsWithNoUser
} from './questions.ts';
import { deviceNoteDefs, noUserNoteDefs } from '#lib/keycloak/notes.ts';

const { presets } = base;

export const PINNED_KEYCLOAK = '26.8.1';
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
function classifyRequest(url: URL): string | null {
	const path = url.pathname;
	if (url.origin === SECOND_APP) return path === '/' ? 'second-open-app' : 'second-callback';
	const forSecond = url.searchParams.get('client_id') === SECOND_CLIENT;
	if (forSecond && path === `/realms/${LOCAL_REALM}/protocol/openid-connect/auth`) {
		return 'second-authorize';
	}
	if (forSecond && path.startsWith(`/realms/${LOCAL_REALM}/login-actions/authenticate`)) {
		return 'second-submit-credentials';
	}
	if (url.origin === APP) {
		const steps: Record<string, string> = {
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
	if (path === `/realms/${UPSTREAM_REALM}/protocol/openid-connect/auth`)
		return 'upstream-authorize';
	if (path.endsWith(`/broker/${UPSTREAM_REALM}/endpoint`)) return 'upstream-callback';
	if (path.startsWith(`/realms/${UPSTREAM_REALM}/login-actions/authenticate`)) {
		return 'upstream-sign-in';
	}
	if (path.startsWith(`/realms/${LOCAL_REALM}/login-actions/authenticate`)) {
		return 'submit-credentials';
	}
	if (path.startsWith(`/realms/${LOCAL_REALM}/login-actions/consent`)) return 'consent-grant';
	return null;
}

function classifyResponse(url: URL, status: number, location: string | null): string | null {
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
		const steps: Record<string, string> = { '/': 'redirect-to-idp', '/logout': 'logout-redirect' };
		return steps[url.pathname] ?? null;
	}
	if (url.pathname.endsWith('/protocol/openid-connect/logout')) return 'logout-redirect-back';
	if (url.pathname === `/realms/${LOCAL_REALM}/protocol/openid-connect/auth` && status === 400) {
		return 'address-refused';
	}
	if (location?.startsWith(REDIRECT_URI)) return 'redirect-with-code';
	if (location?.includes(`/realms/${UPSTREAM_REALM}/protocol/openid-connect/auth`)) {
		return 'redirect-to-upstream';
	}
	if (location?.includes(`/broker/${UPSTREAM_REALM}/endpoint`)) return 'upstream-redirect-back';
	if (url.pathname === `/realms/${LOCAL_REALM}/protocol/openid-connect/auth` && status === 200) {
		return 'login-page';
	}
	if (url.pathname.startsWith(`/realms/${LOCAL_REALM}/login-actions/`) && status === 200) {
		return 'consent-page';
	}
	return null;
}

const isDocument = (request: Request) => request.resourceType() === 'document';

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
		url.startsWith(APP) || url.startsWith(SECOND_APP) || url.startsWith(KEYCLOAK);
	page.on('request', (request) => {
		if (!isDocument(request) || !inBrowser(request.url())) return;
		const message = requestMessage(
			device
				? onADevice.request(
						new URL(request.url()),
						request.method(),
						run.settings.deviceEnds === 'says-no'
					)
				: classifyRequest(new URL(request.url())),
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
	page.on('response', (response: Response) => {
		if (!isDocument(response.request()) || !inBrowser(response.url())) return;
		const headers = response.headers();
		const step = device
			? onADevice.response(
					new URL(response.url()),
					response.request().method(),
					run.settings.deviceEnds === 'says-no'
				)
			: classifyResponse(new URL(response.url()), response.status(), headers.location ?? null);
		const message = responseMessage(step, response.status(), headers);
		run.messages.push(message);
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

async function login(browser: Browser, run: Run) {
	const context = await browser.newContext();
	const page = await context.newPage();
	const cookies: Promise<void>[] = [];
	watch(page, run, cookies);

	await page.goto(APP);
	if (run.settings.address === 'other') {
		await page.getByText('Invalid parameter: redirect_uri').waitFor();
		await Promise.all(cookies);
		await context.close();
		return;
	}
	await page.locator('#username').waitFor();
	await page.fill('#username', USERNAME);
	await page.fill('#password', PASSWORD);
	await page.click('#kc-login');
	if (run.settings.consent) {
		// The same button id, on the page that asks.
		await page.locator('[name="accept"]').click();
	}
	await page.getByRole('heading', { name: /Logged in|Refused|Failed/ }).waitFor();
	const outcome = await page.locator('body').innerText();
	if (outcome.includes('Failed')) throw new Error(`Login failed: ${outcome}`);
	if (run.settings.sso) await logInToSecondApp(browser, context, run, cookies);
	if (run.settings.logout) {
		await page.goto(`${APP}/logout`);
		await page.getByRole('heading', { name: 'Logged out' }).waitFor();
	}
	await Promise.all(cookies);
	await context.close();
}

function runFor(settings: Settings): Run {
	return {
		settings,
		realm: settings.broker ? BROKERED_REALM : LOCAL_REALM,
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
	await setUpFor(admin, run.realm, settings);

	// Setup's one HTTP exchange. Everything else in setup is people, or the admin calls in keycloak.ts.
	await demo.discover(run);

	await admin.forgetBrokeredUsers();
	demo.current = run;
	await login(browser, run);
	demo.current = null;
	return run;
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
		flagsInSettings().map(({ name }) => {
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

/** Only those, because a whole run changes every value in every recording. */
async function recordOnlyPresets(ids: readonly string[]) {
	const demo = new Demo();
	await demo.start();
	const browser = await chromium.launch();
	try {
		await startKeycloak(version, []);
		const admin = await Admin.connect();
		const keycloak = await admin.serverVersion();
		await setUpRealms(admin);
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
		const flow = { presets: presets.map(({ id }) => id), steps: [...steps].sort() };
		const flows = { ...index.flows, [base.id]: flow };
		writeFileSync(INDEX, `${JSON.stringify({ ...index, recordedOn, flows }, null, '\t')}\n`);
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
			[[], presets.filter((preset) => !needsV2(preset)), questionsWithApiV1],
			[[API_V2_FLAG], presets.filter(needsV2), questionsWithApiV2]
		] as const) {
			console.log(`Starting Keycloak ${version} ${features.join(' ')}`);
			await startKeycloak(version, features);
			const admin = await Admin.connect();
			keycloak = await admin.serverVersion();
			await setUpRealms(admin);

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
				const info = await admin.call<{ features: ServerFeature[] }>('GET', '/serverinfo');
				flags = flagsFrom(info.features);
			}
			stopKeycloak();
		}
		answers.console = inConsole;
		console.log(JSON.stringify(answers, null, '\t'));

		if (checking) {
			const committedIndex = JSON.parse(readFileSync(INDEX, 'utf8')) as RecordingIndex;
			const changes = [
				...whatChanged({
					recordings: [
						...recordings.map((now) => ({
							committed: JSON.parse(
								readFileSync(`${FOLDER}/${now.preset}.json`, 'utf8')
							) as Recording,
							now
						})),
						...withNoUser.map((now) => ({
							committed: JSON.parse(
								readFileSync(
									`static/recordings/${clientCredentialsBase.id}/${now.preset}.json`,
									'utf8'
								)
							) as Recording,
							now
						})),
						...onDevice.map((now) => ({
							committed: JSON.parse(
								readFileSync(`static/recordings/${deviceBase.id}/${now.preset}.json`, 'utf8')
							) as Recording,
							now
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
