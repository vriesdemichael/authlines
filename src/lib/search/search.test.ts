import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { authorizationCodeBase as base, flows } from '#lib/flow/index.ts';
import { parseState } from '#lib/flow/state.ts';
import { evaluate } from '#lib/flow/model.ts';
import type { Recording } from '#lib/recordings/format.ts';
import { knownErrors } from '#lib/search/errors.ts';
import { search } from '#lib/search/search.ts';

/** The demo API's words, which nobody else's server will say. */
const API_ANSWERS = new Set(['api-response', 'api-refused', 'asks-after-logout-response']);

const FOLDER = 'static/recordings/authorization-code';
const files = readdirSync(FOLDER).filter(
	(file) => file.endsWith('.json') && file !== 'questions.json'
);
const recordings: Recording[] = files.map((file) =>
	JSON.parse(readFileSync(`${FOLDER}/${file}`, 'utf8'))
);
const questions = readFileSync(`${FOLDER}/questions.json`, 'utf8');

const first = (query: string) => search(query).results[0];

describe('what people bring', () => {
	it.each([
		['SSO', 'word', 'Single sign-on'],
		['single sign-on', 'word', 'Single sign-on'],
		['JWT', 'word', 'JWT'],
		['jwks', 'step', undefined],
		['issuer', 'word', 'Issuer'],
		['PKCE', 'word', 'PKCE'],
		['refresh token', 'word', 'Refresh token'],
		['logout', 'word', 'Logging out'],
		['cookie', 'word', 'Session'],
		['expired', 'question', undefined],
		['401', 'question', undefined],
		['403', 'question', undefined],
		['invalid_grant', 'error', 'invalid_grant'],
		['invalid_client', 'error', undefined],
		['unauthorized_client', 'error', 'unauthorized_client'],
		['Invalid parameter: redirect_uri', 'error', 'Invalid parameter: redirect_uri'],
		['How does PKCE work', 'question', 'How does PKCE work?'],
		['steal the code', 'question', undefined]
	])('%s finds a %s', (query, kind, title) => {
		const results = search(query).results;
		expect(results.length, query).toBeGreaterThan(0);
		const match = results.find((result) => result.kind === kind);
		expect(match, query).toBeDefined();
		if (title) expect(match?.title).toBe(title);
	});

	it('finds what a pitfall on the other flow says', () => {
		const found = search('wants its own name in the token');
		expect(found.results[0]?.flow).toBe('client-credentials');
	});

	it.each(['client credentials', 'service account', 'nightly job', 'machine to machine'])(
		'%s finds the flow with no user',
		(query) => {
			const found = search(query);
			expect(found.notHereYet).toBeNull();
			expect(found.results.some(({ flow }) => flow === 'client-credentials')).toBe(true);
		}
	);

	it('says first what unauthorized_client means, which is what the spec says it means', () => {
		const [first, second] = search('unauthorized_client').results;
		expect(first.flow).toBe('client-credentials');
		expect(first.says).toContain('not allowed');
		expect(second.kind).toBe('error');
		expect(second.flow).toBe('authorization-code');
	});

	it.each(['injection', 'authorization code injection', 'RFC 9207', 'mix-up'])(
		'%s finds something, in the words the specs use',
		(query) => {
			expect(search(query).results.length, query).toBeGreaterThan(0);
		}
	);

	it('never says a flow that is here is not', () => {
		for (const base of Object.values(flows)) {
			const title = base.diagrams.flow.title.toLowerCase();
			expect(search(title).notHereYet, title).toBeNull();
			expect(search(title.replace(/ flow$/, '')).notHereYet, title).toBeNull();
			expect(search(title.replace(/ flow$/, '')).results.length, title).toBeGreaterThan(0);
		}
	});

	it.each([
		['csrf', 'What does state protect against?'],
		['cross-site request forgery', 'What does state protect against?'],
		['what is iss', 'What is iss doing in the address?'],
		['mix-up attack', 'What is iss doing in the address?']
	])('%s gets a question that answers it', (query, title) => {
		expect(search(query).results.map((result) => result.title)).toContain(title);
	});

	it.each([
		'Device flow',
		'What about SAML?',
		'token exchange',
		'PKCE downgrade',
		'native apps',
		'a custom URL scheme',
		'a malicious app on my phone',
		'RFC 8252'
	])('%s is said not to be here yet, and is not guessed around', (query) => {
		const found = search(query);
		expect(found.notHereYet).not.toBeNull();
		expect(found.results).toEqual([]);
	});

	it('says nothing about something nobody could mean', () => {
		expect(search('xyzzy plugh').results).toEqual([]);
		expect(search('xyzzy plugh').notHereYet).toBeNull();
		expect(search(' ').results).toEqual([]);
	});
});

describe('a pasted error', () => {
	it('is found in the middle of a line', () => {
		const line =
			'2026-11-01 14:03:22,811 WARN [org.example.auth] (executor-3) id=8f3a2c1e error="invalid_grant" description="Code not valid" client=my-app';
		const results = search(line).results;
		expect(results[0].kind).toBe('error');
		expect(results.map((result) => result.title)).toContain('Code not valid');
	});

	it('finds the longest, so it is not just the short word inside it', () => {
		expect(first('error: PKCE verification failed: Code mismatch').title).toBe(
			'PKCE verification failed: Code mismatch'
		);
	});

	it('finds it in JSON too', () => {
		const pasted = '{"error":"invalid_request","error_description":"DPoP Proof missing"}';
		expect(search(pasted).results.map((result) => result.title)).toContain('DPoP Proof missing');
	});
});

describe('what a real server said', () => {
	const stated = new Set(
		recordings.flatMap((recording) =>
			recording.messages.flatMap((message) => {
				if (API_ANSWERS.has(message.step ?? '')) return [];
				const body = message.body as Record<string, string> | undefined;
				return body && typeof body === 'object'
					? [body.error, body.error_description].filter(Boolean)
					: [];
			})
		)
	);

	it('is found, for every error in every recording', () => {
		expect(stated.size).toBeGreaterThan(2);
		for (const text of stated) {
			expect(first(text)?.kind, text).toBe('error');
			expect(first(text)?.title, text).toBe(text);
		}
	});

	it.each(knownErrors.map((known) => [known.text, known] as const))(
		'%s is something a real server said',
		(text) => {
			expect(questions + JSON.stringify(recordings)).toContain(text);
		}
	);

	it.each(knownErrors.map((known) => [known.text, known] as const))(
		'%s opens the state that shows it',
		(text, known) => {
			const flow = flows[known.flow ?? base.id];
			const result = search(text).results.find(
				(candidate) => candidate.kind === 'error' && candidate.flow === flow.id
			);
			expect(result).toBeDefined();
			const state = parseState(flow, 'flow', result!.query);
			expect(state.step).toBe(known.step);
			const view = evaluate(flow.diagrams.flow, state.settings);
			expect(view.steps.some((step) => step.id === known.step)).toBe(true);
		}
	);

	it('opens on the question about it, where there is one, at the same step', () => {
		const error = first('Invalid parameter: redirect_uri');
		expect(error.kind).toBe('error');
		expect(error.view).toBe('redirect-uri-error');
		expect(parseState(base, 'flow', error.query).step).toBe('authorize');
	});

	it('says what a word means, wherever that is defined', () => {
		for (const word of ['Session', 'PKCE', 'Access token']) {
			const result = search(word).results.find(({ kind }) => kind === 'word');
			expect(result?.says, word).toBeTruthy();
			expect(result?.says, word).not.toContain('What this word means');
		}
	});

	it('finds what only some settings bring', () => {
		expect(search('S256').results.length).toBeGreaterThan(0);
	});

	it('finds what people call it', () => {
		expect(search('csrf').results.some(({ title }) => title === 'State')).toBe(true);
		expect(search('what could go wrong').results.length).toBeGreaterThan(0);
	});

	it('opens the step the error was recorded on, where a recording has it', () => {
		for (const recording of recordings) {
			for (const message of recording.messages) {
				const body = message.body as Record<string, string> | undefined;
				const said = body?.error_description;
				if (!said || !message.step || API_ANSWERS.has(message.step)) continue;
				const known = knownErrors.find((candidate) => candidate.text === said);
				expect(known, said).toBeDefined();
				// Each error is recorded on the steps a real server said it on, and it opens one of those.
				const recordedOn = recordings.flatMap((other) =>
					other.messages
						.filter(
							(candidate) =>
								(candidate.body as Record<string, string> | undefined)?.error_description === said
						)
						.map((candidate) => candidate.step)
				);
				expect(recordedOn, said).toContain(known?.step);
			}
		}
	});
});

describe('every result', () => {
	it('opens a real state', () => {
		for (const query of ['token', 'code', 'secret', 'redirect', 'provider', 'browser', 'scope']) {
			for (const result of search(query).results) {
				if (result.kind === 'question') continue;
				const diagram = result.view === 'setup' ? 'setup' : 'flow';
				const state = parseState(base, diagram, result.query);
				const view = evaluate(base.diagrams[diagram], state.settings);
				expect(view.steps.some((step) => step.id === state.step)).toBe(true);
			}
		}
	});

	it('are few enough to read', () => {
		expect(search('token').results.length).toBeLessThanOrEqual(8);
	});
});
