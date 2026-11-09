import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Recording } from '#lib/recordings/format.ts';
import { explainedKerberos, keyWhy, type KeyPlace } from '#lib/recordings/key-why.ts';
import { jwtOf, keyedLines, rawLines } from '#lib/recordings/wire.ts';

const FOLDER = 'static/recordings/authorization-code';
const kerberosMessages = readdirSync(FOLDER)
	.filter((file) => file.endsWith('.json') && file !== 'questions.json')
	.flatMap((file) => (JSON.parse(readFileSync(`${FOLDER}/${file}`, 'utf8')) as Recording).messages)
	.filter((message) => message.protocol === 'kerberos');

/** Every key in a value, however deep, and every padata-type's value. */
function walk(value: unknown, keys: Set<string>, kinds: Set<string>) {
	if (Array.isArray(value)) for (const item of value) walk(item, keys, kinds);
	else if (value && typeof value === 'object') {
		for (const [key, inner] of Object.entries(value)) {
			keys.add(key);
			if (key === 'padata-type' && typeof inner === 'string')
				kinds.add(inner.replace(/ \(\d+\)$/, ''));
			walk(inner, keys, kinds);
		}
	}
}

describe('what a key in the raw view means (the maintainer, 2026-11-09)', () => {
	const keys = new Set<string>();
	const kinds = new Set<string>();
	for (const message of kerberosMessages) walk(message.body, keys, kinds);

	it('is there for every key in a Kerberos message recorded, and each says where it is from', () => {
		expect(kerberosMessages.length).toBeGreaterThan(0);
		expect([...keys].filter((key) => !explainedKerberos.keys.includes(key))).toEqual([]);
		for (const key of keys) expect(keyWhy(key, { where: 'kerberos' })?.cite, key).toBeDefined();
	});

	it('says what each kind of pre-authentication data recorded is', () => {
		expect([...kinds].filter((kind) => !explainedKerberos.padataTypes.includes(kind))).toEqual([]);
		const fast = keyWhy('padata-type', { where: 'kerberos', value: 'PA-FX-FAST (136)' });
		expect(fast?.says).toContain('FAST');
		expect(fast?.cite).toMatchObject({ rfc: 6113 });
	});

	it('marks the key on each line of a Kerberos message, so the raw view can explain it', () => {
		const message = kerberosMessages.find((candidate) => candidate.method === 'TGS-REQ')!;
		const marked = rawLines(message).flatMap((line) => line.key ?? []);
		expect(marked).toEqual(expect.arrayContaining(['kvno', 'authenticator', 'padata-type']));
	});

	it('is there for every name in the HTTP traffic recorded, and inside each token', () => {
		const missing = new Set<string>();
		const check = (where: KeyPlace, key: string) => {
			if (!keyWhy(key, { where })) missing.add(`${where}: ${key}`);
		};
		for (const flow of ['authorization-code', 'client-credentials', 'device']) {
			const folder = `static/recordings/${flow}`;
			for (const file of readdirSync(folder)) {
				if (!file.endsWith('.json') || file === 'questions.json') continue;
				const recording = JSON.parse(readFileSync(`${folder}/${file}`, 'utf8')) as Recording;
				for (const message of recording.messages) {
					if (message.protocol === 'kerberos' || message.log) continue;
					for (const line of rawLines(message)) {
						if (line.key) check(line.header ? 'header' : 'wire', line.key);
						const jwt = jwtOf(line);
						if (!jwt) continue;
						for (const key of keyedLines(jwt.header).flatMap((l) => l.key ?? []))
							check('jose', key);
						for (const key of keyedLines(jwt.claims).flatMap((l) => l.key ?? []))
							check('claims', key);
					}
				}
			}
		}
		expect([...missing]).toEqual([]);
	});

	it('gives a name its meaning where it is: accept is a header and a button', () => {
		expect(keyWhy('accept', { where: 'header' })?.says).toContain('answer');
		expect(keyWhy('accept', { where: 'wire' })?.says).toContain('identity provider’s own');
		expect(keyWhy('alg', { where: 'jose' })?.says).toContain('signed it');
		expect(keyWhy('sub', { where: 'claims' })?.says).toContain('Who it is about');
	});

	it('explains a key in HTTP by what the parameter is for, where that is said', () => {
		expect(keyWhy('expires_in', { where: 'wire' })?.says).toContain('seconds');
		expect(keyWhy('not-a-key', { where: 'wire' })).toBeUndefined();
	});
});
