import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CODE_FROM, curlFor } from '#lib/recordings/curl.ts';
import type { RecordedMessage, Recording } from '#lib/recordings/format.ts';

const folder = 'static/recordings/authorization-code';
const recordings = readdirSync(folder)
	.filter((file) => file.endsWith('.json') && file !== 'questions.json')
	.map((file) => JSON.parse(readFileSync(`${folder}/${file}`, 'utf8')) as Recording);
const number = (step: string) => (step === 'redirect-with-code' ? 6 : null);
const codeIn = (message: RecordedMessage) =>
	new URL(message.url ?? '', 'http://any').searchParams.get('code') ??
	(message.body as { code?: string } | undefined)?.code;

/** Reads a command the way a shell would, so what is checked is what would be sent. */
function parsed(command: string) {
	const script = command
		.split('\n')
		.filter((line) => !line.startsWith('#'))
		.join('\n')
		.replaceAll(' \\\n  ', ' ');
	const words: string[] = [];
	let word = '';
	let inside = false;
	let started = false;
	for (let at = 0; at < script.length; at++) {
		const char = script[at];
		if (char === "'") {
			inside = !inside;
			started = true;
		} else if (char === '\\' && !inside) {
			word += script[++at];
		} else if (char === ' ' && !inside) {
			if (started || word) words.push(word);
			word = '';
			started = false;
		} else {
			word += char;
		}
	}
	if (started || word) words.push(word);
	const result = {
		method: '',
		url: '',
		headers: {} as Record<string, string>,
		form: {} as Record<string, string>,
		raw: undefined as string | undefined
	};
	expect(words[0]).toBe('curl');
	for (let i = 1; i < words.length; i++) {
		if (words[i] === '-i') continue;
		if (words[i] === '-X') result.method = words[++i];
		else if (words[i] === '-H') {
			const at = words[++i].indexOf(': ');
			result.headers[words[i].slice(0, at)] = words[i].slice(at + 2);
		} else if (words[i] === '--data-urlencode') {
			const at = words[++i].indexOf('=');
			result.form[words[i].slice(0, at)] = words[i].slice(at + 1);
		} else if (words[i] === '--data-raw') result.raw = words[++i];
		else result.url = words[i];
	}
	return result;
}

const requests = recordings
	.flatMap(({ messages }) => messages)
	.filter(({ direction }) => direction === 'request');
const sendable = requests.filter((message) => !message.bodyNote && !message.log);

describe('a request as a command', () => {
	it('exists for a good many requests, in every recording', () => {
		expect(sendable.length).toBeGreaterThan(100);
		for (const { messages, preset } of recordings) {
			expect(
				messages.some((message) => curlFor(message, number)),
				preset
			).toBe(true);
		}
	});

	it('would send exactly what was recorded', () => {
		for (const message of sendable) {
			const sent = parsed(curlFor(message, number)!);
			expect(sent.method).toBe(message.method);
			expect(sent.url).toBe(message.url);
			expect(sent.headers).toEqual(message.headers);
			const isForm = message.headers['content-type']?.includes('x-www-form-urlencoded');
			if (message.body === undefined) {
				expect(sent.form).toEqual({});
				expect(sent.raw).toBeUndefined();
			} else if (isForm && typeof message.body === 'object') {
				const body = Object.fromEntries(
					Object.entries(message.body as object).map(([name, value]) => [name, String(value)])
				);
				expect(sent.form).toEqual(body);
			} else {
				expect(sent.raw).toBe(
					typeof message.body === 'string' ? message.body : JSON.stringify(message.body)
				);
			}
		}
	});

	it('quotes what would otherwise end the argument', () => {
		const message: RecordedMessage = {
			step: 'x',
			direction: 'request',
			method: 'POST',
			url: "http://localhost/it's",
			headers: {},
			body: "a 'quoted' value"
		};
		expect(curlFor(message, number)).toContain(`'http://localhost/it'\\''s'`);
		expect(parsed(curlFor(message, number)!).url).toBe("http://localhost/it's");
		expect(parsed(curlFor(message, number)!).raw).toBe("a 'quoted' value");
	});

	it('has none for an answer', () => {
		for (const message of recordings[0].messages.filter((m) => m.direction === 'response')) {
			expect(curlFor(message, number)).toBeNull();
		}
	});

	it('has none for what has something left out of it', () => {
		const message: RecordedMessage = {
			step: 'x',
			direction: 'request',
			method: 'POST',
			url: 'http://localhost/',
			headers: {},
			bodyNote: 'left out'
		};
		expect(curlFor(message, number)).toBeNull();
	});

	it('labels what it gives as throwaway, and warns about real secrets', () => {
		const command = curlFor(sendable[0], number)!;
		expect(command).toContain('throwaway');
		expect(command).toContain('Never paste real secrets');
	});

	it('says where a code came from only where that is where it really came from', () => {
		let checked = 0;
		for (const { messages, preset } of recordings) {
			for (const message of messages) {
				const from = message.step ? CODE_FROM[message.step] : undefined;
				if (!from) continue;
				const code = codeIn(message);
				// A login that was refused came back with an error, and there is no code to trade.
				if (!code) {
					expect(curlFor(message, number) ?? '', `${preset} ${message.step}`).not.toContain(
						'good once'
					);
					continue;
				}
				const source = messages.find(({ step }) => step === from);
				expect(source?.headers.location, `${preset} ${from}`).toContain(`code=${code}`);
				checked++;
			}
		}
		expect(checked).toBeGreaterThan(30);
	});

	it('does not call everything named code a code that was good once', () => {
		const consent = recordings.find(({ preset }) => preset === 'consent')!;
		const grant = consent.messages.find(({ step }) => step === 'consent-grant')!;
		expect(curlFor(grant, number)).not.toContain('good once');
	});

	it('says a code was good once, and where a new one comes from', () => {
		const oauth = recordings.find(({ preset }) => preset === 'oauth')!;
		const trade = oauth.messages.find(({ step }) => step === 'token-request')!;
		expect(curlFor(trade, number)).toContain('The code in this was good once');
		expect(curlFor(trade, number)).toContain('A new one comes from step 6');
		const callback = oauth.messages.find(({ step }) => step === 'callback')!;
		expect(curlFor(callback, number)).toContain('good once');
		const open = oauth.messages.find(({ step }) => step === 'open-app')!;
		expect(curlFor(open, number)).not.toContain('good once');
	});
});
