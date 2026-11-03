import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { NoteDef } from '#lib/keycloak/notes.ts';
import { evidenceDifferences, whatChanged } from '#lib/recordings/check.ts';
import type { Recording } from '#lib/recordings/format.ts';
import { shapeDifferences, shapeOf } from '#lib/recordings/shape.ts';

const FOLDER = 'static/recordings/authorization-code';
const read = (name: string) => JSON.parse(readFileSync(`${FOLDER}/${name}.json`, 'utf8'));
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const plain: Recording = read('oauth');
// The attacker's recording has a refusal in it, which is the kind of answer the diagram quotes.
const refused: Recording = read('attack-public-pkce');
const { answers } = read('questions');

const differs = (before: Recording, after: Recording) =>
	shapeDifferences(shapeOf(before), shapeOf(after)).join('\n');
const answerOf = (recording: Recording, step: string) => {
	const message = recording.messages.find((candidate) => candidate.step === step);
	if (!message) throw new Error(`No ${step} in ${recording.preset}`);
	return message;
};

describe('the weekly check of a recording', () => {
	it('finds nothing when only what changes every run has changed', () => {
		const changed = copy(plain);
		const answer = answerOf(changed, 'token-response');
		(answer.body as Record<string, unknown>).expires_in = 12345;
		expect(differs(plain, changed)).toBe('');
	});

	it('finds nothing in a header that holds nothing, which a file would not have', () => {
		const run = copy(plain);
		const request = run.messages.find((message) => message.direction === 'request');
		if (!request) throw new Error('No request');
		(request.headers as Record<string, string | undefined>).origin = undefined;
		expect(differs(plain, run)).toBe('');
	});

	it('notices messages in another order', () => {
		const changed = copy(plain);
		changed.messages.reverse();
		expect(differs(plain, changed)).not.toBe('');
	});

	it('notices a message sent twice', () => {
		const changed = copy(plain);
		changed.messages.splice(3, 0, copy(changed.messages[3]));
		expect(differs(plain, changed)).toMatch(/^\+ /m);
	});

	it('notices a message that went missing', () => {
		const changed = copy(plain);
		changed.messages.splice(3, 1);
		expect(differs(plain, changed)).toMatch(/^- /m);
	});

	it('notices another error, which the diagram states', () => {
		const changed = copy(refused);
		const answer = answerOf(changed, 'attacker-token-response');
		expect((answer.body as Record<string, string>).error).toBe('invalid_grant');
		(answer.body as Record<string, string>).error = 'invalid_request';
		expect(differs(refused, changed)).toContain('invalid_request');
	});

	it('notices another error description, which the notes quote', () => {
		const changed = copy(refused);
		const answer = answerOf(changed, 'attacker-token-response');
		(answer.body as Record<string, string>).error_description = 'Something else';
		expect(differs(refused, changed)).toContain('Something else');
	});

	it('notices another token type, which the diagram states', () => {
		const changed = copy(plain);
		(answerOf(changed, 'token-response').body as Record<string, string>).token_type = 'DPoP';
		expect(differs(plain, changed)).toContain('DPoP');
	});

	it('notices another status', () => {
		const changed = copy(plain);
		answerOf(changed, 'token-response').status = 201;
		expect(differs(plain, changed)).toContain('201');
	});

	it('notices a parameter that went missing from an address', () => {
		const changed = copy(plain);
		const request = answerOf(changed, 'authorize');
		request.url = request.url?.replace(/&?state=[^&]*/, '');
		expect(differs(plain, changed)).not.toBe('');
	});

	it('notices a header that went missing', () => {
		const changed = copy(plain);
		const request = answerOf(changed, 'token-request');
		delete request.headers.authorization;
		expect(differs(plain, changed)).not.toBe('');
	});

	it('notices a claim that went missing from a token', () => {
		const changed = copy(plain);
		const body = answerOf(changed, 'token-response').body as Record<string, string>;
		const [head, payload, signature] = body.access_token.split('.');
		const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
		delete claims.preferred_username;
		const less = Buffer.from(JSON.stringify(claims)).toString('base64url');
		body.access_token = `${head}.${less}.${signature}`;
		expect(differs(plain, changed)).not.toBe('');
	});

	it('does not mind the ID a server gave a client that registered itself', () => {
		const at = (id: string) => ({
			...plain,
			messages: [
				{
					step: 'dcr-response',
					direction: 'response' as const,
					status: 201,
					headers: {
						location: `http://localhost/realms/demo/clients-registrations/openid-connect/${id}`
					}
				}
			]
		});
		expect(shapeDifferences(shapeOf(at('one')), shapeOf(at('two')))).toEqual([]);
	});
});

describe('the weekly check of what the notes say', () => {
	const note: NoteDef = {
		id: 'a-note',
		steps: [],
		title: 'A note',
		text: 'Words',
		place: { path: ['Somewhere', 'A label'], page: 'client-settings', shows: ['A label'] },
		backedBy: { question: 'aQuestion', shows: { before: { status: 200 }, after: { status: 400 } } }
	};
	const said = {
		aQuestion: { before: { status: 200 }, after: { status: 400, extra: 'not claimed' } },
		console: { 'a-note': { found: ['A label'], missing: [] } }
	};

	it('holds on the server the recordings came from', () => {
		expect(evidenceDifferences(answers)).toEqual([]);
	});

	it('finds nothing when the answers still say what the note says', () => {
		expect(evidenceDifferences(said, [note])).toEqual([]);
	});

	it('notices the setting no longer doing what the note says', () => {
		const changed = { ...said, aQuestion: { before: { status: 200 }, after: { status: 200 } } };
		expect(evidenceDifferences(changed, [note]).join()).toContain('after.status');
	});

	it('notices a question nobody asked any more', () => {
		expect(evidenceDifferences({ console: said.console }, [note])).not.toEqual([]);
	});

	it('notices the admin console no longer showing where the note says it is', () => {
		const moved = { ...said, console: { 'a-note': { found: [], missing: ['A label'] } } };
		expect(evidenceDifferences(moved, [note]).join()).toContain('A label');
	});

	it('notices nobody having looked in the admin console', () => {
		expect(evidenceDifferences({ aQuestion: said.aQuestion }, [note]).join()).toContain(
			'nobody looked'
		);
	});
});

describe('a whole run', () => {
	const flags = { committed: { dpop: { type: 'DEFAULT', enabled: true } } };
	const same = { recordings: [{ committed: plain, now: copy(plain) }], answers };

	it('finds nothing when nothing changed', () => {
		expect(whatChanged({ ...same, flags: { ...flags, now: flags.committed } })).toEqual([]);
	});

	it('notices a flag changing, which a badge on a setting states', () => {
		const now = { dpop: { type: 'DEFAULT', enabled: false } };
		expect(whatChanged({ ...same, flags: { ...flags, now } }).join()).toContain('flags');
	});

	it('does not mind the order the flags came in', () => {
		const committed = { a: flags.committed.dpop, b: flags.committed.dpop };
		const now = { b: flags.committed.dpop, a: flags.committed.dpop };
		expect(whatChanged({ ...same, flags: { committed, now } })).toEqual([]);
	});

	it('notices a note no longer holding, even if every message looks the same', () => {
		const changed = {
			...answers,
			implicitFlow: { ...answers.implicitFlow, after: { allowed: false } }
		};
		const found = whatChanged({
			...same,
			answers: changed,
			flags: { ...flags, now: flags.committed }
		});
		expect(found.join()).toContain('implicit-flow');
	});

	it('says which named state changed', () => {
		const changed = copy(plain);
		changed.messages.pop();
		const found = whatChanged({
			...same,
			recordings: [{ committed: plain, now: changed }],
			flags: { ...flags, now: flags.committed }
		});
		expect(found[0]).toBe('oauth changed:');
	});
});
