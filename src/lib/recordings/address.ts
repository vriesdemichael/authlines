import type { Recording } from '#lib/recordings/format.ts';

/** What the address bar said at a step: where its request was sent, or where its redirect went. */
export function addressAt(recording: Recording, step: string): string | null {
	const at = recording.messages.findIndex((candidate) => candidate.step === step);
	const message = recording.messages[at];
	if (!message) return null;
	// A browser keeps what is after the # of the redirect that sent it, which it never sends.
	if (message.url && !message.url.includes('#')) {
		const sent = recording.messages
			.slice(0, at)
			.findLast((candidate) => candidate.headers.location?.startsWith(`${message.url}#`));
		if (sent) return sent.headers.location!;
	}
	const own = message.url ?? message.headers.location;
	if (own) return own;
	// A page that is not a redirect is at the address of the request it answered.
	const asked = recording.messages
		.slice(0, at)
		.findLast((candidate) => candidate.direction === 'request');
	return asked?.url ?? null;
}

/** The words someone can select in an address, for the parameters that have one. */
const TERM_OF: Readonly<Record<string, string>> = {
	code: 'code',
	state: 'state',
	iss: 'iss',
	nonce: 'nonce',
	scope: 'scope',
	client_id: 'client-id',
	redirect_uri: 'redirect-uri',
	access_token: 'access-token',
	code_challenge: 'challenge'
};

const LONGEST_VALUE = 18;

export interface AddressPart {
	name: string;
	value: string;
	/** All of it, because a value in the bar is cut short, as a browser would have to as well. */
	whole: string;
	marked: boolean;
	term?: string;
	/** After the #, which the browser keeps and never sends. */
	fragment?: boolean;
}

export interface Address {
	where: string;
	parts: AddressPart[];
	/** How many are not shown. Simple mode only has the ones that matter here. */
	left: number;
}

/** The address, with what matters here picked out. Everything else can go, but nothing is made up. */
export function readAddress(
	url: string,
	marks: readonly string[] = [],
	{ everything = false }: { everything?: boolean } = {}
): Address {
	const { host, pathname, searchParams, hash } = new URL(url);
	const part =
		(fragment: boolean) =>
		([name, whole]: [string, string]) => ({
			name,
			whole,
			value: whole.length > LONGEST_VALUE ? `${whole.slice(0, LONGEST_VALUE)}…` : whole,
			marked: marks.includes(name),
			term: TERM_OF[name],
			...(fragment ? { fragment } : {})
		});
	const all = [
		...[...searchParams].map(part(false)),
		...[...new URLSearchParams(hash.slice(1))].map(part(true))
	];
	const parts = everything ? all : all.filter((part) => part.marked);
	return { where: `${host}${pathname}`, parts, left: all.length - parts.length };
}
