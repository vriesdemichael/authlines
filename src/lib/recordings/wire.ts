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
	/** The name a line starts with, of a JSON key, a parameter or a header, which can explain itself. */
	key?: string;
	/** That name is a header, which means something of its own: accept is a header and a button. */
	header?: boolean;
	/** The value itself, where the message has it encoded. */
	decoded?: string;
	/** How long a value someone was not sent is, which is all they get of it. */
	hidden?: number;
	/** Shown in full however long, because a line of a log is the point and not a detail of it. */
	whole?: boolean;
}

export const lineText = (line: Line) => `${line.before}${line.value ?? ''}${line.after ?? ''}`;

const decodeQueryValue = (value: string) => {
	try {
		return decodeURIComponent(value.replaceAll('+', ' '));
	} catch {
		return value;
	}
};

/**
 * Kept encoded, because that is what went over the wire, and split only to fit on a screen. What is
 * after the # is split the same way, because the implicit flow sends the token there.
 */
/** An address as lines, the first named by the header it is in, if it is in one. */
function urlLines(start: string, url: string, key?: string): Line[] {
	const hashAt = url.indexOf('#');
	const beforeHash = hashAt < 0 ? url : url.slice(0, hashAt);
	const fragment = hashAt < 0 ? null : url.slice(hashAt + 1);
	const at = beforeHash.indexOf('?');
	const query = at < 0 ? null : beforeHash.slice(at + 1);
	if (query === null && fragment === null) return [{ before: `${start}${url}`, key }];
	const pairsOf = (text: string, first: '?' | '#') =>
		text.split('&').map((pair, i): Line => {
			const equals = pair.indexOf('=');
			const name = equals < 0 ? pair : pair.slice(0, equals);
			const value = equals < 0 ? '' : pair.slice(equals + 1);
			return {
				before: `  ${i === 0 ? first : '&'}${name}=`,
				value,
				name,
				key: name,
				decoded: decodeQueryValue(value)
			};
		});
	return [
		{ before: `${start}${at < 0 ? beforeHash : beforeHash.slice(0, at)}`, key },
		...(query === null ? [] : pairsOf(query, '?')),
		...(fragment === null ? [] : pairsOf(fragment, '#'))
	];
}

/** The headers, each line that names one marked as a header, for what its name means there. */
function headerLines(headers: Record<string, string>): Line[] {
	return Object.entries(headers).flatMap(([name, value]): Line[] =>
		oneHeader(name, value).map((line) => (line.key === name ? { ...line, header: true } : line))
	);
}

function oneHeader(name: string, value: string): Line[] {
	if (name === 'location') return urlLines('location: ', value, name);
	if (name === 'authorization') {
		const space = value.indexOf(' ');
		const token = value.slice(space + 1);
		return [
			{
				before: `authorization: ${value.slice(0, space + 1)}`,
				value: token,
				name,
				key: name,
				decoded: token
			}
		];
	}
	if (name === 'dpop') return [{ before: 'dpop: ', value, name, key: name, decoded: value }];
	if (name === 'cookie' || name === 'set-cookie') {
		const start = value.indexOf('=') + 1;
		const end = value.indexOf(';') < 0 ? value.length : value.indexOf(';');
		const token = value.slice(start, end);
		return [
			{
				before: `${name}: ${value.slice(0, start)}`,
				value: token,
				after: value.slice(end),
				name: value.startsWith('KEYCLOAK') ? 'session' : 'cookie',
				key: name,
				decoded: token
			}
		];
	}
	return [{ before: `${name}: ${value}`, key: name }];
}

function formLines(body: Record<string, unknown>): Line[] {
	return Object.entries(body).map(([name, value], i): Line => {
		const encoded = new URLSearchParams({ [name]: String(value) }).toString();
		const prefix = `${name}=`;
		return {
			before: `${i === 0 ? '' : '&'}${prefix}`,
			value: encoded.slice(prefix.length),
			name,
			key: name,
			decoded: String(value)
		};
	});
}

function jsonLines(body: unknown): Line[] {
	return JSON.stringify(body, null, 2)
		.split('\n')
		.map((text): Line => {
			const key = text.match(/^\s*"([^"]+)":/)?.[1];
			const found = text.match(/^(\s*"([^"]+)": ")(.*)("(,?))$/);
			if (!found) return key ? { before: text, key } : { before: text };
			const [, before, name, value, after] = found;
			return { before, value, after, name, key, decoded: JSON.parse(`"${value}"`) as string };
		});
}

/** A value as lines of JSON, each with the key it starts with, as an opened token is shown. */
export const keyedLines = (value: unknown): Line[] => jsonLines(value);

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
	if (message.log) return message.log.map((line) => ({ before: '', value: line, whole: true }));
	// Kerberos is not HTTP: what kind of message it is, and its fields as RFC 4120 names them.
	if (message.protocol === 'kerberos') {
		return [{ before: `Kerberos ${message.method ?? ''}, over TCP` }, ...bodyLines(message)];
	}
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
			return { before: line.before, hidden: line.value.length, after: line.after, key: line.key };
		}
		// How it starts, such as POST and a path, which is what the arrow and the number say anyway.
		if (i === 0 || !line.before.trim() || /^\s*[{}[\]],?$/.test(line.before)) return line;
		const named = line.before.match(/^(\s*"?[\w-]+"?: ?)(.*?)(,?)$/);
		return named
			? { before: named[1], hidden: named[2].length, after: named[3], key: line.key }
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
	'cookie',
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
	/** As it was sent, because a signature is checked and has nothing in it to read. */
	signature: string;
}

function decodePart(part: string): unknown {
	const bytes = Uint8Array.from(atob(part.replaceAll('-', '+').replaceAll('_', '/')), (c) =>
		c.charCodeAt(0)
	);
	return JSON.parse(new TextDecoder().decode(bytes));
}

/** What is inside the signed tokens of a message. A token is readable, and that is worth seeing. */
/** A SAML message, which a form carries as base64 of XML. */
export interface DecodedSaml {
	name: string;
	xml: string;
}

const SAML_FIELDS = new Set(['SAMLRequest', 'SAMLResponse']);

/** What the SAML message on one line says, if it carries one. */
export function samlOf(line: Line): DecodedSaml | null {
	if (!line.name || !SAML_FIELDS.has(line.name) || !line.decoded) return null;
	try {
		const bytes = Uint8Array.from(atob(line.decoded), (char) => char.charCodeAt(0));
		const xml = new TextDecoder().decode(bytes);
		return xml.trimStart().startsWith('<') ? { name: line.name, xml: indented(xml) } : null;
	} catch {
		return null;
	}
}

/** What a SAML message says, so an assertion can be opened as a token can. */
export const samlIn = (lines: readonly Line[]): DecodedSaml[] =>
	lines.flatMap((line) => samlOf(line) ?? []);

/** One element to a line, because a server sends the whole document on one. */
function indented(xml: string): string {
	let depth = 0;
	return xml
		.trim()
		.replace(/>\s*</g, '>\n<')
		.split('\n')
		.map((tag) => {
			const closes = tag.startsWith('</');
			const whole =
				tag.startsWith('<?') || tag.endsWith('/>') || /^<[^>]+>[^<]*<\/[^>]+>$/.test(tag);
			if (closes) depth -= 1;
			const line = `${'  '.repeat(Math.max(depth, 0))}${tag}`;
			if (!closes && !whole) depth += 1;
			return line;
		})
		.join('\n');
}

/** What the signed token on one line says, if it carries one. */
export function jwtOf(line: Line): DecodedJwt | null {
	const parts = line.decoded?.split('.');
	if (!line.name || parts?.length !== 3 || !parts[0].startsWith('eyJ')) return null;
	try {
		return {
			name: line.name,
			header: decodePart(parts[0]),
			claims: decodePart(parts[1]),
			signature: parts[2]
		};
	} catch {
		return null;
	}
}

export const jwtsIn = (lines: readonly Line[]): DecodedJwt[] =>
	lines.flatMap((line) => jwtOf(line) ?? []);
