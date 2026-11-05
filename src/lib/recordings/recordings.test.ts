import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { authorizationCodeBase as base, flows } from '#lib/flow/index.ts';
import { evaluate, holdingsAt, type Field, type DiagramView, type Step } from '#lib/flow/model.ts';
import { allValidSettings, defaultSettings, normalize, type Settings } from '#lib/flow/settings.ts';
import type { ArtifactId } from '#lib/flow/vocabulary.ts';
import type { RecordedMessage, Recording } from '#lib/recordings/format.ts';
import { knownFrom, provenance, recordedIndex, recordingFor } from '#lib/recordings/known.ts';
import { shapeDifferences, shapeOf } from '#lib/recordings/shape.ts';

const FOLDER = 'static/recordings/authorization-code';

function read(preset: string): Recording {
	return JSON.parse(readFileSync(`${FOLDER}/${preset}.json`, 'utf8'));
}

const recordings = base.presets.map((preset) => read(preset.id));
const asCases = recordings.map((recording) => [recording.preset, recording] as const);

function viewsOf(recording: Recording): DiagramView[] {
	return [base.diagrams.setup, base.diagrams.flow].map((flow) =>
		evaluate(flow, recording.settings)
	);
}

function stepsOf(recording: Recording): Step[] {
	return viewsOf(recording).flatMap((view) => view.steps);
}

const onTheWire = (step: Step) => step.channel === 'front' || step.channel === 'back';

/** The names a message carries, wherever in the message they are. */
function carried(message: RecordedMessage) {
	const target = message.url ?? message.headers.location;
	const query = target ? new URL(target).searchParams : new URLSearchParams();
	const body: Record<string, unknown> =
		message.body && typeof message.body === 'object'
			? (message.body as Record<string, unknown>)
			: {};
	return { query, body };
}

function fieldIsThere(field: Field, message: RecordedMessage): boolean {
	const { query, body } = carried(message);
	const [name, value] = field.name.split('=');
	switch (field.place) {
		case 'path':
			return (message.url ?? '').includes(field.name);
		case 'query':
			if (value === undefined) return query.has(name);
			return (query.get(name) ?? '').split(' ').includes(value);
		case 'body':
			if (field.name === 'username and password') return 'username' in body && 'password' in body;
			if (value === undefined) return name in body;
			return String(body[name]).split(' ').includes(value);
		case 'header':
			if (field.name.startsWith('Authorization: ')) {
				return (message.headers.authorization ?? '').startsWith(field.name.slice(15));
			}
			return field.name.toLowerCase() in message.headers;
		default:
			return true;
	}
}

// What Keycloak adds that is its own business, which the protocol layer rightly does not show.
const KEYCLOAK_ONLY = new Set([
	// What else it says about a client that has just registered itself, beyond what RFC 7591 lists.
	'subject_type',
	'request_uris',
	'tls_client_certificate_bound_access_tokens',
	'dpop_bound_access_tokens',
	'post_logout_redirect_uris',
	'backchannel_logout_session_required',
	'frontchannel_logout_session_required',
	'require_pushed_authorization_requests',
	'session_state',
	'refresh_expires_in',
	'not-before-policy',
	'credentialId',
	'session_code',
	'execution',
	'tab_id',
	'client_data',
	'accessTokenExpiration'
]);

// Answers whose whole point is what is in them, where the fields name the ones the diagram relies
// on. And redirects, which carry what the next request sends, and the diagram shows it there.
const SAYS_WHO_THIS_IS = new Set(['logout-redirect', 'end-session']);

const OPEN_ENDED = new Set([
	'discovery-document',
	'userinfo-response',
	'api-response',
	'api-refused',
	'second-redirect-to-idp',
	'logout-redirect',
	'token-after-logout-response',
	// With offline access, still active, and all the token says (#184).
	'introspect-response',
	'api-after-logout-response',
	'asks-after-logout-response',
	'api-response-new',
	'attacker-api-response',
	'redirect-to-idp',
	'redirect-to-upstream'
]);

// The address of a login form is Keycloak's own business. What matters is what the form sends.
const SIGN_IN = new Set([
	'submit-credentials',
	'second-submit-credentials',
	'upstream-sign-in',
	'submit-email',
	'consent-grant'
]);

function namesInMessage(message: RecordedMessage): string[] {
	const { query, body } = carried(message);
	const inQuery = SIGN_IN.has(message.step ?? '') ? [] : query.keys();
	return [...new Set([...inQuery, ...Object.keys(body)])];
}

function namesInStep(step: Step): Set<string> {
	return new Set(
		step.fields.flatMap((field) =>
			field.name === 'username and password' ? ['username', 'password'] : field.name.split('=')[0]
		)
	);
}

describe.each(asCases)('the recording of %s', (preset, recording) => {
	const recorded = recording.messages.filter((m) => m.step);

	it('has every message the diagram draws, unless the data says it is from the spec', () => {
		const seen = new Set(recorded.map((m) => m.step));
		const missing = stepsOf(recording)
			.filter(onTheWire)
			.filter((step) => !step.specOnly && !seen.has(step.id))
			.map((step) => step.id);
		expect(missing).toEqual([]);
	});

	// A flag shows in discovery, so a recording made on a server with one it did not need says so (#186).
	it('was made on a server with a document flag only if it points at a document', () => {
		const discovery = recorded.find((message) => message.step === 'discovery-document');
		if (!discovery) return;
		const { body } = carried(discovery);
		expect(Boolean(body.client_id_metadata_document_supported)).toBe(
			recording.settings.registration === 'cimd'
		);
	});

	it('has no message the diagram does not draw', () => {
		const drawn = new Set(stepsOf(recording).map((step) => step.id));
		expect(recorded.map((m) => m.step).filter((step) => !drawn.has(step!))).toEqual([]);
	});

	it('has the status its label says', () => {
		const steps = new Map(stepsOf(recording).map((step) => [step.id, step]));
		const wrong = recorded.flatMap((message) => {
			const status = steps.get(message.step!)?.label.match(/^\d{3}\b/)?.[0];
			return status && status !== String(message.status)
				? [`${message.step}: says ${status}, was ${message.status}`]
				: [];
		});
		expect(wrong).toEqual([]);
	});

	it('happened in the order the diagram draws it', () => {
		const order = stepsOf(recording).map((step) => step.id);
		const positions = recorded.map((m) => order.indexOf(m.step!));
		expect(positions).toEqual([...positions].sort((a, b) => a - b));
	});

	it('carries every field the diagram says it does', () => {
		const wrong = recorded.flatMap((message) => {
			const step = stepsOf(recording).find((s) => s.id === message.step)!;
			return step.fields
				.filter((field) => !fieldIsThere(field, message))
				.map((field) => `${step.id}: ${field.name}`);
		});
		expect(wrong).toEqual([]);
	});

	it('carries nothing that the diagram leaves out, apart from what is only Keycloak', () => {
		const wrong = recorded.flatMap((message) => {
			if (OPEN_ENDED.has(message.step!)) return [];
			const step = stepsOf(recording).find((s) => s.id === message.step)!;
			const shown = namesInStep(step);
			return namesInMessage(message)
				.filter((name) => !shown.has(name) && !KEYCLOAK_ONLY.has(name))
				.map((name) => `${step.id}: ${name}`);
		});
		expect(wrong).toEqual([]);
	});

	const basicAuthOf = (secret: string, client = 'demo-app') =>
		Buffer.from(`${client}:${secret}`).toString('base64');

	// The chips under each lifeline are the most prominent claim on the screen, so hold them to it.
	it('shows each credential and token exactly where the diagram says it goes', () => {
		const valueIn = (step: string, name: string) => {
			const message = recorded.find((m) => m.step === step);
			if (!message) return undefined;
			const { query, body } = carried(message);
			return query.get(name) ?? (body[name] as string | undefined);
		};
		const sessionIn = (step: string) =>
			recorded
				.find((message) => message.step === step)
				?.headers['set-cookie']?.match(/KEYCLOAK_IDENTITY=([^;]+)/)?.[1];
		const values: Partial<Record<ArtifactId, (string | undefined)[]>> = {
			password: ['throwaway-password'],
			secret: [
				valueIn('dcr-response', 'client_secret') ??
					(recording.settings.clientType === 'confidential' ? 'throwaway-client-secret' : undefined)
			],
			code: [valueIn('redirect-with-code', 'code'), valueIn('second-redirect-with-code', 'code')],
			session: [sessionIn('redirect-with-code'), sessionIn('second-redirect-with-code')],
			verifier: [valueIn('token-request', 'code_verifier')],
			challenge: [valueIn('authorize', 'code_challenge')],
			// A new one is the same kind of thing, so the chip stays and the value changes.
			'access-token': [
				valueIn('token-response', 'access_token'),
				valueIn('refresh-response', 'access_token'),
				valueIn('refresh-again-response', 'access_token'),
				valueIn('second-token-response', 'access_token'),
				valueIn('left-refresh-response', 'access_token'),
				valueIn('refresh-after-logout-response', 'access_token')
			],
			'id-token': [
				valueIn('token-response', 'id_token') ?? valueIn('attacker-token-response', 'id_token'),
				valueIn('refresh-response', 'id_token'),
				valueIn('refresh-again-response', 'id_token'),
				valueIn('second-token-response', 'id_token'),
				valueIn('refresh-after-logout-response', 'id_token')
			],
			'refresh-token': [
				valueIn('token-response', 'refresh_token') ??
					valueIn('attacker-token-response', 'refresh_token'),
				valueIn('refresh-response', 'refresh_token'),
				valueIn('refresh-again-response', 'refresh_token'),
				valueIn('second-token-response', 'refresh_token'),
				valueIn('left-refresh-response', 'refresh_token'),
				valueIn('refresh-after-logout-response', 'refresh_token')
			],
			'upstream-token': [valueIn('upstream-token-response', 'access_token')]
		};

		const wrong = recorded.flatMap((message) => {
			const step = stepsOf(recording).find((s) => s.id === message.step)!;
			const text = JSON.stringify(message);
			return Object.entries(values).flatMap(([artifact, each]) => {
				const known = each.filter((value) => value !== undefined);
				if (!known.length) return [];
				const claimed = step.fields.some((field) => field.artifact === artifact);
				const there = known.some(
					(value) =>
						text.includes(value) ||
						(artifact === 'access-token' &&
							recording.settings.apiToken === 'changed' &&
							value.split('.').every((part, at) => at === 1 || text.includes(part))) ||
						(artifact === 'password' &&
							text.includes(Buffer.from(`alice:${value}`).toString('base64'))) ||
						(artifact === 'secret' &&
							(text.includes(basicAuthOf(value)) ||
								text.includes(basicAuthOf(value, 'demo-app-two')) ||
								text.includes(basicAuthOf(value, valueIn('dcr-response', 'client_id')))))
				);
				return claimed === there
					? []
					: [`${step.id}: ${artifact} ${there ? 'is there' : 'is not there'}`];
			});
		});
		expect(wrong).toEqual([]);
	});

	it('has a challenge that really is the fingerprint of the verifier', () => {
		if (recording.settings.oldWay) return;
		// Whoever started the login made the pair, which with a link of theirs is someone else.
		const trade =
			recording.settings.attackerGets === 'link' ? 'attacker-token-request' : 'token-request';
		const body = recorded.find((m) => m.step === trade)?.body as Record<string, string>;
		// Pushed first, the challenge goes in the push, and the browser never carries it.
		const pushed = recorded.find((m) => m.step === 'push-request')?.body as
			Record<string, string> | undefined;
		const authorize = recorded.find((m) => m.step === 'authorize')!;
		if (pushed) expect(carried(authorize).query.get('code_challenge')).toBeNull();
		const challenge = pushed
			? (pushed.code_challenge ?? null)
			: carried(authorize).query.get('code_challenge');
		if (!recording.settings.pkce) {
			expect(challenge).toBeNull();
			expect(body?.code_verifier).toBeUndefined();
			return;
		}
		const worked = createHash('sha256').update(body.code_verifier).digest('base64url');
		expect(worked).toBe(challenge);
	});

	it('never lets a token through the browser', () => {
		// An app in the page is the one exception, which is the whole of what it shows.
		if (recording.settings.appRuns === 'page') return;
		const tokens = ['token-response', 'upstream-token-response'].flatMap((step) => {
			const body = recorded.find((m) => m.step === step)?.body as
				Record<string, string> | undefined;
			return body ? [body.access_token, body.id_token, body.refresh_token].filter(Boolean) : [];
		});
		const views = stepsOf(recording);
		for (const message of recorded) {
			const step = views.find((s) => s.id === message.step)!;
			if (step.channel !== 'front') continue;
			for (const token of tokens) {
				// Logging out is the one exception: the app sends the ID token to say who this is.
				const idToken = recorded.find((m) => m.step === 'token-response')?.body as
					Record<string, string> | undefined;
				if (token === idToken?.id_token && SAYS_WHO_THIS_IS.has(step.id)) continue;
				expect(JSON.stringify(message)).not.toContain(token);
			}
		}
	});

	it('holds only throwaway values', () => {
		const text = readFileSync(`${FOLDER}/${preset}.json`, 'utf8');
		expect(text).not.toMatch(/-----BEGIN|ghp_|gho_|github_pat_|AKIA[0-9A-Z]{12}|sk-ant-/);
		const hosts = [...text.matchAll(/https?:\/\/([^/"'\s:?]+)/g)].map((match) => match[1]);
		// 127.0.0.1 is the computer itself, where a program hears the answer (#178).
		const allowed = new Set(['localhost', 'host.docker.internal', '127.0.0.1']);
		expect(hosts.filter((host) => !allowed.has(host))).toEqual([]);
		const emails = [...text.matchAll(/[\w.+-]+@[\w-]+\.[\w.]+/g)].map((match) => match[0]);
		// At a domain reserved for testing (RFC 2606), so no address in a recording is anyone's.
		expect(emails.filter((email) => !/@([\w-]+\.)*test$/.test(email))).toEqual([]);
		expect(text).toContain('"keycloak"');
	});

	it('was made with the settings of its named state', () => {
		const wanted = base.presets.find((p) => p.id === preset)!;
		const expected = normalize({ ...defaultSettings, ...wanted.settings }).settings;
		for (const id of base.settings) {
			expect(recording.settings[id] ?? defaultSettings[id], id).toEqual(expected[id]);
		}
	});
});

describe('the words after a logout', () => {
	it.each(['logout', 'logout-two-apps'])('%s says what it really said', (preset) => {
		const recording = read(preset);
		const statusOf = (step: string) =>
			recording.messages.find((message) => message.step === step)?.status;
		const labelOf = (step: string) => stepsOf(recording).find(({ id }) => id === step)?.label;
		expect(statusOf('token-after-logout-response')).toBe(200);
		expect(labelOf('token-after-logout-response')).toMatch(/^200/);
		expect(statusOf('asks-after-logout-response')).toBe(401);
		expect(labelOf('asks-after-logout-response')).toMatch(/^401/);
		expect(statusOf('refresh-after-logout-response')).toBe(400);
		expect(labelOf('refresh-after-logout-response')).toMatch(/^400/);
		const asked = recording.messages.find(({ step }) => step === 'introspect-response');
		expect((asked?.body as { active: boolean }).active).toBe(false);
		expect(labelOf('introspect-response')).toBe('active: false');
	});

	it('tells the second app, from a real delivery', () => {
		const told = read('logout-two-apps').messages.find(({ step }) => step === 'backchannel-logout');
		expect((told?.body as { logout_token: string }).logout_token.split('.')).toHaveLength(3);
		expect(read('logout').messages.map(({ step }) => step)).not.toContain('backchannel-logout');
	});
});

// #182: what the identity provider sends on to the other provider is its own, and not the app's.
describe('the words on the request to the other provider', () => {
	const brokered = recordings.filter(({ settings }) => settings.broker && !settings.companies);
	const sent = (recording: Recording, step: string) => {
		const message = recording.messages.find((candidate) => candidate.step === step);
		return new URL(message?.url ?? '').searchParams;
	};

	it.each(brokered.filter(({ settings }) => settings.pkce).map((r) => [r.preset, r] as const))(
		'%s: the app’s challenge stops at the identity provider, as the step says',
		(_, recording) => {
			expect(sent(recording, 'authorize').has('code_challenge')).toBe(true);
			expect(sent(recording, 'upstream-authorize').has('code_challenge')).toBe(false);
			const step = stepsOf(recording).find(({ id }) => id === 'upstream-authorize');
			expect(step?.concept).toContain('the server recorded sent none');
		}
	);

	it.each(brokered.map((r) => [r.preset, r] as const))(
		'%s: asks the other provider for the scope it was set up with, whatever the app asked',
		(_, recording) => {
			expect(sent(recording, 'upstream-authorize').get('scope')).toBe('openid');
		}
	);

	it('holds the field to that, from an app that asked for none', () => {
		expect(sent(read('broker'), 'authorize').get('scope')).toBeNull();
	});
});

describe('the words on a second app', () => {
	it.each([
		['sso-oidc', 'code=', '302 back with a code', 'so no form'],
		['sso-insists', 'code=', '302 back with a code', 'but asks'],
		['sso-fresh', 'error=login_required', '302 error=login_required', 'does not know']
	])('%s says what it really said', (preset, location, label, known) => {
		const recording = read(preset);
		const answer = recording.messages.find(
			(message) => message.step === 'second-redirect-with-code'
		);
		expect(answer?.headers.location).toContain(location);
		const steps = stepsOf(recording);
		expect(steps.find(({ id }) => id === 'second-redirect-with-code')?.label).toBe(label);
		expect(steps.find(({ id }) => id === 'idp-recognises')?.plain).toContain(known);
	});
});

describe('the words on a refresh token used twice', () => {
	const again = (preset: string) => {
		const recording = read(preset);
		const steps = stepsOf(recording);
		return {
			status: recording.messages.find((message) => message.step === 'refresh-again-response')
				?.status,
			answer: steps.find(({ id }) => id === 'refresh-again-response'),
			request: steps.find(({ id }) => id === 'refresh-again')
		};
	};

	it.each([
		['refresh', 200, 'still works', '200 with new tokens'],
		['refresh-public', 200, 'still works', '200 with new tokens'],
		['refresh-ends', 400, 'Refused', '400 invalid_grant']
	])('%s says what it really said', (preset, status, plain, label) => {
		const { status: said, answer } = again(preset);
		expect(said).toBe(status);
		expect(answer?.plain).toContain(plain);
		expect(answer?.label).toBe(label);
	});

	it('says a secret is needed where a real server wanted one', () => {
		const answers = JSON.parse(readFileSync(`${FOLDER}/questions.json`, 'utf8'));
		expect((answers.answers ?? answers).refreshTokens.withoutTheSecret.status).toBe(401);
		expect(again('refresh').request?.concept).toContain('need the secret as well');
		expect(again('refresh-public').request?.concept).toContain('all they need');
	});
});

describe('the questions a real server was asked', () => {
	it('say when one was asked after the rest, and only of answers that are there', () => {
		const {
			recordedAt,
			askedOn = {},
			answers
		} = JSON.parse(readFileSync(`${FOLDER}/questions.json`, 'utf8'));
		for (const [key, on] of Object.entries<string>(askedOn)) {
			const [first, page] = key.split('.');
			expect(page ? answers[first][page] : answers[first], key).toBeDefined();
			expect(on >= recordedAt, key).toBe(true);
		}
	});
});

describe('the words on what an API answered', () => {
	it.each([
		['api-no-token', 401, 'Bearer', 'asks for a token', '401 with no error'],
		['api-expired', 401, 'expired', 'has expired', '401 invalid_token'],
		['api-changed', 401, 'bad signature', 'signature is wrong', '401 invalid_token'],
		['api-elsewhere', 401, 'not for this API', 'for someone else', '401 invalid_token'],
		['api-no-scope', 403, 'insufficient_scope', 'does not allow this', '403 insufficient_scope']
	])('%s says what it really said', (preset, status, said, plain, label) => {
		const recording = read(preset);
		const answer = recording.messages.find((message) => message.step === 'api-response');
		expect(answer?.status).toBe(status);
		expect(answer?.headers['www-authenticate']).toContain(said);
		const step = stepsOf(recording).find(({ id }) => id === 'api-response');
		expect(step?.plain).toContain(plain);
		expect(step?.label).toBe(label);
	});
});

describe('a server behind the page', () => {
	const recording = read('behind-the-page');
	const toTheAppsServer = recording.messages.filter(
		({ url, direction }) => direction === 'request' && url?.startsWith('http://localhost:9100')
	);

	it('sends the cookie the screen says, with the flags it says', () => {
		const given = recording.messages.find(({ step }) => step === 'set-session');
		expect(given?.headers['set-cookie']).toMatch(/; Path=\/; Secure; HttpOnly; SameSite=Strict$/);
		const sent = recording.messages.find(({ step }) => step === 'page-calls-api');
		expect(sent?.headers.cookie).toContain('__Host-Http-session=');
		expect(given?.headers['set-cookie']).toContain(sent?.headers.cookie);
	});

	it('never lets the browser send a token, and the server does', () => {
		expect(toTheAppsServer.length).toBeGreaterThan(3);
		for (const message of toTheAppsServer) expect(JSON.stringify(message)).not.toContain('eyJ');
		expect(
			recording.messages.find(({ step }) => step === 'api-request')?.headers.authorization
		).toMatch(/^Bearer eyJ/);
	});

	it('says what a real page could and could not do', () => {
		const { answers } = JSON.parse(readFileSync(`${FOLDER}/questions.json`, 'utf8'));
		expect(answers.scriptBehindThePage).toEqual({
			readsTheCookie: false,
			findsAToken: false,
			throughTheServer: 200
		});
	});
});

describe('a stolen DPoP token', () => {
	const answered = (preset: string) =>
		read(preset).messages.find(({ step }) => step === 'thief-api-response');
	const said = (preset: string) =>
		stepsOf(read(preset)).find(({ id }) => id === 'thief-api-response');

	it('gets two answers by what the API checks, as two real runs did', () => {
		expect(answered('dpop-thief')?.status).toBe(401);
		expect(answered('dpop-thief')?.headers['www-authenticate']).toContain('invalid_token');
		expect(said('dpop-thief')?.label).toBe('401 invalid_token');
		expect(answered('dpop-thief-bearer-only')?.status).toBe(200);
		expect(said('dpop-thief-bearer-only')?.label).toBe('200 with the resource');
	});

	it('is the token the app got, tied to a key, and sent with no proof', () => {
		for (const preset of ['dpop-thief', 'dpop-thief-bearer-only']) {
			const { messages } = read(preset);
			const got = messages.find(({ step }) => step === 'token-response')?.body as {
				access_token: string;
			};
			const sent = messages.find(({ step }) => step === 'thief-api-request');
			expect(sent?.headers.authorization, preset).toBe(`Bearer ${got.access_token}`);
			expect(sent?.headers.dpop, preset).toBeUndefined();
			const claims = JSON.parse(
				Buffer.from(got.access_token.split('.')[1], 'base64url').toString()
			);
			expect(claims.cnf?.jkt, preset).toBeTruthy();
		}
	});
});

describe('a customer with a provider of their own', () => {
	const access = (preset: string) => {
		const answer = read(preset).messages.find(({ step }) => step === 'token-response');
		const { access_token: token } = answer?.body as { access_token: string };
		return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
	};
	const names = (preset: string) => Object.keys(access(preset)).sort();

	// The screen says the token is the same with one thing more, so it comes from the real runs.
	it('gets the claims another provider gets, and which customer they are from', () => {
		expect(names('companies')).toEqual([...names('broker'), 'organization'].sort());
		expect(access('companies').organization).toEqual(['globex']);
		expect(access('companies-saml').organization).toEqual(['acme']);
		const said = stepsOf(read('companies')).find(({ id }) => id === 'token-response');
		expect(said?.concept).toContain('which customer they are from');
	});

	it('gets the same token whether their provider speaks SAML or OpenID Connect', () => {
		expect(names('companies-saml')).toEqual(names('companies'));
	});

	it('asks only for the email, and goes to the provider of its domain', () => {
		for (const [preset, customer] of [
			['companies', 'globex'],
			['companies-saml', 'acme']
		]) {
			const { messages } = read(preset);
			const sent = messages.findIndex(({ step }) => step === 'submit-email');
			expect(Object.keys(messages[sent].body as object), preset).toEqual(['username']);
			expect(messages[sent + 1].headers.location, preset).toContain(`/broker/${customer}/login`);
		}
	});

	const { answers } = JSON.parse(readFileSync(`${FOLDER}/questions.json`, 'utf8'));

	it('says what a real server did with someone who has a password of ours', () => {
		const { passwordHere } = answers;
		expect(passwordHere).toMatchObject({ goesTo: null, asksForPassword: true, loggedIn: true });
		expect(passwordHere.buttons).toEqual(['acme', 'globex']);
		expect(passwordHere.organization).toBeUndefined();
		const step = stepsOf(read('companies')).find(({ id }) => id === 'find-company');
		expect(step?.pitfall?.text).toMatch(/not sent to their company[\s\S]*every customer's button/);
	});

	it('covers a subdomain only with a pattern, as the setup says', () => {
		const { exact, pattern } = answers.companyDomains;
		expect(exact.atASubdomain.goesTo).toBeNull();
		expect(pattern.atASubdomain.goesTo).toBe('acme');
		expect(pattern.atTheDomain.goesTo).toBe('acme');
		const setup = evaluate(base.diagrams.setup, read('companies').settings);
		const domain = setup.steps
			.find(({ id }) => id === 'add-organization')
			?.fields.find(({ name }) => name === 'domain');
		expect(domain?.note).toContain('acme.test is only that, and *.acme.test its subdomains too');
	});

	// The chips are the most prominent claim on the screen, and the point of SAML here is that the
	// browser carries the answer itself.
	it('shows the browser holding the assertion, which the recording has it send', () => {
		const recording = read('companies-saml');
		const view = evaluate(base.diagrams.flow, recording.settings);
		expect(holdingsAt(view, 'upstream-callback').browser).toContain('assertion');
		expect(holdingsAt(view, 'upstream-callback').app).not.toContain('assertion');
		const sent = recording.messages.find(({ step }) => step === 'upstream-callback');
		expect(Object.keys(sent?.body as object)).toContain('SAMLResponse');
	});

	// What a customer most wants to know, so each part comes from a real run and not from me.
	it('says what still worked after someone left, as two real runs did', () => {
		for (const preset of ['companies-leaves', 'companies-oidc-leaves']) {
			const { messages } = read(preset);
			const status = (step: string) => messages.find((m) => m.step === step)?.status;
			expect(status('left-api-response'), preset).toBe(200);
			expect(status('left-refresh-response'), preset).toBe(200);
			const again = messages.findIndex(({ step }) => step === 'login-again');
			expect(messages[again + 1].step, preset).toBe('code-again');
			expect(messages[again + 1].headers.location, preset).toContain('code=');
			// Nothing went to their company on the way back.
			expect(
				messages.slice(again).some(({ url }) => url?.includes('/realms/acme/')),
				preset
			).toBe(false);
			expect(
				messages.slice(again).some(({ url }) => url?.includes('/realms/globex/')),
				preset
			).toBe(false);
		}
	});

	it('says when it stops, as a real server answered', () => {
		const { acme, globex, session } = answers.whenSomeoneLeaves;
		for (const { withNoSession, keptHere, before } of [acme, globex]) {
			expect(before.loggedIn).toBe(true);
			expect(withNoSession).toMatchObject({ loggedIn: false, atTheirCompany: true });
			expect(withNoSession.says).toBe('Account is disabled, contact your administrator.');
			expect(keptHere.enabled).toBe(true);
		}
		const { withNoSession } = acme;
		expect(session).toEqual({ idleMinutes: 30, maxHours: 10 });
		const step = stepsOf(read('companies-leaves')).find(({ id }) => id === 'code-again');
		const text = step?.pitfall?.text ?? '';
		expect(text).toContain(withNoSession.says);
		expect(text).toContain(
			`${session.idleMinutes} minutes unused, or ${session.maxHours} hours in all`
		);
		expect(text).toContain('stayed enabled');
	});

	it('trades nothing out of sight with SAML, where OpenID Connect trades a code', () => {
		const steps = (preset: string) => read(preset).messages.map(({ step }) => step);
		expect(steps('companies')).toContain('upstream-token-request');
		expect(steps('companies-saml')).not.toContain('upstream-token-request');
	});
});

describe('a user in a directory', () => {
	const access = (preset: string) => {
		const answer = read(preset).messages.find(({ step }) => step === 'token-response');
		const { access_token: token } = answer?.body as { access_token: string };
		return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
	};

	// The screen says it is the same token, so it comes from the three real runs and not from me.
	it("gets a token with the same claims as the provider's own user, and another provider's", () => {
		const names = (preset: string) => Object.keys(access(preset)).sort();
		expect(names('in-a-directory')).toEqual(names('oauth'));
		expect(names('broker')).toEqual(names('oauth'));
	});

	it('is the same person in each', () => {
		const who = ({
			preferred_username,
			email,
			given_name,
			family_name
		}: Record<string, string>) => ({
			preferred_username,
			email,
			given_name,
			family_name
		});
		expect(who(access('in-a-directory'))).toEqual(who(access('oauth')));
	});

	it('says what a real server said when the directory was down', () => {
		const { answers } = JSON.parse(readFileSync(`${FOLDER}/questions.json`, 'utf8'));
		const bound = stepsOf(read('in-a-directory')).find(({ id }) => id === 'directory-bound');
		expect(answers.directoryDown.form.status).toBe(400);
		expect(JSON.stringify(bound?.pitfall)).toContain(answers.directoryDown.form.says);
		// The rest of what that pitfall says.
		expect(answers.directoryDown).toMatchObject({
			withASession: { askedToLogIn: false },
			keptInTheProvider: { status: 302 },
			refresh: { status: 200 }
		});
		expect(answers.directoryLogin).toMatchObject({
			// The provider's own account, and then the user's, which LDAP refused.
			wrongPassword: { status: 200, triedThePassword: true, bindResults: [0, 49] },
			keepsACopy: true,
			passwordIsElsewhere: true
		});
	});

	it('is looked up by username the first time, by an ID after that, and asked each time', () => {
		const { answers } = JSON.parse(readFileSync(`${FOLDER}/questions.json`, 'utf8'));
		expect(answers.directoryLogin.firstLogin).toMatchObject({
			searchedByUsername: true,
			searchedById: false,
			triedThePassword: true
		});
		expect(answers.directoryLogin.secondLogin).toMatchObject({
			searchedByUsername: false,
			searchedById: true,
			triedThePassword: true
		});
	});

	it('differs in the one value the screen says it does', () => {
		expect(access('oauth').email_verified).toBe(true);
		expect(access('broker').email_verified).toBe(true);
		expect(access('in-a-directory').email_verified).toBe(false);
	});

	it('shows only the lines of the log, word for word, with nothing built from them', () => {
		for (const message of read('in-a-directory').messages.filter(({ log }) => log)) {
			expect(message.url).toBeUndefined();
			expect(message.log?.length).toBeGreaterThan(0);
			for (const line of message.log ?? []) expect(line).toMatch(/^conn=\d+ op=\d+ /);
		}
	});
});

describe('every base flow', () => {
	it.each(Object.values(flows).map((flow) => [flow.id, flow] as const))(
		'%s has its recordings, so the guards here cannot silently miss one',
		(id, flow) => {
			expect(recordedIndex.flows[id]?.presets).toEqual(flow.presets.map((preset) => preset.id));
			for (const preset of flow.presets) {
				expect(existsSync(`static/recordings/${id}/${preset.id}.json`), preset.id).toBe(true);
			}
		}
	);
});

describe('the date of a recording', () => {
	it('is what the recording itself says, whichever day it was made', () => {
		for (const base of Object.values(flows)) {
			for (const preset of base.presets) {
				const { recordedAt } = JSON.parse(
					readFileSync(`static/recordings/${base.id}/${preset.id}.json`, 'utf8')
				) as Recording;
				const settings = normalize({ ...defaultSettings, ...preset.settings }).settings;
				expect(provenance(base, base.diagrams.flow, settings).date, preset.id).toBe(recordedAt);
			}
		}
	});
});

describe('the files', () => {
	it('are one per named state, and the answers to the open questions', () => {
		const files = readdirSync(FOLDER)
			.filter((file) => file !== 'pages')
			.sort();
		expect(files).toEqual([...base.presets.map((p) => `${p.id}.json`), 'questions.json'].sort());
	});

	it('have an index that agrees with them', () => {
		const steps = new Set(recordings.flatMap((r) => r.messages.flatMap((m) => m.step ?? [])));
		expect(recordedIndex.flows[base.id].steps).toEqual([...steps].sort());
		expect(recordedIndex.flows[base.id].presets).toEqual(base.presets.map((p) => p.id));
		for (const recording of recordings) {
			expect(recording.keycloak).toBe(recordedIndex.keycloak);
		}
	});

	it('have a pinned version, the same one the recorder uses', () => {
		const recorder = readFileSync('scripts/record/index.ts', 'utf8');
		expect(recorder).toContain(`PINNED_KEYCLOAK = '${recordedIndex.keycloak}'`);
	});

	it('exist for the file the application will ask for', () => {
		for (const preset of recordedIndex.flows[base.id].presets) {
			expect(existsSync(`${FOLDER}/${preset}.json`)).toBe(true);
		}
	});
});

describe('how each message is known', () => {
	it('is recorded or from the spec, for every message of every valid combination', () => {
		const unknown = allValidSettings().flatMap((settings) =>
			[base.diagrams.setup, base.diagrams.flow].flatMap((flow) =>
				evaluate(flow, settings)
					.steps.filter(onTheWire)
					.filter((step) => knownFrom(base, step, settings)?.kind === 'unchecked')
					.map((step) => step.id)
			)
		);
		expect([...new Set(unknown)]).toEqual([]);
	});

	it('says nothing about steps with nothing on the wire', () => {
		const steps = evaluate(base.diagrams.setup, defaultSettings).steps;
		expect(knownFrom(base, steps[0], defaultSettings)).toBeNull();
	});

	it('names the spec when Keycloak did not do it', () => {
		const settings = { ...defaultSettings, binding: 'dpop', dpopNonce: true } as const;
		const step = evaluate(base.diagrams.flow, settings).steps.find(
			(s) => s.id === 'nonce-challenge'
		)!;
		expect(knownFrom(base, step, settings)).toMatchObject({ kind: 'spec' });
	});

	const stepAt = (id: string, settings: Settings = defaultSettings) =>
		evaluate(base.diagrams.flow, settings).steps.find((step) => step.id === id)!;

	it('names the server only for what the server took part in', () => {
		expect(knownFrom(base, stepAt('token-response'), defaultSettings)).toMatchObject({
			kind: 'recorded',
			by: 'server'
		});
		for (const id of ['open-app', 'redirect-to-idp', 'callback', 'api-request', 'api-response']) {
			expect(knownFrom(base, stepAt(id), defaultSettings), id).toMatchObject({
				kind: 'recorded',
				by: 'demo'
			});
		}
	});

	it('does not claim a recording for settings that have none', () => {
		const settings = { ...defaultSettings, oidc: true, consent: true };
		expect(recordingFor(base, settings)).toBeNull();
		expect(knownFrom(base, stepAt('token-response', settings), settings)).toEqual({
			kind: 'other-settings'
		});
		expect(provenance(base, base.diagrams.flow, settings).recorded).toBe(false);
	});

	it('does not pass off a copy of a message as a message of its own', () => {
		const settings = { ...defaultSettings, attacker: true };
		expect(knownFrom(base, stepAt('attacker-steals-code', settings), settings)).toMatchObject({
			kind: 'copied'
		});
	});
});

describe('what the application says about where it comes from', () => {
	it('names the specs, the version and the date', () => {
		const origin = provenance(base, base.diagrams.flow, defaultSettings);
		expect(origin.specs).toEqual(['RFC 6749', 'RFC 6750']);
		expect(origin.keycloak).toBe(recordedIndex.keycloak);
		expect(origin.date).toBe(recordedIndex.recordedAt);
	});

	it('adds the specs of the settings that are on, and leaves vendor docs out', () => {
		const origin = provenance(base, base.diagrams.flow, {
			...defaultSettings,
			oidc: true,
			binding: 'dpop',
			broker: true
		});
		expect(origin.specs).toEqual(['RFC 6749', 'RFC 6750', 'OpenID Connect Core 1.0', 'RFC 9449']);
	});
});

describe('the shape of a recording', () => {
	const [first] = recordings;

	it('leaves out what changes every run', () => {
		const changed: Recording = JSON.parse(
			JSON.stringify(first).replaceAll(/code=[\w.-]+/g, 'code=something-else')
		);
		expect(shapeDifferences(shapeOf(first), shapeOf(changed))).toEqual([]);
	});

	it('notices a step that went missing', () => {
		const changed = { ...first, messages: first.messages.slice(1) };
		expect(shapeDifferences(shapeOf(first), shapeOf(changed)).length).toBeGreaterThan(0);
	});

	it('notices a new field in an answer', () => {
		const changed: Recording = JSON.parse(JSON.stringify(first));
		const answer = changed.messages.find((m) => m.step === 'token-response')!;
		(answer.body as Record<string, unknown>).something_new = 'x';
		const differences = shapeDifferences(shapeOf(first), shapeOf(changed));
		expect(differences.join('\n')).toContain('something_new');
	});
});

// A setting added after a recording was made is missing from it. A condition written as "not one
// value" counts the missing one as true, which drew the API reading a stored token on a recording made
// before that choice existed (#180). Every recording has to draw the same with its gaps filled in.
describe('every recording, made before a later setting existed', () => {
	it.each(asCases)(
		'%s draws the same with the settings it lacks at their defaults',
		(_, recording) => {
			// The user flow, which is what a recording records.
			const flow = base.diagrams.flow;
			const asRecorded = evaluate(flow, recording.settings as Settings).steps.map((s) => s.id);
			const filled = evaluate(flow, { ...defaultSettings, ...recording.settings }).steps.map(
				(s) => s.id
			);
			expect(asRecorded).toEqual(filled);
		}
	);
});
