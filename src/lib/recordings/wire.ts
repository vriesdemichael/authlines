import type { Field, Step } from '#lib/flow/model.ts';
import type { ArtifactId } from '#lib/flow/vocabulary.ts';
import type { RecordedMessage, Recording } from '#lib/recordings/format.ts';

/** One line of a message, with at most one value in it that is worth following. */
export interface Line {
	before: string;
	value?: string;
	after?: string;
	/** What the message calls the value. */
	name?: string;
	/** The value itself, where the message has it encoded. */
	decoded?: string;
	/** How long a value someone was not sent is, which is all they get of it. */
	hidden?: number;
}

export const lineText = (line: Line) => `${line.before}${line.value ?? ''}${line.after ?? ''}`;

const decodeQueryValue = (value: string) => {
	try {
		return decodeURIComponent(value.replaceAll('+', ' '));
	} catch {
		return value;
	}
};

/** Kept encoded, because that is what went over the wire, and split only to fit on a screen. */
function urlLines(start: string, url: string): Line[] {
	const at = url.indexOf('?');
	if (at < 0) return [{ before: `${start}${url}` }];
	const pairs = url
		.slice(at + 1)
		.split('&')
		.map((pair, i): Line => {
			const equals = pair.indexOf('=');
			const name = equals < 0 ? pair : pair.slice(0, equals);
			const value = equals < 0 ? '' : pair.slice(equals + 1);
			return {
				before: `  ${i === 0 ? '?' : '&'}${name}=`,
				value,
				name,
				decoded: decodeQueryValue(value)
			};
		});
	return [{ before: `${start}${url.slice(0, at)}` }, ...pairs];
}

function headerLines(headers: Record<string, string>): Line[] {
	return Object.entries(headers).flatMap(([name, value]): Line[] => {
		if (name === 'location') return urlLines('location: ', value);
		if (name === 'authorization') {
			const space = value.indexOf(' ');
			const token = value.slice(space + 1);
			return [
				{
					before: `authorization: ${value.slice(0, space + 1)}`,
					value: token,
					name,
					decoded: token
				}
			];
		}
		if (name === 'dpop') return [{ before: 'dpop: ', value, name, decoded: value }];
		if (name === 'cookie' || name === 'set-cookie') {
			const start = value.indexOf('=') + 1;
			const end = value.indexOf(';') < 0 ? value.length : value.indexOf(';');
			const token = value.slice(start, end);
			return [
				{
					before: `${name}: ${value.slice(0, start)}`,
					value: token,
					after: value.slice(end),
					name: 'session',
					decoded: token
				}
			];
		}
		return [{ before: `${name}: ${value}` }];
	});
}

function formLines(body: Record<string, unknown>): Line[] {
	return Object.entries(body).map(([name, value], i): Line => {
		const encoded = new URLSearchParams({ [name]: String(value) }).toString();
		const prefix = `${name}=`;
		return {
			before: `${i === 0 ? '' : '&'}${prefix}`,
			value: encoded.slice(prefix.length),
			name,
			decoded: String(value)
		};
	});
}

function jsonLines(body: unknown): Line[] {
	return JSON.stringify(body, null, 2)
		.split('\n')
		.map((text): Line => {
			const found = text.match(/^(\s*"([^"]+)": ")(.*)("(,?))$/);
			if (!found) return { before: text };
			const [, before, name, value, after] = found;
			return { before, value, after, name, decoded: JSON.parse(`"${value}"`) as string };
		});
}

function bodyLines(message: RecordedMessage): Line[] {
	if (message.bodyNote) return [{ before: '' }, { before: `(${message.bodyNote})` }];
	const { body } = message;
	if (body === undefined) return [];
	const isForm = message.headers['content-type']?.includes('x-www-form-urlencoded');
	const lines =
		isForm && typeof body === 'object' && body !== null
			? formLines(body as Record<string, unknown>)
			: typeof body === 'string'
				? body.split('\n').map((text): Line => ({ before: text }))
				: jsonLines(body);
	return [{ before: '' }, ...lines];
}

/** A message as text, from nothing but what the recording holds (ADR-005). */
/** The one thing a server named on the wire that is its own word. With its notes off, it goes. */
const withoutServerName = (headers: RecordedMessage['headers']) =>
	Object.fromEntries(
		Object.entries(headers).map(([name, value]) => [
			name,
			value.replace('KEYCLOAK_IDENTITY', 'session')
		])
	);

export function rawLines(
	message: RecordedMessage,
	{ serverNamed = true }: { serverNamed?: boolean } = {}
): Line[] {
	const first =
		message.direction === 'request'
			? urlLines(`${message.method} `, message.url ?? '')
			: [{ before: `HTTP ${message.status}` }];
	const headers = serverNamed ? message.headers : withoutServerName(message.headers);
	return [...first, ...headerLines(headers), ...bodyLines(message)];
}

/**
 * A message as someone who was not part of it has it: what kind of thing was there, and how long, with
 * no value in it at all, so that it is not on the page to be selected or read out.
 */
export function redactedLines(lines: readonly Line[]): Line[] {
	return lines.map((line, i) => {
		if (line.value !== undefined) {
			return { before: line.before, hidden: line.value.length, after: line.after };
		}
		// How it starts, such as POST and a path, which is what the arrow and the number say anyway.
		if (i === 0 || !line.before.trim() || /^\s*[{}[\]],?$/.test(line.before)) return line;
		const named = line.before.match(/^(\s*"?[\w-]+"?: ?)(.*?)(,?)$/);
		return named
			? { before: named[1], hidden: named[2].length, after: named[3] }
			: { before: '', hidden: line.before.length };
	});
}

/** The values of a run that someone was sent by now, wherever each one first appeared. */
export function valuesSeen(
	recording: Recording,
	trace: readonly RunValue[],
	seesStep: (step: string) => boolean,
	soFar: (step: string) => boolean
): RunValue[] {
	const text = recording.messages
		.filter(({ step }) => step !== null && seesStep(step) && soFar(step))
		.flatMap((message) => rawLines(message).map(lineText))
		.join('\n');
	return trace.filter(({ value }) => text.includes(value));
}

/** Names of what a run makes up as it goes, as opposed to what stays the same on every run. */
const MADE_IN_THE_RUN = new Set([
	'state',
	'nonce',
	'code',
	'code_challenge',
	'code_verifier',
	'access_token',
	'id_token',
	'refresh_token',
	'session',
	'device_code',
	'user_code'
]);

export interface RunValue {
	name: string;
	value: string;
	/** The step it first appears on. */
	step: string;
}

/** Each value a run made up, where it first appeared, in the order they appeared. */
export function traceRun(recording: Recording): RunValue[] {
	const seen = new Map<string, RunValue>();
	for (const message of recording.messages) {
		if (!message.step) continue;
		for (const line of rawLines(message)) {
			if (!line.name || !line.decoded || !MADE_IN_THE_RUN.has(line.name)) continue;
			if (!seen.has(line.decoded)) {
				seen.set(line.decoded, { name: line.name, value: line.decoded, step: message.step });
			}
		}
	}
	return [...seen.values()];
}

/** A line's value in a run: new on this step, carried from an earlier one, or neither. */
export function originOf(
	line: Line,
	step: string,
	trace: readonly RunValue[]
): { new: true } | { from: string } | null {
	if (!line.decoded) return null;
	const first = trace.find((value) => value.value === line.decoded);
	if (!first) return null;
	return first.step === step ? { new: true } : { from: first.step };
}

const namesOf = (field: Field) =>
	field.artifact === 'password' ? ['password'] : [field.name.split(/[=:]/)[0].toLowerCase()];

/** The chip a value is on the diagram, so it looks the same in both places (ADR-014). */
export function artifactOf(step: Step, name: string | undefined): ArtifactId | undefined {
	if (!name) return undefined;
	const wanted = name.toLowerCase();
	return step.fields.find((field) => field.artifact && namesOf(field).includes(wanted))?.artifact;
}

export interface DecodedJwt {
	name: string;
	header: unknown;
	claims: unknown;
}

function decodePart(part: string): unknown {
	const bytes = Uint8Array.from(atob(part.replaceAll('-', '+').replaceAll('_', '/')), (c) =>
		c.charCodeAt(0)
	);
	return JSON.parse(new TextDecoder().decode(bytes));
}

/** What is inside the signed tokens of a message. A token is readable, and that is worth seeing. */
export function jwtsIn(lines: readonly Line[]): DecodedJwt[] {
	return lines.flatMap((line) => {
		const parts = line.decoded?.split('.');
		if (!line.name || parts?.length !== 3 || !parts[0].startsWith('eyJ')) return [];
		try {
			return [{ name: line.name, header: decodePart(parts[0]), claims: decodePart(parts[1]) }];
		} catch {
			return [];
		}
	});
}
