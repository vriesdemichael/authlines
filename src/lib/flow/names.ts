import type { BaseFlow, DiagramView, Lifeline } from '#lib/flow/model.ts';
import type { Recording } from '#lib/recordings/format.ts';

/**
 * Names for the parties on a recorded flow, from the part of a link after `#`, which an AI agent
 * writes for someone's own setup (#168, ADR-017). They go on the heads of the diagram and nowhere
 * else, and every payload stays as it was recorded (ADR-005). The part after `#` never reaches a
 * server, so someone's own system stays in their browser (ADR-010).
 */
export const NAMES_VERSION = '1';
export const LONGEST_NAME = 32;

export type GivenNames = Readonly<Record<string, string>>;

export interface NamesInLink {
	names: GivenNames;
	/** What did not fit, said so that whoever wrote the link can put it right. */
	problems: readonly string[];
}

const NONE: NamesInLink = { names: {}, problems: [] };

// What would change how the rest reads without showing, or look like something to follow or type.
// eslint-disable-next-line no-control-regex -- control characters are what this looks for
const INVISIBLE = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/;
const MARKUP = /[<>]/;
const ADDRESS = /:\/\/|^www\./i;
const TOKEN = /eyJ[\w-]{8,}/;

/** Every party a flow can draw, on either of its diagrams and with any settings. */
export function partiesOf(base: BaseFlow): string[] {
	const ids = Object.values(base.diagrams).flatMap((diagram) => diagram.lifelines.map((l) => l.id));
	return [...new Set(ids)];
}

/** What is wrong with a name, for the field someone types one into as much as for a link. */
export function problemWith(raw: string): string | null {
	const name = raw.trim();
	if (!name) return 'is empty';
	// What is wrong with it before how long it is, because that is what whoever wrote it should hear.
	if (INVISIBLE.test(raw)) return 'has characters that do not show';
	if (MARKUP.test(name)) return 'has < or >, and a name is plain text';
	if (ADDRESS.test(name)) return 'looks like an address, and a name is never a link';
	if (TOKEN.test(name)) return 'looks like a token, and a link must never hold one';
	if (name.length > LONGEST_NAME) return `is longer than ${LONGEST_NAME} characters`;
	return null;
}

/**
 * What a link names, as `v=1&app=Payroll&idp=Entra`. A party this flow never draws, or a name that
 * does not fit, is left out and said, so nothing is drawn that the link did not mean.
 */
export function parseNames(hash: string, base: BaseFlow): NamesInLink {
	const text = hash.replace(/^#/, '');
	if (!text) return NONE;
	const params = new URLSearchParams(text);
	const version = params.get('v');
	if (version !== NAMES_VERSION) {
		return {
			names: {},
			problems: [
				version === null
					? `The names have no version. They start with v=${NAMES_VERSION}.`
					: `The names are version ${version}, and this site reads version ${NAMES_VERSION}.`
			]
		};
	}
	const parties = partiesOf(base);
	const names: Record<string, string> = {};
	const problems: string[] = [];
	for (const [party, raw] of params) {
		if (party === 'v') continue;
		if (!parties.includes(party)) {
			problems.push(`This flow has no party called ${party}. It has ${parties.join(', ')}.`);
			continue;
		}
		if (Object.hasOwn(names, party)) {
			problems.push(`${party} is named twice, so the first is used.`);
			continue;
		}
		const problem = problemWith(raw);
		if (problem) {
			problems.push(`The name for ${party} ${problem}.`);
			continue;
		}
		names[party] = raw.trim().replace(/\s+/g, ' ');
	}
	return { names, problems };
}

/** The part after `#` that gives these names, for a link. */
export function namesHash(names: GivenNames): string {
	const entries = Object.entries(names);
	return entries.length ? `#${new URLSearchParams([['v', NAMES_VERSION], ...entries])}` : '';
}

/** The same view, with the names a link gave. Nothing but the names changes. */
export function withNames(view: DiagramView, names: GivenNames): DiagramView {
	if (!view.lifelines.some((line) => Object.hasOwn(names, line.id))) return view;
	return {
		...view,
		lifelines: view.lifelines.map((line) =>
			Object.hasOwn(names, line.id) ? { ...line, given: names[line.id] } : line
		)
	};
}

const queryValue = (url: string | undefined, name: string) => {
	if (!url) return undefined;
	try {
		return new URL(url).searchParams.get(name) ?? undefined;
	} catch {
		return undefined;
	}
};

/** What a party is in the recording, by the value someone would look for in the traffic. */
export function recordedAs(recording: Recording, party: string): string | undefined {
	const { messages } = recording;
	if (party === 'app') {
		for (const message of messages) {
			const body = message.body as Record<string, unknown> | undefined;
			const id =
				queryValue(message.url, 'client_id') ??
				(typeof body?.client_id === 'string' ? body.client_id : undefined);
			if (id) return id;
		}
	}
	if (party === 'idp') {
		for (const message of messages) {
			const realm = message.url?.match(/\/realms\/([^/?#]+)/)?.[1];
			if (realm) return realm;
		}
	}
	if (party === 'api') {
		const call = messages.find((message) => message.step === 'api-request');
		if (call?.url) return new URL(call.url).host;
	}
	return undefined;
}

const listed = (parts: readonly string[]) =>
	parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;

/** What a party is, in a sentence: the app, and not the App, though the API stays the API. */
export const theKind = (plainName: string) =>
	`the ${/^[A-Z][a-z]/.test(plainName) ? plainName.charAt(0).toLowerCase() + plainName.slice(1) : plainName}`;

/** The names a link gave, with what each one is, in a sentence. */
export function namesSaid(lines: readonly Pick<Lifeline, 'given' | 'plainName'>[]): string {
	return listed(
		lines.flatMap((line) => (line.given ? [`${line.given} for ${theKind(line.plainName)}`] : []))
	);
}

/**
 * What the raw view says once a link has named the parties: the traffic is the site's own, and
 * which of its values is which named party.
 */
export function seamOf(recording: Recording, view: DiagramView, serverNamed: boolean): string {
	const server = serverNamed ? 'Keycloak' : 'server';
	const parts = view.lifelines.flatMap((line) => {
		const value = line.given && recordedAs(recording, line.id);
		if (!line.given || !value) return [];
		if (line.id === 'idp') {
			return [`${line.given} is ${serverNamed ? 'the Keycloak realm ' : ''}${value}`];
		}
		return [`${line.given} is ${value}`];
	});
	const said = `Recorded on the site's own ${server}. The names from the link are on the diagram only`;
	return parts.length ? `${said}: here ${listed(parts)}.` : `${said}.`;
}
