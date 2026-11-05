// A real little app and API, doing what the diagram says an app and an API do, and writing down
// everything that crosses the wire while they do it.
import { generateKeyPairSync, randomBytes, sign, type KeyObject } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { Settings } from '#lib/flow/settings.ts';
import type { RecordedMessage } from '#lib/recordings/format.ts';
import { accessTokenProblem, idTokenProblem, scopeProblem, sha256, type Jwk } from './checks.ts';
import { COMPANIES_REALM } from './companies.ts';
import {
	API,
	API_AUDIENCE,
	API_CLIENT,
	APP,
	ATTACKER_REDIRECT_URI,
	ATTACKER_SITE,
	BROKERED_REALM,
	DIRECTORY_REALM,
	CLIENT_SECRET,
	CONFIDENTIAL_CLIENT,
	KEYCLOAK,
	LOCAL_REALM,
	POST_LOGOUT_URI,
	PROXY_PORT,
	REDIRECT_URI,
	SECOND_API,
	SECOND_API_CLIENT,
	SECOND_APP,
	SECOND_CLIENT,
	SERVICE_CLIENT,
	SECOND_REDIRECT_URI,
	UPSTREAM_REALM,
	PASSWORD,
	USERNAME
} from './keycloak.ts';

/** The browser reports what it did a moment later, so what follows has to wait to stay in order. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 250));

const random = () => randomBytes(16).toString('base64url');
const BACKCHANNEL_SHOWN = `${SECOND_APP}/backchannel`;

/** What someone would do to a token: change what it says, and keep the signature they have. */
function withMoreInIt(token: string) {
	const [head, body, signature] = token.split('.');
	const claims = JSON.parse(Buffer.from(body, 'base64url').toString());
	const changed = { ...claims, scope: `${claims.scope} admin` };
	return [head, Buffer.from(JSON.stringify(changed)).toString('base64url'), signature].join('.');
}
const b64 = (value: string | Buffer) => Buffer.from(value).toString('base64url');

const KEPT_REQUEST_HEADERS = ['authorization', 'content-type', 'dpop', 'accept'];
const KEPT_RESPONSE_HEADERS = [
	'access-control-allow-origin',
	'location',
	'content-type',
	'www-authenticate',
	'dpop-nonce'
];

function kept(headers: Headers | Record<string, string>, names: string[]) {
	const get = (name: string) =>
		headers instanceof Headers ? headers.get(name) : (headers[name] ?? null);
	return Object.fromEntries(
		names.flatMap((name) => {
			const value = get(name);
			return value ? [[name, value]] : [];
		})
	);
}

export function parseBody(contentType: string | null, text: string): Partial<RecordedMessage> {
	// The browser does not hand over a page it navigated to, and what is on it is not the protocol.
	if (contentType?.includes('html')) return { bodyNote: 'An HTML page' };
	if (!text) return {};
	if (contentType?.includes('json')) return { body: JSON.parse(text) };
	if (contentType?.includes('x-www-form-urlencoded')) {
		return { body: Object.fromEntries(new URLSearchParams(text)) };
	}
	return { body: text };
}

export function requestMessage(
	step: string | null,
	method: string,
	url: string,
	headers: Headers | Record<string, string>,
	body = ''
): RecordedMessage {
	const shown = kept(headers, KEPT_REQUEST_HEADERS);
	// A browser that follows a redirect after a form still reports the form's type on the next GET.
	if (!body) delete shown['content-type'];
	return {
		step,
		direction: 'request',
		method,
		url,
		headers: shown,
		...parseBody(shown['content-type'] ?? null, body)
	};
}

export function responseMessage(
	step: string | null,
	status: number,
	headers: Headers | Record<string, string>,
	body = ''
): RecordedMessage {
	const shown = kept(headers, KEPT_RESPONSE_HEADERS);
	return {
		step,
		direction: 'response',
		status,
		headers: shown,
		...parseBody(shown['content-type'] ?? null, body)
	};
}

/** The whole of an app that runs in the page, as a library would do it for you. */
/** The page, with a server behind it: it holds nothing, and asks. RFC 10017, section 6.1.1. */
const pageBehindAServer = `<!doctype html><title>An app with a server behind it</title><body><script type="module">
const { loggedIn } = await (await fetch('/session')).json();
if (loggedIn) {
	const answer = await fetch('/api/resource');
	document.body.innerHTML = '<h1>' + (answer.ok ? 'Logged in' : 'Failed') + '</h1>';
} else {
	// Only for the recorder: a browser will not hand over an answer once the page has left it.
	await new Promise((resolve) => setTimeout(resolve, 500));
	location.assign('/login');
}
</script>`;

/** With the flags section 6.1.3.2 asks for, and the prefix it suggests. */
const BFF_COOKIE = '__Host-Http-session';

function appInThePage(
	run: Run,
	server: {
		issuer: string;
		authorization_endpoint: string;
		token_endpoint: string;
		userinfo_endpoint?: string;
	}
) {
	const values = {
		issuer: server.issuer,
		authorize: server.authorization_endpoint,
		token: server.token_endpoint,
		userinfo: server.userinfo_endpoint,
		client: run.clientId,
		back: REDIRECT_URI,
		api: `${API}/resource`,
		oidc: run.settings.oidc
	};
	return `<!doctype html><title>An app in the page</title><body><script type="module">
const { issuer, authorize, token, userinfo, client, back, api, oidc } = ${JSON.stringify(values)};
const url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
	.replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
const random = () => url(crypto.getRandomValues(new Uint8Array(32)));
const said = (text) => { document.body.innerHTML = '<h1>' + text + '</h1>'; };
try {
	if (location.pathname === '/') {
		const verifier = random();
		const state = random();
		const nonce = oidc ? random() : null;
		sessionStorage.setItem('login', JSON.stringify({ verifier, state, nonce }));
		const challenge = url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
		const query = new URLSearchParams({
			response_type: 'code', client_id: client, redirect_uri: back, state,
			code_challenge: challenge, code_challenge_method: 'S256',
			...(oidc ? { scope: 'openid', nonce } : {})
		});
		location.assign(authorize + '?' + query);
	} else {
		const { verifier, state, nonce } = JSON.parse(sessionStorage.getItem('login'));
		const answer = new URLSearchParams(location.search);
		if (answer.get('state') !== state) throw new Error('An answer to something this app did not ask.');
		const tokens = await (await fetch(token, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'authorization_code', code: answer.get('code'), redirect_uri: back,
				client_id: client, code_verifier: verifier
			})
		})).json();
		if (!tokens.access_token) throw new Error(JSON.stringify(tokens));
		if (oidc) {
			// What the step says the app checks. It came straight from the token endpoint, so the signature
			// is the one check the spec lets a page leave out, and the step says that too.
			const part = tokens.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
			const claims = JSON.parse(atob(part));
			if (claims.iss !== issuer) throw new Error('An ID token from another issuer.');
			if (![claims.aud].flat().includes(client)) throw new Error('An ID token for another app.');
			if (claims.exp * 1000 <= Date.now()) throw new Error('An ID token that has expired.');
			if (claims.nonce !== nonce) throw new Error('An ID token from another login.');
		}
		const headers = { authorization: 'Bearer ' + tokens.access_token };
		if (oidc) await (await fetch(userinfo, { headers })).text();
		const called = await fetch(api, { headers });
		await called.text();
		if (!called.ok) throw new Error('The API said ' + called.status);
		said('Logged in');
	}
} catch (error) {
	said('Failed: ' + error);
}
</script>`;
}

export interface Run {
	settings: Settings;
	realm: string;
	clientId: string;
	clientSecret: string | null;
	messages: RecordedMessage[];
	/** The same browser coming back after they left, which is drawn as a login of its own. */
	again?: boolean;
	/** Linking an account at another provider, after the login, with steps of its own (#179). */
	linking?: boolean;
}

/** The app's DPoP key, made once per run, which is the "Generate a key pair" step. */
class ProofKey {
	#privateKey: KeyObject;
	readonly jwk: Record<string, string>;
	readonly thumbprint: string;

	constructor() {
		const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
		this.#privateKey = privateKey;
		const { kty, crv, x, y } = publicKey.export({ format: 'jwk' }) as Record<string, string>;
		this.jwk = { crv, kty, x, y };
		this.thumbprint = sha256(JSON.stringify(this.jwk));
	}

	proof(method: string, url: string, extra: Record<string, string> = {}) {
		const header = { typ: 'dpop+jwt', alg: 'ES256', jwk: this.jwk };
		const payload = {
			jti: random(),
			htm: method,
			htu: url.split('?')[0],
			iat: Math.floor(Date.now() / 1000),
			...extra
		};
		const signing = `${b64(JSON.stringify(header))}.${b64(JSON.stringify(payload))}`;
		const signature = sign('sha256', Buffer.from(signing), {
			key: this.#privateKey,
			dsaEncoding: 'ieee-p1363'
		});
		return `${signing}.${signature.toString('base64url')}`;
	}
}

const listen = (server: Server, url: string) =>
	new Promise<void>((resolve) => server.listen(Number(new URL(url).port), '0.0.0.0', resolve));

function readBody(request: IncomingMessage) {
	return new Promise<string>((resolve) => {
		const chunks: Buffer[] = [];
		request.on('data', (chunk) => chunks.push(chunk));
		request.on('end', () => resolve(Buffer.concat(chunks).toString()));
	});
}

/** A request the app makes itself, recorded as two messages. */
async function call(
	run: Run,
	steps: [string | null, string | null],
	method: string,
	url: string,
	headers: Record<string, string> = {},
	body?: Record<string, string>
) {
	const payload = body ? new URLSearchParams(body).toString() : '';
	const sent = body ? { ...headers, 'content-type': 'application/x-www-form-urlencoded' } : headers;
	run.messages.push(requestMessage(steps[0], method, url, sent, payload));
	const response = await fetch(url, {
		method,
		headers: sent,
		body: body ? payload : undefined,
		redirect: 'manual'
	});
	const text = await response.text();
	run.messages.push(responseMessage(steps[1], response.status, response.headers, text));
	return { status: response.status, text, headers: response.headers };
}

const jsonOf = <T>(text: string) => JSON.parse(text) as T;

/** What the app learns from the issuer it was given, which is the last step of setup. */
interface Discovered {
	issuer: string;
	registration_endpoint?: string;
	authorization_endpoint: string;
	token_endpoint: string;
	device_authorization_endpoint?: string;
	pushed_authorization_request_endpoint?: string;
	userinfo_endpoint?: string;
	end_session_endpoint?: string;
	introspection_endpoint?: string;
	jwks_uri: string;
}

const keysAt = async (jwksUri: string) =>
	((await (await fetch(jwksUri)).json()) as { keys: Jwk[] }).keys;

/** How a client that can keep a secret says who it is (RFC 6749 section 2.3.1). */
const basicAuth = (id: string, secret: string) =>
	`Basic ${Buffer.from(`${encodeURIComponent(id)}:${encodeURIComponent(secret)}`).toString('base64')}`;

/** A person's own username and password, on every call (RFC 7617 section 2). */
const passwordAuth = (username: string, password: string) =>
	`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

interface Tokens {
	access_token: string;
	id_token?: string;
	refresh_token: string;
	token_type: string;
	error?: string;
}

/** The address the identity provider fetches, in its container, where the demo app is the host. */
export const CLIENT_DOCUMENT = 'http://host.docker.internal:9100/client-document.json';

export class Demo {
	current: Run | null = null;
	/** What happens while they are logged in, such as their company turning them off. The recorder sets it. */
	meanwhile: (() => Promise<void>) | null = null;
	#keptLogin = { username: '', password: '' };

	/** It asks to be registered, with the one token an admin gave it, and goes on as what it gets back. */
	async registerItself(run: Run, initialToken: string) {
		const url = this.#discovered?.registration_endpoint ?? '';
		const body = JSON.stringify({ client_name: 'Demo app', redirect_uris: [REDIRECT_URI] });
		const headers = { authorization: `Bearer ${initialToken}`, 'content-type': 'application/json' };
		run.messages.push(requestMessage('dcr-request', 'POST', url, headers, body));
		const response = await fetch(url, { method: 'POST', headers, body });
		const text = await response.text();
		run.messages.push(responseMessage('dcr-response', response.status, response.headers, text));
		if (response.status !== 201) throw new Error(`Registering failed: ${text}`);
		const registered = jsonOf<{ client_id: string; client_secret: string }>(text);
		run.clientId = registered.client_id;
		run.clientSecret = registered.client_secret;
	}

	/** What came before: no identity provider, only the app taking the password from a form. */
	async theOldWay(run: Run) {
		await call(
			run,
			['old-way-form', null],
			'POST',
			`${APP}/old-way/login`,
			{},
			{ username: USERNAME, password: PASSWORD }
		);
	}

	/** The code from a login that was not part of a run, for trying things out with it. */
	lastCode = '';
	/** Logout tokens that came in with no run going, for a question to count. */
	logoutTokens: string[] = [];
	#tokens: Tokens | null = null;
	#bffSession: string | null = null;
	#servers: Server[] = [];
	#discovered: Discovered | null = null;
	#state = '';
	#nonce: string | null = null;
	#key: ProofKey | null = null;
	#verifier: string | null = null;
	#seenProofs = new Set<string>();
	/** The refresh token the first API got from a trade, for later, when the trade gave one (#185). */
	#tradedRefresh: string | null = null;
	/** Someone is handing the real app a stolen code, from a login of their own. */
	#handed = false;
	/** What someone else made for a login link of their own, which they keep. */
	#theirVerifier: string | null = null;

	get #run() {
		if (!this.current) throw new Error('No run in progress');
		return this.current;
	}

	get #server() {
		if (!this.#discovered) throw new Error('The app has not looked up its identity provider');
		return this.#discovered;
	}

	/** The one thing the app is told is the issuer. Everything else it asks for. */
	async discover(run: Run, initialToken?: string) {
		const name = run.settings.oidc ? 'openid-configuration' : 'oauth-authorization-server';
		const url = `${KEYCLOAK}/realms/${run.realm}/.well-known/${name}`;
		const answer = await call(run, ['discover', 'discovery-document'], 'GET', url);
		this.#discovered = jsonOf<Discovered>(answer.text);
		if (initialToken) await this.registerItself(run, initialToken);
		// What the API does when it starts, the same way, and nothing tells it to.
		await call(run, ['fetch-keys', 'keys'], 'GET', this.#discovered.jwks_uri);
	}

	/** Bearer or DPoP, whichever the setting says. A proof is tied to the token it is sent with. */
	#authorization(method: string, url: string, token: string): Record<string, string> {
		if (!this.#key) return { authorization: `Bearer ${token}` };
		return {
			authorization: `DPoP ${token}`,
			dpop: this.#key.proof(method, url, { ath: sha256(token) })
		};
	}

	async #tokenRequest(
		code: string,
		nonce?: string,
		steps: [string, string] = ['token-request', 'token-response']
	) {
		const run = this.#run;
		const url = this.#server.token_endpoint;
		const body: Record<string, string> = {
			grant_type: 'authorization_code',
			code,
			redirect_uri: REDIRECT_URI
		};
		if (!run.clientSecret) body.client_id = run.clientId;
		if (this.#verifier) body.code_verifier = this.#verifier;
		const headers: Record<string, string> = {
			...(run.clientSecret ? { authorization: basicAuth(run.clientId, run.clientSecret) } : {}),
			...(this.#key ? { dpop: this.#key.proof('POST', url, nonce ? { nonce } : {}) } : {})
		};
		return call(run, steps, 'POST', url, headers, body);
	}

	/** A login link someone else made for the real app, with an address and a PKCE pair of their own. */
	theirLink() {
		const { settings, clientId } = this.#run;
		this.#theirVerifier = settings.pkce ? random() + random() : null;
		const query = new URLSearchParams({
			response_type: 'code',
			client_id: clientId,
			redirect_uri: ATTACKER_REDIRECT_URI,
			state: random()
		});
		if (settings.oidc) {
			query.set('scope', 'openid');
			query.set('nonce', random());
		}
		if (this.#theirVerifier) {
			query.set('code_challenge', sha256(this.#theirVerifier));
			query.set('code_challenge_method', 'S256');
		}
		return `${this.#server.authorization_endpoint}?${query}`;
	}

	/** A code that came to their own address, traded as the real app would. Each answer is real. */
	async #tradeTheirs(code: string) {
		const run = this.#run;
		const body: Record<string, string> = {
			grant_type: 'authorization_code',
			code,
			redirect_uri: ATTACKER_REDIRECT_URI,
			client_id: run.clientId
		};
		if (this.#theirVerifier) body.code_verifier = this.#theirVerifier;
		const result = await call(
			run,
			['attacker-token-request', 'attacker-token-response'],
			'POST',
			this.#server.token_endpoint,
			{},
			body
		);
		const stolen = jsonOf<Tokens>(result.text).access_token;
		if (!stolen) return 'Refused';
		await call(run, ['attacker-api-request', 'attacker-api-response'], 'GET', `${API}/resource`, {
			authorization: `Bearer ${stolen}`
		});
		return 'Got it';
	}

	/** What someone else can do with the same code, in the moment it goes by. Each answer is real. */
	async #attack(code: string, stolenFrom: RecordedMessage) {
		const run = this.#run;
		const own: Run = { ...run, messages: [] };
		own.messages.push({ ...stolenFrom, step: 'attacker-steals-code' });
		const url = this.#server.token_endpoint;
		const result = await call(
			own,
			['attacker-token-request', 'attacker-token-response'],
			'POST',
			url,
			{},
			{
				grant_type: 'authorization_code',
				code,
				redirect_uri: REDIRECT_URI,
				client_id: run.clientId
			}
		);
		const stolen = jsonOf<Tokens>(result.text).access_token;
		if (stolen) {
			const resource = `${API}/resource`;
			await call(own, ['attacker-api-request', 'attacker-api-response'], 'GET', resource, {
				authorization: `Bearer ${stolen}`
			});
		}
		// It happens as the code goes by, so it comes before the app gets to do anything with it.
		const callback = run.messages.lastIndexOf(stolenFrom);
		run.messages.splice(callback, 0, ...own.messages);
	}

	/**
	 * The stolen code handed to the real app, from a login someone started in their own browser. The app
	 * does what it always does, and each answer is real, so whether this works is up to the server.
	 */
	async #handToTheRealApp(code: string, stolenFrom: RecordedMessage) {
		const run = this.#run;
		const own: Run = { ...run, messages: [] };
		own.messages.push({ ...stolenFrom, step: 'attacker-steals-code' });
		const victims = { state: this.#state, verifier: this.#verifier, nonce: this.#nonce };

		this.current = own;
		const opened = await call(
			own,
			['attacker-opens-app', 'attacker-sent-to-login'],
			'GET',
			`${APP}/`
		);
		const theirState = new URL(opened.headers.get('location') ?? '').searchParams.get('state');
		this.#handed = true;
		const query = new URLSearchParams({ code, state: theirState ?? '' });
		await call(
			own,
			['attacker-hands-code', 'attacker-handed-answer'],
			'GET',
			`${APP}/callback?${query}`
		);
		this.#handed = false;
		this.current = run;
		this.#state = victims.state;
		this.#verifier = victims.verifier;
		this.#nonce = victims.nonce;

		const callback = run.messages.lastIndexOf(stolenFrom);
		run.messages.splice(callback, 0, ...own.messages);
	}

	/** What the app does with a code in a login someone else started, which is what it always does. */
	async #takeHandedCode(code: string) {
		const result = await this.#tokenRequest(code, undefined, [
			'handed-token-request',
			'handed-token-response'
		]);
		const tokens = jsonOf<Tokens>(result.text);
		if (!tokens.access_token) return { status: 400, says: `Refused: ${tokens.error}` };
		if (!tokens.id_token) return { status: 200, says: 'Logged in' };
		const problem = idTokenProblem(tokens.id_token, {
			issuer: this.#server.issuer,
			clientId: this.#run.clientId,
			nonce: this.#nonce,
			keys: await keysAt(this.#server.jwks_uri)
		});
		return problem
			? { status: 400, says: `Refused: ${problem}` }
			: { status: 200, says: 'Logged in' };
	}

	async #afterLogin(code: string) {
		const run = this.#run;
		const { settings } = run;

		if (settings.attacker) {
			const callback = run.messages.findLast((message) => message.step === 'callback');
			if (!callback) throw new Error('The callback was not recorded');
			if (settings.attackerUses === 'real-app') await this.#handToTheRealApp(code, callback);
			else await this.#attack(code, callback);
		}

		let result = await this.#tokenRequest(code);
		if (settings.attacker && result.status === 400) {
			run.messages[run.messages.length - 1].step = 'real-app-refused';
			return 'Refused';
		}
		// A server that wants a nonce says so here. If it ever does, this records the retry as well.
		const challenge = result.headers.get('dpop-nonce');
		if (result.status === 400 && challenge) {
			const last = run.messages[run.messages.length - 1];
			last.step = 'nonce-challenge';
			result = await this.#tokenRequest(code, challenge, ['token-request-retry', 'token-response']);
		}
		const tokens = jsonOf<Tokens>(result.text);
		if (!tokens.access_token) throw new Error(`No token: ${result.text}`);
		this.#tokens = tokens;
		// It keeps them, and calls the API when the page asks.
		if (settings.appRuns === 'bff') return 'Logged in';

		if (settings.oidc) {
			const problem = idTokenProblem(tokens.id_token, {
				issuer: this.#server.issuer,
				clientId: run.clientId,
				nonce: this.#nonce,
				keys: await keysAt(this.#server.jwks_uri)
			});
			if (problem) throw new Error(`The ID token: ${problem}`);

			const url = this.#server.userinfo_endpoint;
			if (!url) throw new Error('The identity provider names no UserInfo endpoint');
			await call(
				run,
				['userinfo-request', 'userinfo-response'],
				'GET',
				url,
				this.#authorization('GET', url, tokens.access_token)
			);
		}

		const { apiToken } = settings;
		const bearerOnly = settings.tokenThief && settings.apiChecks === 'bearer';
		const resource = bearerOnly
			? `${API}/bearer-only/resource`
			: `${API}${{ elsewhere: '/my-api/resource', noscope: '/contacts' }[apiToken as string] ?? '/resource'}`;
		// The token has a very short life for this one, set up in keycloak.ts, so it just has to wait.
		if (apiToken === 'expired') await new Promise((resolve) => setTimeout(resolve, 2100));
		const sent = apiToken === 'changed' ? withMoreInIt(tokens.access_token) : tokens.access_token;
		const answer = await call(
			run,
			['api-request', 'api-response'],
			'GET',
			resource,
			apiToken === 'none'
				? {}
				: bearerOnly
					? { authorization: `Bearer ${sent}` }
					: this.#authorization('GET', resource, sent)
		);
		// An API not allowed the other provider cannot answer, which is what is drawn (#180).
		const readsAndRefused =
			settings.upstreamTokens === 'v2' && settings.upstreamReader === 'refused';
		if (readsAndRefused && answer.status !== 502) {
			throw new Error(`The API answered without the other provider's token: ${answer.text}`);
		}
		if (answer.status !== 200 && apiToken === 'good' && !readsAndRefused) {
			throw new Error(`The API refused: ${answer.text}`);
		}
		if (answer.status === 200 && apiToken !== 'good') {
			throw new Error(`The API accepted what it should not: ${apiToken}`);
		}

		const appReads = settings.upstreamTokens !== 'v2' || settings.upstreamReader === 'app';
		if (settings.upstreamTokens !== 'off' && appReads) await this.#storedToken(tokens.access_token);
		if (settings.exchangeGives === 'refresh') await this.#tradeAgain(run);
		if (settings.refresh) await this.#whenItRunsOut(tokens);
		if (settings.leaves) await this.#afterTheyLeft(tokens);
		if (settings.tokenThief) await this.#someoneElseUses(tokens.access_token);
		return 'Logged in';
	}

	/** With no user and no browser: what an app asks for itself, and what it does with that. */
	async asItself(run: Run) {
		this.#key = run.settings.binding === 'dpop' ? new ProofKey() : null;
		const url = this.#server.token_endpoint;
		if (!run.clientSecret) throw new Error('An app acting for itself has to have a secret');
		const result = await call(
			run,
			['token-request', 'token-response'],
			'POST',
			url,
			{
				authorization: basicAuth(run.clientId, run.clientSecret),
				...(this.#key ? { dpop: this.#key.proof('POST', url) } : {})
			},
			{ grant_type: 'client_credentials' }
		);
		const tokens = jsonOf<Tokens>(result.text);
		if (!tokens.access_token) throw new Error(`No token: ${result.text}`);
		const resource = `${API}/resource`;
		const answer = await call(
			run,
			['api-request', 'api-response'],
			'GET',
			resource,
			this.#authorization('GET', resource, tokens.access_token)
		);
		if (answer.status !== 200) throw new Error(`The API refused: ${answer.text}`);
	}

	/**
	 * An app nothing can call. It shows two things and asks until someone is done, and the login is
	 * whatever the browser does in the meantime, which never touches this app.
	 */
	async onADevice(run: Run, someoneLogsIn: (address: string, userCode: string) => Promise<void>) {
		this.#key = null;
		const url = this.#server.token_endpoint;
		const started = await call(
			run,
			['request', 'response'],
			'POST',
			this.#server.device_authorization_endpoint ?? '',
			{},
			{ client_id: run.clientId, ...(run.settings.oidc ? { scope: 'openid' } : {}) }
		);
		const codes = jsonOf<{
			device_code: string;
			user_code: string;
			verification_uri: string;
			interval: number;
		}>(started.text);
		const asking = {
			grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
			device_code: codes.device_code,
			client_id: run.clientId
		};
		const notYet = await call(run, ['poll', 'pending'], 'POST', url, {}, asking);
		if (jsonOf<Tokens>(notYet.text).error !== 'authorization_pending') {
			throw new Error(`Expected to be told not yet: ${notYet.text}`);
		}
		const { deviceEnds } = run.settings;
		if (deviceEnds !== 'runs-out') await someoneLogsIn(codes.verification_uri, codes.user_code);
		await new Promise((resolve) => setTimeout(resolve, codes.interval * 1000));
		if (deviceEnds !== 'agrees') {
			const expected = deviceEnds === 'says-no' ? 'access_denied' : 'expired_token';
			const answer = deviceEnds === 'says-no' ? 'denied-response' : 'expired-response';
			const said = await call(run, ['poll-again', answer], 'POST', url, {}, asking);
			if (jsonOf<Tokens>(said.text).error !== expected) {
				throw new Error(`Expected ${expected}: ${said.text}`);
			}
			return;
		}
		const result = await call(run, ['poll-again', 'token-response'], 'POST', url, {}, asking);
		const tokens = jsonOf<Tokens>(result.text);
		if (!tokens.access_token) throw new Error(`No token: ${result.text}`);
		if (run.settings.oidc) {
			const problem = idTokenProblem(tokens.id_token, {
				issuer: this.#server.issuer,
				clientId: run.clientId,
				nonce: null,
				keys: await keysAt(this.#server.jwks_uri)
			});
			if (problem) throw new Error(`The ID token: ${problem}`);
		}
		const resource = `${API}/resource`;
		const answer = await call(run, ['api-request', 'api-response'], 'GET', resource, {
			authorization: `Bearer ${tokens.access_token}`
		});
		if (answer.status !== 200) throw new Error(`The API refused: ${answer.text}`);
	}

	/** What is left once the user has logged out, tried for real. */
	async #afterLogout() {
		await settle();
		const run = this.#run;
		const tokens = this.#tokens;
		if (!tokens) throw new Error('Logged out with no tokens');
		const bearer = { authorization: `Bearer ${tokens.access_token}` };
		const looked = await call(
			run,
			['token-after-logout', 'token-after-logout-response'],
			'GET',
			`${API}/resource`,
			bearer
		);
		if (looked.status !== 200) throw new Error(`The API refused: ${looked.text}`);
		const asked = await call(
			run,
			['asks-after-logout', 'asks-after-logout-response'],
			'GET',
			`${API}/asks/resource`,
			bearer
		);
		// With offline access, the server still said the token was active (#184).
		const offline = run.settings.logoutKeeps === 'offline';
		if (asked.status !== (offline ? 200 : 401)) {
			throw new Error(`The API that asks answered ${asked.status}: ${asked.text}`);
		}
		const refresh = await call(
			run,
			['refresh-after-logout', 'refresh-after-logout-response'],
			'POST',
			this.#server.token_endpoint,
			run.clientSecret ? { authorization: basicAuth(run.clientId, run.clientSecret) } : {},
			{
				grant_type: 'refresh_token',
				refresh_token: tokens.refresh_token,
				...(run.clientSecret ? {} : { client_id: run.clientId })
			}
		);
		if (refresh.status !== (offline ? 200 : 400)) {
			throw new Error(`The refresh after the logout got ${refresh.status}: ${refresh.text}`);
		}
		if (!offline) return;
		// What a service does later, for the user who is not there.
		const { access_token } = jsonOf<{ access_token?: string }>(refresh.text);
		const later = await call(
			run,
			['api-after-logout', 'api-after-logout-response'],
			'GET',
			`${API}/resource`,
			{ authorization: `Bearer ${access_token}` }
		);
		if (later.status !== 200) throw new Error(`The API refused it: ${later.text}`);
	}

	/** The same call once the token has run out, what a refresh token gets, and using one twice. */
	async #whenItRunsOut(tokens: Tokens) {
		const run = this.#run;
		const resource = `${API}/resource`;
		const callApi = (steps: [string, string], accessToken: string) =>
			call(run, steps, 'GET', resource, this.#authorization('GET', resource, accessToken));
		const refresh = (refreshToken: string, steps: [string, string]) =>
			call(
				run,
				steps,
				'POST',
				this.#server.token_endpoint,
				run.clientSecret ? { authorization: basicAuth(run.clientId, run.clientSecret) } : {},
				{
					grant_type: 'refresh_token',
					refresh_token: refreshToken,
					...(run.clientSecret ? {} : { client_id: run.clientId })
				}
			);

		// Its life is short for this one, set up in keycloak.ts, so it just has to wait.
		await new Promise((resolve) => setTimeout(resolve, 3100));
		const refused = await callApi(['api-request-again', 'api-refused'], tokens.access_token);
		if (refused.status !== 401) throw new Error(`The API took an old token: ${refused.text}`);

		const answer = await refresh(tokens.refresh_token, ['refresh-request', 'refresh-response']);
		const newer = jsonOf<Tokens>(answer.text);
		if (!newer.access_token || !newer.refresh_token) throw new Error(`No token: ${answer.text}`);

		const retried = await callApi(['api-request-new', 'api-response-new'], newer.access_token);
		if (retried.status !== 200) throw new Error(`The API refused: ${retried.text}`);

		const ends = run.settings.reuse === 'ends';
		const again = await refresh(tokens.refresh_token, ['refresh-again', 'refresh-again-response']);
		if (again.status !== (ends ? 400 : 200)) throw new Error(`Used twice: ${again.text}`);
		if (!ends) return;
		const newest = await refresh(newer.refresh_token, [
			'refresh-newest',
			'refresh-newest-response'
		]);
		if (newest.status !== 400) throw new Error(`The newest still works: ${newest.text}`);
	}

	/**
	 * What the first API does to answer: it trades the token it was sent for one meant for the second
	 * API, proving who it is with its own secret, and calls that one with the new token (RFC 8693).
	 */
	async #fromTheSecondApi(run: Run, subjectToken: string) {
		const swapped = await call(
			run,
			['exchange-request', 'exchange-response'],
			'POST',
			this.#server.token_endpoint,
			{ authorization: basicAuth(API_CLIENT, CLIENT_SECRET) },
			{
				grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
				subject_token: subjectToken,
				subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
				audience: SECOND_API_CLIENT,
				...(run.settings.exchangeGives === 'refresh'
					? { requested_token_type: 'urn:ietf:params:oauth:token-type:refresh_token' }
					: {})
			}
		);
		const { access_token, refresh_token } = jsonOf<{
			access_token?: string;
			refresh_token?: string;
		}>(swapped.text);
		if (!access_token) return { status: 502, text: JSON.stringify({ error: swapped.text }) };
		if (run.settings.exchangeGives === 'refresh' && !refresh_token) {
			return { status: 502, text: JSON.stringify({ error: 'No refresh token from the trade' }) };
		}
		this.#tradedRefresh = refresh_token ?? null;
		const passed = await call(
			run,
			['second-api-request', 'second-api-response'],
			'GET',
			`${SECOND_API}/resource`,
			{ authorization: `Bearer ${access_token}` }
		);
		if (passed.status !== 200) return { status: 502, text: passed.text };
		return {
			status: 200,
			text: JSON.stringify({
				resource: 'something only this user may see, with some from the second API'
			})
		};
	}

	/**
	 * Later, the first API's job goes on: it gets a new token for the second API with the refresh
	 * token from the trade, proving who it is with its own secret, and no user takes part.
	 */
	async #tradeAgain(run: Run) {
		const refreshToken = this.#tradedRefresh;
		if (!refreshToken) throw new Error('The trade gave the API no refresh token');
		const again = await call(
			run,
			['trade-refresh-request', 'trade-refresh-response'],
			'POST',
			this.#server.token_endpoint,
			{ authorization: basicAuth(API_CLIENT, CLIENT_SECRET) },
			{ grant_type: 'refresh_token', refresh_token: refreshToken }
		);
		const { access_token } = jsonOf<{ access_token?: string }>(again.text);
		if (again.status !== 200 || !access_token) {
			throw new Error(`The API could not refresh the token from the trade: ${again.text}`);
		}
		this.#tradedRefresh = null;
	}

	/**
	 * The API reads the user's token at the other provider with a client of its own, which the app's
	 * token names, and calls that provider with it to answer. Not allowed the provider, it cannot.
	 */
	async #readsTheStoredToken(run: Run, accessToken: string) {
		const refused = run.settings.upstreamReader === 'refused';
		const url = `${KEYCLOAK}/realms/${run.realm}/broker/${UPSTREAM_REALM}/token`;
		const result = await call(
			run,
			['api-retrieve-upstream-token', refused ? 'api-upstream-refused' : 'api-upstream-token'],
			'POST',
			url,
			{ accept: 'application/json' },
			{ client_id: API_CLIENT, client_secret: CLIENT_SECRET, token: accessToken }
		);
		if (refused) {
			// An answer, never a throw: a throw here would take the whole recorder down with it.
			if (result.status !== 403) return { status: 500, text: `Not refused: ${result.text}` };
			return {
				status: 502,
				text: JSON.stringify({ error: 'could not get the token at the other provider' })
			};
		}
		const upstream = jsonOf<{ access_token?: string }>(result.text).access_token;
		if (result.status !== 200 || !upstream)
			return { status: 500, text: `Could not read it: ${result.text}` };
		const userinfo = `${KEYCLOAK}/realms/${UPSTREAM_REALM}/protocol/openid-connect/userinfo`;
		await call(run, ['api-call-upstream', null], 'GET', userinfo, {
			authorization: `Bearer ${upstream}`
		});
		return {
			status: 200,
			text: JSON.stringify({
				resource: 'something only this user may see, with some from the other provider'
			})
		};
	}

	/** Someone who has a copy of the access token and not the key, so they send it with no proof. */
	async #someoneElseUses(accessToken: string) {
		const bearerOnly = this.#run.settings.apiChecks === 'bearer';
		const resource = `${API}${bearerOnly ? '/bearer-only/resource' : '/resource'}`;
		const answer = await call(
			this.#run,
			['thief-api-request', 'thief-api-response'],
			'GET',
			resource,
			{ authorization: `Bearer ${accessToken}` }
		);
		if (answer.status !== (bearerOnly ? 200 : 401)) {
			throw new Error(`The stolen token got ${answer.status}: ${answer.text}`);
		}
	}

	/** Their company turns them off, and the app goes on with what it has. */
	async #afterTheyLeft(tokens: Tokens) {
		const run = this.#run;
		await this.meanwhile?.();
		const resource = `${API}/resource`;
		const still = await call(
			run,
			['left-api-request', 'left-api-response'],
			'GET',
			resource,
			this.#authorization('GET', resource, tokens.access_token)
		);
		if (still.status !== 200) throw new Error(`The API refused once they left: ${still.text}`);
		const refreshed = await call(
			run,
			['left-refresh', 'left-refresh-response'],
			'POST',
			this.#server.token_endpoint,
			run.clientSecret ? { authorization: basicAuth(run.clientId, run.clientSecret) } : {},
			{
				grant_type: 'refresh_token',
				refresh_token: tokens.refresh_token,
				...(run.clientSecret ? {} : { client_id: run.clientId })
			}
		);
		if (refreshed.status !== 200) throw new Error(`No refresh once they left: ${refreshed.text}`);
	}

	async #storedToken(accessToken: string) {
		const run = this.#run;
		const url = `${KEYCLOAK}/realms/${run.realm}/broker/${UPSTREAM_REALM}/token`;
		const steps: [string, string] = ['retrieve-upstream-token', 'upstream-token'];
		const result =
			run.settings.upstreamTokens === 'v2'
				? await call(
						run,
						steps,
						'POST',
						url,
						{ accept: 'application/json' },
						{
							client_id: CONFIDENTIAL_CLIENT,
							client_secret: CLIENT_SECRET,
							token: accessToken
						}
					)
				: await call(run, steps, 'GET', url, this.#authorization('GET', url, accessToken));
		if (result.status !== 200) return;

		// API V1 answers in whichever form the upstream used, which is JSON from another Keycloak.
		const upstream = jsonOf<{ access_token: string }>(result.text).access_token;
		const userinfo = `${KEYCLOAK}/realms/${UPSTREAM_REALM}/protocol/openid-connect/userinfo`;
		await call(run, ['call-upstream', null], 'GET', userinfo, {
			authorization: `Bearer ${upstream}`
		});
	}

	async start() {
		const app = createServer(async (request, response) => {
			const url = new URL(request.url ?? '/', APP);
			// What the identity provider fetches when an app it has not seen asks for a login.
			if (url.pathname === '/client-document.json') {
				const document = JSON.stringify({
					client_id: CLIENT_DOCUMENT,
					client_name: 'Demo app',
					redirect_uris: [REDIRECT_URI],
					token_endpoint_auth_method: 'none',
					grant_types: ['authorization_code'],
					response_types: ['code']
				});
				const headers = { 'content-type': 'application/json' };
				if (this.current) {
					this.current.messages.push(requestMessage('cimd-fetch', 'GET', CLIENT_DOCUMENT, {}));
					this.current.messages.push(responseMessage('cimd-document', 200, headers, document));
				}
				response.writeHead(200, headers);
				response.end(document);
				return;
			}
			// The old way: it takes the password, and from then on logs in as the user with it.
			if (url.pathname === '/old-way/login') {
				const form = new URLSearchParams(await readBody(request));
				// It keeps it, as the step says, because it needs it for this call and every one after.
				this.#keptLogin = {
					username: form.get('username') ?? '',
					password: form.get('password') ?? ''
				};
				const { status } = await call(
					this.#run,
					['old-way-call', 'old-way-answer'],
					'GET',
					`${API}/old-way/resource`,
					{ authorization: passwordAuth(this.#keptLogin.username, this.#keptLogin.password) }
				);
				response.writeHead(status === 200 ? 200 : 500, { 'content-type': 'text/plain' });
				response.end(status === 200 ? 'Logged in' : 'Failed');
				return;
			}
			// An app in the page: the same page for both addresses, and all it does it does from there.
			if (
				this.current?.settings.appRuns === 'page' &&
				(url.pathname === '/' || url.pathname === '/callback')
			) {
				response.writeHead(200, { 'content-type': 'text/html' });
				response.end(appInThePage(this.current, this.#server));
				return;
			}
			if (this.current?.settings.appRuns === 'bff') {
				const inSession =
					this.#bffSession !== null &&
					(request.headers.cookie ?? '').includes(`${BFF_COOKIE}=${this.#bffSession}`);
				if (url.pathname === '/') {
					response.writeHead(200, { 'content-type': 'text/html' });
					response.end(pageBehindAServer);
					return;
				}
				if (url.pathname === '/session') {
					response.writeHead(200, { 'content-type': 'application/json' });
					response.end(JSON.stringify({ loggedIn: inSession }));
					return;
				}
				if (url.pathname === '/api/resource') {
					if (!inSession) {
						response.writeHead(401);
						response.end();
						return;
					}
					// Takes the cookie off and puts the token on, which is all section 6.1 asks of this.
					await settle();
					const resource = `${API}/resource`;
					const answer = await call(
						this.#run,
						['api-request', 'api-response'],
						'GET',
						resource,
						this.#authorization('GET', resource, this.#tokens?.access_token ?? '')
					);
					response.writeHead(answer.status, { 'content-type': 'application/json' });
					response.end(answer.text);
					return;
				}
			}
			// The user asks to link an account at another provider, as an ordinary authorization request
			// with the identity provider's own parameter for it, here kc_action (#179).
			if (url.pathname === '/link') {
				const run = this.#run;
				this.#state = random();
				const query = new URLSearchParams({
					response_type: 'code',
					client_id: run.clientId,
					redirect_uri: REDIRECT_URI,
					state: this.#state,
					kc_action: `idp_link:${UPSTREAM_REALM}`
				});
				response.writeHead(302, { location: `${this.#server.authorization_endpoint}?${query}` });
				response.end();
				return;
			}
			if (url.pathname === '/' || url.pathname === '/login') {
				const run = this.#run;
				const { settings } = run;
				this.#state = random();
				this.#key = settings.binding === 'dpop' ? new ProofKey() : null;
				this.#verifier = settings.pkce ? random() + random() : null;
				this.#nonce = settings.oidc ? random() : null;
				const query = new URLSearchParams({
					response_type: 'code',
					client_id: run.clientId,
					redirect_uri:
						settings.address === 'other'
							? `${new URL(REDIRECT_URI).origin}/not-registered`
							: REDIRECT_URI,
					state: this.#state
				});
				if (this.#nonce) {
					query.set('scope', 'openid');
					query.set('nonce', this.#nonce);
				}
				// A refresh token meant to outlive the session (#184).
				if (settings.logoutKeeps === 'offline') {
					query.set('scope', [query.get('scope'), 'offline_access'].filter(Boolean).join(' '));
				}
				// So the token says which customer, which an app selling to companies keeps them apart by.
				if (settings.companies) {
					query.set('scope', [query.get('scope'), 'organization'].filter(Boolean).join(' '));
				}
				if (this.#key) query.set('dpop_jkt', this.#key.thumbprint);
				if (this.#verifier) {
					query.set('code_challenge', sha256(this.#verifier));
					query.set('code_challenge_method', 'S256');
				}
				if (settings.par) {
					// Pushed first, straight to the identity provider, proving who it is the way it does
					// when it asks for tokens, and the browser carries only the reference (RFC 9126).
					const pushed = await call(
						run,
						['push-request', 'push-response'],
						'POST',
						this.#server.pushed_authorization_request_endpoint ?? '',
						run.clientSecret ? { authorization: basicAuth(run.clientId, run.clientSecret) } : {},
						Object.fromEntries(query)
					);
					const { request_uri } = jsonOf<{ request_uri: string }>(pushed.text);
					const reference = new URLSearchParams({ client_id: run.clientId, request_uri });
					response.writeHead(302, {
						location: `${this.#server.authorization_endpoint}?${reference}`
					});
					response.end();
					return;
				}
				response.writeHead(302, { location: `${this.#server.authorization_endpoint}?${query}` });
				response.end();
				return;
			}
			if (url.pathname === '/logout') {
				const query = new URLSearchParams({
					id_token_hint: this.#tokens?.id_token ?? '',
					post_logout_redirect_uri: POST_LOGOUT_URI,
					state: random()
				});
				response.writeHead(302, { location: `${this.#server.end_session_endpoint}?${query}` });
				response.end();
				return;
			}
			if (url.pathname === '/bye') {
				if (this.current) await this.#afterLogout();
				response.writeHead(200, { 'content-type': 'text/html' });
				response.end('<h1>Logged out</h1>');
				return;
			}
			if (url.pathname === '/callback') {
				if (!this.current) {
					this.lastCode = url.searchParams.get('code') ?? '';
					response.writeHead(200, { 'content-type': 'text/html' });
					response.end('<h1>Done</h1>');
					return;
				}
				// Back from a link: the status is what this shows, so the code is not traded (#179).
				if (this.current.linking) {
					const status = url.searchParams.get('kc_action_status');
					const fine = url.searchParams.get('state') === this.#state;
					response.writeHead(200, { 'content-type': 'text/html' });
					response.end(fine && status === 'success' ? '<h1>Linked</h1>' : '<h1>Not linked</h1>');
					return;
				}
				// Back after they left: the code is what this shows, so it is not traded again.
				if (this.current.again) {
					response.writeHead(200, { 'content-type': 'text/html' });
					response.end('<h1>Back</h1>');
					return;
				}
				if (url.searchParams.get('state') !== this.#state) {
					response.writeHead(400, { 'content-type': 'text/html' });
					response.end('<h1>Failed</h1><p>An answer to something this app did not ask.</p>');
					return;
				}
				if (this.#handed) {
					const { status, says } = await this.#takeHandedCode(url.searchParams.get('code') ?? '');
					response.writeHead(status, { 'content-type': 'text/html' });
					response.end(`<h1>${says}</h1>`);
					return;
				}
				try {
					await settle();
					const outcome = await this.#afterLogin(url.searchParams.get('code') ?? '');
					if (this.#run.settings.appRuns === 'bff') {
						this.#bffSession = random();
						response.writeHead(302, {
							location: `${APP}/`,
							'set-cookie': `${BFF_COOKIE}=${this.#bffSession}; Path=/; Secure; HttpOnly; SameSite=Strict`
						});
						response.end();
						return;
					}
					response.writeHead(200, { 'content-type': 'text/html' });
					response.end(`<h1>${outcome}</h1>`);
				} catch (error) {
					response.writeHead(500, { 'content-type': 'text/html' });
					response.end(`<h1>Failed</h1><pre>${String(error)}</pre>`);
				}
				return;
			}
			response.writeHead(404);
			response.end();
		});

		// A 200 from here has to mean it looked, because the diagram says it does.
		const api = createServer(async (request, response) => {
			// A page has to be let in, by the browser's rules, and the answer has to say so.
			if (request.headers.origin) {
				response.setHeader('access-control-allow-origin', request.headers.origin);
				if (request.method === 'OPTIONS') {
					response.writeHead(204, { 'access-control-allow-headers': 'authorization' });
					response.end();
					return;
				}
			}
			// The old way: it knows the password itself, which is what is wrong with it (RFC 7617).
			if (request.url === '/old-way/resource') {
				const allowed = request.headers.authorization === passwordAuth(USERNAME, PASSWORD);
				response.writeHead(allowed ? 200 : 401, {
					'content-type': 'application/json',
					...(allowed ? {} : { 'www-authenticate': 'Basic realm="demo", charset="UTF-8"' })
				});
				response.end(
					JSON.stringify(allowed ? { resource: 'something only this user may see' } : {})
				);
				return;
			}
			// With nothing to be wrong, there is no error to name (RFC 6750 section 3.1).
			if (!request.headers.authorization) {
				response.writeHead(401, { 'www-authenticate': 'Bearer' });
				response.end();
				return;
			}
			// One API that does not go by the token alone, and asks the server about it.
			if (request.url?.startsWith('/asks/')) {
				const answer = await call(
					this.#run,
					['introspect', 'introspect-response'],
					'POST',
					this.#server.introspection_endpoint ?? '',
					{ authorization: basicAuth(API_CLIENT, CLIENT_SECRET) },
					{ token: request.headers.authorization.split(' ')[1] }
				);
				const { active } = jsonOf<{ active: boolean }>(answer.text);
				response.writeHead(active ? 200 : 401, {
					'content-type': 'application/json',
					...(active
						? {}
						: {
								'www-authenticate': 'Bearer error="invalid_token", error_description="not active"'
							})
				});
				response.end(JSON.stringify(active ? { resource: 'yours' } : { error: 'not active' }));
				return;
			}
			// It trades the token for one meant for the API behind it, which it may only do with one that
			// names it, so here it checks for its own name, as yours should.
			const passesItOn = Boolean(this.current?.settings.exchange);
			// Or it reads the user's token at the other provider itself, with a client of its own (#180).
			const readsStored =
				this.current?.settings.upstreamTokens === 'v2' &&
				this.current.settings.upstreamReader !== 'app';
			const problem = await accessTokenProblem(
				{
					authorization: request.headers.authorization,
					dpop: request.headers.dpop as string | undefined,
					method: request.method ?? 'GET',
					url: `${API}${request.url}`
				},
				{
					issuers: [LOCAL_REALM, BROKERED_REALM, DIRECTORY_REALM, COMPANIES_REALM].map(
						(realm) => `${KEYCLOAK}/realms/${realm}`
					),
					// One API that expects its own name, as yours should, which a default client's token lacks.
					audience:
						passesItOn || readsStored
							? API_CLIENT
							: request.url?.startsWith('/my-api/')
								? 'my-api'
								: API_AUDIENCE,
					keysOf: (issuer) => keysAt(`${issuer}/protocol/openid-connect/certs`),
					seenProofs: this.#seenProofs,
					// Another API, written before DPoP, beside the one that knows it.
					knowsOnlyBearer: request.url?.startsWith('/bearer-only/')
				}
			);
			if (problem) {
				const scheme = request.headers.authorization.split(' ')[0];
				response.writeHead(401, {
					'content-type': 'application/json',
					'www-authenticate': `${scheme} error="invalid_token", error_description="${problem}"`
				});
				response.end(JSON.stringify({ error: problem }));
				return;
			}
			// One that needs a scope a default client's token does not have.
			const notAllowed =
				request.url === '/contacts' && scopeProblem(request.headers.authorization, 'contacts');
			if (notAllowed) {
				response.writeHead(403, {
					'content-type': 'application/json',
					'www-authenticate': `Bearer error="insufficient_scope", scope="contacts"`
				});
				response.end(JSON.stringify({ error: notAllowed }));
				return;
			}
			if (readsStored && this.current) {
				const answer = await this.#readsTheStoredToken(
					this.current,
					request.headers.authorization.split(' ')[1]
				);
				response.writeHead(answer.status, { 'content-type': 'application/json' });
				response.end(answer.text);
				return;
			}
			if (passesItOn && this.current) {
				const answer = await this.#fromTheSecondApi(
					this.current,
					request.headers.authorization.split(' ')[1]
				);
				response.writeHead(answer.status, { 'content-type': 'application/json' });
				response.end(answer.text);
				return;
			}
			response.writeHead(200, { 'content-type': 'application/json' });
			response.end(
				JSON.stringify({
					resource:
						this.current?.clientId === SERVICE_CLIENT
							? 'something only this app may see'
							: 'something only this user may see'
				})
			);
		});

		// The API the first one calls, which takes only a token that names it.
		const secondApi = createServer(async (request, response) => {
			const problem = await accessTokenProblem(
				{
					authorization: request.headers.authorization,
					method: request.method ?? 'GET',
					url: `${SECOND_API}${request.url}`
				},
				{
					issuers: [LOCAL_REALM, BROKERED_REALM].map((realm) => `${KEYCLOAK}/realms/${realm}`),
					audience: SECOND_API_CLIENT,
					keysOf: (issuer) => keysAt(`${issuer}/protocol/openid-connect/certs`),
					seenProofs: this.#seenProofs
				}
			);
			if (problem) {
				response.writeHead(401, {
					'content-type': 'application/json',
					'www-authenticate': `Bearer error="invalid_token", error_description="${problem}"`
				});
				response.end(JSON.stringify({ error: problem }));
				return;
			}
			response.writeHead(200, { 'content-type': 'application/json' });
			response.end(JSON.stringify({ resource: 'what the second API has for this user' }));
		});

		// Keycloak's calls to the upstream IdP pass through here on their way to the same Keycloak.
		const proxy = createServer(async (request, response) => {
			const body = await readBody(request);
			const target = `${KEYCLOAK}${request.url}`;
			const isToken = request.url?.endsWith('/token');
			const headers: Record<string, string> = {};
			for (const name of ['authorization', 'content-type', 'accept']) {
				const value = request.headers[name];
				if (typeof value === 'string') headers[name] = value;
			}
			if (isToken && this.current) {
				await settle();
				this.current.messages.push(
					requestMessage(
						this.current.linking ? 'link-upstream-token-request' : 'upstream-token-request',
						request.method ?? 'POST',
						target,
						headers,
						body
					)
				);
			}
			const answer = await fetch(target, {
				method: request.method,
				headers,
				body: body || undefined
			});
			const text = await answer.text();
			if (isToken && this.current) {
				this.current.messages.push(
					responseMessage(
						this.current.linking ? 'link-upstream-token-response' : 'upstream-token-response',
						answer.status,
						answer.headers,
						text
					)
				);
			}
			response.writeHead(answer.status, {
				'content-type': answer.headers.get('content-type') ?? 'application/json'
			});
			response.end(text);
		});

		// Another app, with a registration of its own, and all it shares is the identity provider.
		const second = createServer(async (request, response) => {
			const url = new URL(request.url ?? '/', SECOND_APP);
			if (url.pathname === '/backchannel') {
				const body = String(await readBody(request));
				if (this.current) {
					await settle();
					this.current.messages.push(
						requestMessage(
							'backchannel-logout',
							'POST',
							BACKCHANNEL_SHOWN,
							request.headers as Record<string, string>,
							body
						),
						responseMessage('backchannel-response', 200, {})
					);
				} else {
					this.logoutTokens.push(new URLSearchParams(body).get('logout_token') ?? '');
				}
				response.writeHead(200);
				response.end();
				return;
			}
			const run = this.#run;
			const { oidc, ssoAsks } = run.settings;
			if (url.pathname === '/') {
				const query = new URLSearchParams({
					response_type: 'code',
					client_id: SECOND_CLIENT,
					redirect_uri: SECOND_REDIRECT_URI,
					state: random()
				});
				if (oidc) {
					query.set('scope', 'openid');
					query.set('nonce', random());
				}
				if (ssoAsks === 'insists') query.set('prompt', 'login');
				if (ssoAsks === 'fresh') query.set('prompt', 'none');
				response.writeHead(302, { location: `${this.#server.authorization_endpoint}?${query}` });
				response.end();
				return;
			}
			const code = url.searchParams.get('code');
			let outcome = 'Not logged in';
			if (code) {
				await settle();
				const answer = await call(
					run,
					['second-token-request', 'second-token-response'],
					'POST',
					this.#server.token_endpoint,
					{ authorization: basicAuth(SECOND_CLIENT, CLIENT_SECRET) },
					{ grant_type: 'authorization_code', code, redirect_uri: SECOND_REDIRECT_URI }
				);
				outcome = answer.status === 200 ? 'Logged in' : `Failed ${answer.text}`;
			}
			response.writeHead(200, { 'content-type': 'text/html' });
			response.end(`<h1>${outcome}</h1>`);
		});

		// Someone else's site, which a link of theirs sends the code to, and which trades it at once.
		const theirs = createServer(async (request, response) => {
			const code = new URL(request.url ?? '/', ATTACKER_SITE).searchParams.get('code');
			let outcome = 'Nothing came';
			if (code && this.current) {
				await settle();
				outcome = await this.#tradeTheirs(code);
			}
			response.writeHead(200, { 'content-type': 'text/html' });
			response.end(`<h1>${outcome}</h1>`);
		});

		await listen(app, APP);
		await listen(api, API);
		await listen(proxy, `http://0.0.0.0:${PROXY_PORT}`);
		await listen(second, SECOND_APP);
		await listen(theirs, ATTACKER_SITE);
		await listen(secondApi, SECOND_API);
		this.#servers = [app, api, proxy, second, theirs, secondApi];
	}

	stop() {
		for (const server of this.#servers) server.close();
	}
}
