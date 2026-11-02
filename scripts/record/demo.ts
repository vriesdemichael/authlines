// A real little app and API, doing what the diagram says an app and an API do, and writing down
// everything that crosses the wire while they do it.
import { generateKeyPairSync, randomBytes, sign, type KeyObject } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { Settings } from '#lib/flow/settings.ts';
import type { RecordedMessage } from '#lib/recordings/format.ts';
import { accessTokenProblem, idTokenProblem, scopeProblem, sha256, type Jwk } from './checks.ts';
import {
	API,
	API_AUDIENCE,
	API_CLIENT,
	APP,
	BROKERED_REALM,
	CLIENT_SECRET,
	CONFIDENTIAL_CLIENT,
	KEYCLOAK,
	LOCAL_REALM,
	POST_LOGOUT_URI,
	PROXY_PORT,
	REDIRECT_URI,
	SECOND_APP,
	SECOND_CLIENT,
	SERVICE_CLIENT,
	SECOND_REDIRECT_URI,
	UPSTREAM_REALM
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
const KEPT_RESPONSE_HEADERS = ['location', 'content-type', 'www-authenticate', 'dpop-nonce'];

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

export interface Run {
	settings: Settings;
	realm: string;
	clientId: string;
	clientSecret: string | null;
	messages: RecordedMessage[];
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
	authorization_endpoint: string;
	token_endpoint: string;
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

interface Tokens {
	access_token: string;
	id_token?: string;
	refresh_token: string;
	token_type: string;
	error?: string;
}

export class Demo {
	current: Run | null = null;
	/** The code from a login that was not part of a run, for trying things out with it. */
	lastCode = '';
	/** Logout tokens that came in with no run going, for a question to count. */
	logoutTokens: string[] = [];
	#tokens: Tokens | null = null;
	#servers: Server[] = [];
	#discovered: Discovered | null = null;
	#state = '';
	#nonce: string | null = null;
	#key: ProofKey | null = null;
	#verifier: string | null = null;
	#seenProofs = new Set<string>();
	/** Someone is handing the real app a stolen code, from a login of their own. */
	#handed = false;

	get #run() {
		if (!this.current) throw new Error('No run in progress');
		return this.current;
	}

	get #server() {
		if (!this.#discovered) throw new Error('The app has not looked up its identity provider');
		return this.#discovered;
	}

	/** The one thing the app is told is the issuer. Everything else it asks for. */
	async discover(run: Run) {
		const name = run.settings.oidc ? 'openid-configuration' : 'oauth-authorization-server';
		const url = `${KEYCLOAK}/realms/${run.realm}/.well-known/${name}`;
		const answer = await call(run, ['discover', 'discovery-document'], 'GET', url);
		this.#discovered = jsonOf<Discovered>(answer.text);
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
		const resource = `${API}${{ elsewhere: '/my-api/resource', noscope: '/contacts' }[apiToken as string] ?? '/resource'}`;
		// The token has a very short life for this one, set up in keycloak.ts, so it just has to wait.
		if (apiToken === 'expired') await new Promise((resolve) => setTimeout(resolve, 2100));
		const sent = apiToken === 'changed' ? withMoreInIt(tokens.access_token) : tokens.access_token;
		const answer = await call(
			run,
			['api-request', 'api-response'],
			'GET',
			resource,
			apiToken === 'none' ? {} : this.#authorization('GET', resource, sent)
		);
		if (answer.status !== 200 && apiToken === 'good') {
			throw new Error(`The API refused: ${answer.text}`);
		}
		if (answer.status === 200 && apiToken !== 'good') {
			throw new Error(`The API accepted what it should not: ${apiToken}`);
		}

		if (settings.upstreamTokens !== 'off') await this.#storedToken(tokens.access_token);
		if (settings.refresh) await this.#whenItRunsOut(tokens);
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
		if (asked.status !== 401) throw new Error(`The API that asks took it: ${asked.text}`);
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
		if (refresh.status !== 400) throw new Error(`The refresh still works: ${refresh.text}`);
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
			if (url.pathname === '/') {
				const run = this.#run;
				const { settings } = run;
				this.#state = random();
				this.#key = settings.binding === 'dpop' ? new ProofKey() : null;
				this.#verifier = settings.pkce ? random() + random() : null;
				this.#nonce = settings.oidc ? random() : null;
				const query = new URLSearchParams({
					response_type: 'code',
					client_id: run.clientId,
					redirect_uri: REDIRECT_URI,
					state: this.#state
				});
				if (this.#nonce) {
					query.set('scope', 'openid');
					query.set('nonce', this.#nonce);
				}
				if (this.#key) query.set('dpop_jkt', this.#key.thumbprint);
				if (this.#verifier) {
					query.set('code_challenge', sha256(this.#verifier));
					query.set('code_challenge_method', 'S256');
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
			// With nothing to be wrong, there is no error to name (RFC 6750 section 3.1).
			if (!request.headers.authorization) {
				response.writeHead(401, {
					'content-type': 'application/json',
					'www-authenticate': 'Bearer'
				});
				response.end(JSON.stringify({ error: 'no token' }));
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
			const problem = await accessTokenProblem(
				{
					authorization: request.headers.authorization,
					dpop: request.headers.dpop as string | undefined,
					method: request.method ?? 'GET',
					url: `${API}${request.url}`
				},
				{
					issuers: [LOCAL_REALM, BROKERED_REALM].map((realm) => `${KEYCLOAK}/realms/${realm}`),
					// One API that expects its own name, as yours should, which a default client's token lacks.
					audience: request.url?.startsWith('/my-api/') ? 'my-api' : API_AUDIENCE,
					keysOf: (issuer) => keysAt(`${issuer}/protocol/openid-connect/certs`),
					seenProofs: this.#seenProofs
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
					requestMessage('upstream-token-request', request.method ?? 'POST', target, headers, body)
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
					responseMessage('upstream-token-response', answer.status, answer.headers, text)
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

		await listen(app, APP);
		await listen(api, API);
		await listen(proxy, `http://0.0.0.0:${PROXY_PORT}`);
		await listen(second, SECOND_APP);
		this.#servers = [app, api, proxy, second];
	}

	stop() {
		for (const server of this.#servers) server.close();
	}
}
