import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { flagStatus } from '#lib/keycloak/flags.ts';
import { authorizationCodeBase as base } from '#lib/flow/index.ts';
import { evaluate, type Step } from '#lib/flow/model.ts';
import {
	allValidSettings,
	defaultSettings,
	flagsInSettings,
	type Settings
} from '#lib/flow/settings.ts';
import { whyOf } from '#lib/flow/vocabulary.ts';
import type { RecordedMessage, Recording } from '#lib/recordings/format.ts';
import { loadsOnce } from '#lib/recordings/load.ts';
import {
	nearestRecordings,
	recordedIndex,
	recordingFor,
	settingsOf
} from '#lib/recordings/known.ts';
import {
	artifactOf,
	jwtsIn,
	lineText,
	originOf,
	rawLines,
	traceRun,
	type Line
} from '#lib/recordings/wire.ts';

const FOLDER = 'static/recordings/authorization-code';
const read = (preset: string): Recording =>
	JSON.parse(readFileSync(`${FOLDER}/${preset}.json`, 'utf8'));
const recordings = base.presets.map((preset) => read(preset.id));
const asCases = recordings.map((recording) => [recording.preset, recording] as const);

const messageOn = (recording: Recording, step: string) =>
	recording.messages.find((message) => message.step === step);
const linesOn = (recording: Recording, step: string) => rawLines(messageOn(recording, step)!);
const named = (lines: readonly Line[], name: string) => lines.find((line) => line.name === name);
const stepsIn = (recording: Recording): Step[] =>
	[base.diagrams.setup, base.diagrams.flow].flatMap(
		(flow) => evaluate(flow, recording.settings).steps
	);

describe.each(asCases)('the raw view of %s', (_, recording) => {
	const file = JSON.stringify(recording);

	// This is what ADR-005 comes down to: nothing on screen that the recording does not hold.
	it('shows no value that is not in the file', () => {
		for (const message of recording.messages) {
			for (const line of rawLines(message)) {
				if (!line.decoded) continue;
				// An address in a query is in the file as it went, and on screen as it reads.
				const said = [JSON.stringify(line.decoded).slice(1, -1), encodeURIComponent(line.decoded)];
				expect(
					said.some((form) => file.includes(form)),
					line.decoded
				).toBe(true);
			}
		}
	});

	it('leaves out nothing the message carries', () => {
		for (const message of recording.messages) {
			const text = rawLines(message).map(lineText).join('\n');
			for (const [name, value] of Object.entries(message.headers)) {
				if (name !== 'location') expect(text).toContain(value);
			}
			if (message.body && typeof message.body === 'object') {
				for (const name of Object.keys(message.body)) expect(text).toContain(name);
			}
		}
	});

	it('keeps each recording small enough to load when it is asked for', () => {
		expect(statSync(`${FOLDER}/${recording.preset}.json`).size).toBeLessThan(48 * 1024);
	});

	it('has what every Execute claims: the request, the answer, and a value used later', () => {
		const steps = stepsIn(recording);
		const trace = traceRun(recording);
		for (const step of steps.filter((candidate) => candidate.execute)) {
			const sent = messageOn(recording, step.id);
			const answer = messageOn(recording, step.execute!);
			expect(sent?.direction, step.id).toBe('request');
			expect(answer?.direction, step.id).toBe('response');
			if (step.id === 'discover') continue;
			const fresh = rawLines(answer!).filter(
				(line) => originOf(line, step.execute!, trace) !== null && line.decoded
			);
			const later = recording.messages.slice(recording.messages.indexOf(answer!) + 1);
			const used = fresh.filter((line) =>
				later.some((message) => rawLines(message).some((l) => l.decoded === line.decoded))
			);
			expect(used.length, `${step.id} returns nothing a later step uses`).toBeGreaterThan(0);
		}
	});

	it('means what it says when the app looks up an address and then uses it', () => {
		const document = messageOn(recording, 'discovery-document')?.body as Record<string, string>;
		const authorize = messageOn(recording, 'authorize') as RecordedMessage;
		expect(authorize.url?.startsWith(document.authorization_endpoint)).toBe(true);
	});
});

describe('following a value through a run', () => {
	const recording = read('oauth');
	const trace = traceRun(recording);
	const originOn = (step: string, name: string) =>
		originOf(named(linesOn(recording, step), name)!, step, trace);

	it('sees the code appear in the redirect, and go on from there', () => {
		expect(originOn('redirect-with-code', 'code')).toEqual({ new: true });
		expect(originOn('callback', 'code')).toEqual({ from: 'redirect-with-code' });
		expect(originOn('token-request', 'code')).toEqual({ from: 'redirect-with-code' });
	});

	it('sees the code sent in one step be the code returned in the one before', () => {
		const returned = named(linesOn(recording, 'redirect-with-code'), 'code')?.decoded;
		const sent = named(linesOn(recording, 'token-request'), 'code')?.decoded;
		expect(returned).toBeTruthy();
		expect(sent).toBe(returned);
	});

	it('sees the token in a header be the token that came back, whatever it is called there', () => {
		expect(originOn('token-response', 'access_token')).toEqual({ new: true });
		expect(originOn('api-request', 'authorization')).toEqual({ from: 'token-response' });
	});

	it('leaves out what stays the same on every run', () => {
		const names = trace.map((value) => value.name);
		expect(names).not.toContain('client_id');
		expect(names).not.toContain('redirect_uri');
		expect(originOn('token-request', 'redirect_uri')).toBeNull();
	});

	it('has each value once, where it first appears', () => {
		const values = trace.map((value) => value.value);
		expect(new Set(values).size).toBe(values.length);
		expect(trace.find((value) => value.name === 'state')?.step).toBe('redirect-to-idp');
	});
});

describe('a message as text', () => {
	const recording = read('oidc');

	it('splits a long address, and keeps it encoded as it was sent', () => {
		const lines = linesOn(recording, 'authorize').map(lineText);
		expect(lines[0]).toMatch(/^GET http:\/\/localhost:\d+\/realms\/demo\/protocol/);
		expect(lines[0]).not.toContain('?');
		expect(lines.some((line) => line.startsWith('  ?'))).toBe(true);
		expect(lines.join('')).toContain('redirect_uri=http%3A%2F%2Flocalhost');
	});

	it('gives the real value of what it keeps encoded', () => {
		const redirect = named(linesOn(recording, 'authorize'), 'redirect_uri');
		expect(redirect?.decoded).toMatch(/^http:\/\/localhost/);
	});

	it('says a page was left out rather than showing nothing', () => {
		expect(linesOn(recording, 'login-page').map(lineText)).toContain('(An HTML page)');
	});

	it('invents no protocol version, because the recording does not hold one', () => {
		const text = recording.messages
			.flatMap((message) => rawLines(message))
			.map(lineText)
			.join('\n');
		expect(text).not.toContain('HTTP/1.1');
	});

	it('opens the signed tokens, from their own bytes', () => {
		const jwts = jwtsIn(linesOn(recording, 'token-response'));
		expect(jwts.map((jwt) => jwt.name)).toEqual(
			expect.arrayContaining(['access_token', 'id_token'])
		);
		const idToken = jwts.find((jwt) => jwt.name === 'id_token');
		expect(idToken?.claims).toMatchObject({ preferred_username: 'alice', aud: 'demo-app' });
	});

	it('does not take a code for a token', () => {
		const names = jwtsIn(linesOn(recording, 'redirect-with-code')).map(({ name }) => name);
		expect(names).not.toContain('code');
	});

	it('colours a value as the chip it is on the diagram', () => {
		const view = evaluate(base.diagrams.flow, recording.settings);
		const on = (id: string) => view.steps.find((step) => step.id === id)!;
		expect(artifactOf(on('token-response'), 'access_token')).toBe('access-token');
		expect(artifactOf(on('api-request'), 'authorization')).toBe('access-token');
		expect(artifactOf(on('submit-credentials'), 'password')).toBe('password');
		expect(artifactOf(on('submit-credentials'), 'username')).toBeUndefined();
		expect(artifactOf(on('token-request'), 'grant_type')).toBeUndefined();
	});
});

describe('which steps get Execute', () => {
	const all = allValidSettings().flatMap((settings) =>
		[base.diagrams.setup, base.diagrams.flow].map((flow) => evaluate(flow, settings))
	);

	it('never a step with no exchange on the wire', () => {
		for (const view of all) {
			for (const step of view.steps.filter((candidate) => candidate.execute)) {
				expect(['front', 'back'], step.id).toContain(step.channel);
				expect(step.kind, step.id).toBe('request');
			}
		}
	});

	it('always one whose answer is on the same diagram', () => {
		for (const view of all) {
			for (const step of view.steps.filter((candidate) => candidate.execute)) {
				expect(view.steps.map((candidate) => candidate.id)).toContain(step.execute);
			}
		}
	});

	it('is a few, because a button on every step would stop meaning anything', () => {
		const view = evaluate(base.diagrams.flow, defaultSettings);
		expect(view.steps.filter((step) => step.execute).map((step) => step.id)).toEqual([
			'submit-credentials',
			'token-request'
		]);
	});

	it('follows the settings, when what comes back is only used with one on', () => {
		const stepIn = (settings: Partial<Settings>) =>
			evaluate(base.diagrams.flow, { ...defaultSettings, ...settings }).steps.find(
				(step) => step.id === 'upstream-token-request'
			);
		expect(stepIn({ broker: true })?.execute).toBeUndefined();
		expect(stepIn({ broker: true, upstreamTokens: 'v1' })?.execute).toBe('upstream-token-response');
	});
});

describe('which recording goes with which settings', () => {
	it('is the named state with exactly those settings', () => {
		for (const preset of base.presets)
			expect(recordingFor(base, settingsOf(preset))?.id).toBe(preset.id);
	});

	it('is none for a combination that was not recorded, because a recording is never adapted', () => {
		expect(recordingFor(base, { ...defaultSettings, oidc: true, binding: 'dpop' })).toBeNull();
	});

	it('offers the closest ones instead', () => {
		const nearest = nearestRecordings(base, { ...defaultSettings, oidc: true, binding: 'dpop' });
		expect(nearest.map((preset) => preset.id)).toEqual(expect.arrayContaining(['oidc', 'dpop']));
	});

	it('covers what people actually use', () => {
		expect(recordingFor(base, { ...defaultSettings, oidc: true, pkce: true })?.id).toBe(
			'oidc-pkce'
		);
		expect(
			recordingFor(base, {
				...defaultSettings,
				appRuns: 'page',
				oidc: true,
				pkce: true,
				clientType: 'public'
			})?.id
		).toBe('browser-app');
	});
});

describe('the feature flags', () => {
	it('are all reported on by a real server', () => {
		for (const flag of flagsInSettings()) {
			expect(recordedIndex.flags[flag.name], flag.name).toBeDefined();
			expect(flagStatus(flag)).not.toContain('not recorded');
		}
	});

	it('say what the server said', () => {
		const named = (name: string) => flagsInSettings().find((flag) => flag.name === name)!;
		expect(flagStatus(named('identity-brokering-api:v2'))).toBe('supported, off by default');
		expect(flagStatus(named('dpop'))).toBe('supported, on by default');
	});

	it('add what only the docs say, and say that it is from the docs', () => {
		const v1 = flagsInSettings().find((flag) => flag.name === 'identity-brokering-api:v1')!;
		expect(flagStatus(v1)).toBe('supported, on by default. Deprecated in its docs.');
	});
});

describe('every parameter', () => {
	it('says why it is there, in every combination', () => {
		const missing = new Set(
			allValidSettings().flatMap((settings) =>
				[base.diagrams.setup, base.diagrams.flow].flatMap((flow) =>
					evaluate(flow, settings).steps.flatMap((step) =>
						step.fields.filter((field) => !whyOf(field)).map((field) => field.name)
					)
				)
			)
		);
		expect([...missing]).toEqual([]);
	});
});

describe('loading a recording', () => {
	it('happens once for each, however often it is asked for', async () => {
		let calls = 0;
		const load = loadsOnce(async (key) => {
			calls++;
			return key;
		});
		await load('a');
		await load('a');
		await load('b');
		expect(calls).toBe(2);
	});

	it('can be tried again after it failed', async () => {
		let calls = 0;
		const load = loadsOnce(async (key) => {
			calls++;
			if (calls === 1) throw new Error('offline');
			return key;
		});
		await expect(load('a')).rejects.toThrow('offline');
		await expect(load('a')).resolves.toBe('a');
	});
});

describe('what gets downloaded', () => {
	const sourceFiles = (folder: string): string[] =>
		readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
			const path = join(folder, entry.name);
			return entry.isDirectory() ? sourceFiles(path) : [path];
		});

	it('has no recording in the application code, so simple mode never pays for one', () => {
		const inApp = [...sourceFiles('src/lib'), ...sourceFiles('src/routes')].filter(
			(file) => !/\.(test|stories)\.ts$/.test(file)
		);
		const importing = inApp.filter((file) =>
			readFileSync(file, 'utf8').includes('static/recordings')
		);
		expect(importing).toEqual([]);
	});

	it('leaves the name of the server out of its session cookie, with its notes off', () => {
		const message = {
			step: 'redirect-with-code',
			direction: 'response',
			status: 302,
			headers: { 'set-cookie': 'KEYCLOAK_IDENTITY=abc; HttpOnly' }
		} as RecordedMessage;
		const shown = (serverNamed: boolean) =>
			rawLines(message, { serverNamed }).map(lineText).join('\n');
		expect(shown(true)).toContain('KEYCLOAK_IDENTITY=abc');
		expect(shown(false)).toContain('session=abc');
		expect(shown(false)).not.toMatch(/keycloak/i);
	});

	it('stays small for the index the application does load', () => {
		expect(statSync('src/lib/recordings/recorded.json').size).toBeLessThan(6 * 1024);
	});
});
