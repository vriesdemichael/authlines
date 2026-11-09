import { whyOf } from '#lib/flow/vocabulary.ts';
import { CLAIM_ROWS } from '#lib/pictures/what-a-token-says.ts';
import { CLAIMS, discovered, HEADERS, JOSE, WIRE } from '#lib/recordings/wire-words.ts';

/** Where an explanation comes from: a section of an RFC, or another spec, which the link opens. */
export type KeyCite = { rfc: number; section: string } | { title: string; url: string };

export interface KeyWhy {
	says: string;
	cite?: KeyCite;
}

const rfc4120 = (section: string): KeyCite => ({ rfc: 4120, section });

/**
 * What each key in a Kerberos message means, as RFC 4120 defines it, for someone who has never read
 * it (the maintainer, 2026-11-09: "many keys in the data that are unknown to me"). A test holds every
 * key in a recording to having one here.
 */
const KERBEROS_KEYS: Readonly<Record<string, KeyWhy>> = {
	'msg-type': {
		says: 'Which Kerberos message this is: AS-REQ and AS-REP for the first ticket, TGS-REQ and TGS-REP for one got with it, AP-REQ for showing a ticket, and KRB-ERROR when something is refused or the KDC wants more first.',
		cite: rfc4120('7.5.7')
	},
	padata: {
		says: 'Pre-authentication data: a list of things sent beside the request or the answer, each with a type, to prove something or to say how. An entry with nothing in it is a signal: in a request, that the client can do this, and in an error, that the KDC takes it.',
		cite: rfc4120('5.2.7')
	},
	'padata-type': {
		says: 'Which kind of pre-authentication data this is, by number. Each kind means something of its own.',
		cite: rfc4120('5.2.7')
	},
	'padata-value': {
		says: 'The data itself, whose shape depends on its type.',
		cite: rfc4120('5.2.7')
	},
	'kdc-options': {
		says: 'Flags for the ticket asked for, and for how the KDC may answer.',
		cite: rfc4120('5.4.1')
	},
	cname: {
		says: 'The client, which is the user, by name and without the realm. It is sent in the clear.',
		cite: rfc4120('5.4.1')
	},
	crealm: { says: 'The client’s Kerberos realm.', cite: rfc4120('5.4.2') },
	realm: {
		says: 'The realm of the service named in sname, whose KDC gives the ticket. In a first request it is the user’s realm too. This is not the identity provider’s realm.',
		cite: rfc4120('5.4.1')
	},
	sname: {
		says: 'The service a ticket is for: krbtgt is the KDC itself, and HTTP with a host name is a website.',
		cite: rfc4120('5.4.1')
	},
	till: {
		says: 'When the ticket asked for should run out. The KDC can give less.',
		cite: rfc4120('5.4.1')
	},
	nonce: {
		says: 'A random number the answer repeats inside its sealed part, so an old answer cannot be passed off as this one.',
		cite: rfc4120('5.4.1')
	},
	etype: {
		says: 'In a request, the kinds of encryption the client can use, the one it would rather have first. Beside a cipher, the kind that sealed it.',
		cite: rfc4120('5.4.1')
	},
	stime: {
		says: 'The KDC’s own time. Kerberos needs the clocks to roughly agree.',
		cite: rfc4120('5.9.1')
	},
	'error-code': {
		says: 'What went wrong, by number. 25 means the KDC wants proof of who is asking before it gives a ticket, and the e-data beside it says which kinds it takes. Asking with no proof first is the usual start.',
		cite: rfc4120('7.5.9')
	},
	'e-text': { says: 'More about the error, as text.', cite: rfc4120('5.9.1') },
	'e-data': {
		says: 'Data that goes with the error. Here, the kinds of pre-authentication the KDC will take, how to make the key for it, and a cookie to send back.',
		cite: rfc4120('5.9.1')
	},
	salt: {
		says: 'What goes in with the password to make the key, so the same password makes a different key for each user. Here it is the realm and the user’s name.',
		cite: rfc4120('4')
	},
	cipher: {
		says: 'The sealed bytes. Only whoever has the key can read them.',
		cite: rfc4120('5.2.9')
	},
	ticket: {
		says: 'A ticket: which service it is for, in the clear, and the rest sealed with a key only that service and the KDC have, with the session key, the user’s name and how long it lasts. A ticket for krbtgt only the KDC can read.',
		cite: rfc4120('5.3')
	},
	'enc-part': {
		says: 'The sealed part, with which kind of encryption sealed it and which version of the key. A ticket’s is for the service. An answer’s own is for the client, and holds the new session key and the nonce.',
		cite: rfc4120('5.2.9')
	},
	kvno: {
		says: 'Which version of the key sealed it, so whoever reads it picks the right one.',
		cite: rfc4120('5.2.9')
	},
	'ap-options': {
		says: 'Options for showing the ticket, such as asking the service to prove itself in return. None here.',
		cite: rfc4120('5.5.1')
	},
	authenticator: {
		says: 'Proof that whoever shows the ticket has its session key: their name and the time, sealed with that key, so a copied ticket alone is not enough.',
		cite: rfc4120('5.5.1')
	}
};

/** What each kind of pre-authentication data recorded here is, by the name the reader gives it. */
const PADATA_TYPES: Readonly<Record<string, KeyWhy>> = {
	'PA-TGS-REQ': {
		says: 'The ticket-granting ticket and an authenticator, to ask for another ticket with it.',
		cite: rfc4120('5.2.7.1')
	},
	'PA-ENC-TIMESTAMP': {
		says: 'The time, sealed with a key made from the password, which proves the password without sending it.',
		cite: rfc4120('5.2.7.2')
	},
	'PA-ETYPE-INFO2': {
		says: 'Which kind of key to make from the password, and the salt to make it with.',
		cite: rfc4120('5.2.7.5')
	},
	'PA-FX-COOKIE': {
		says: 'A value the KDC hands out and wants back in the next request, so it can carry on where it left off. A later addition to Kerberos.',
		cite: { rfc: 6113, section: '5.2' }
	},
	'PA-FX-FAST': {
		says: 'FAST, which wraps a request and its answer in a protected tunnel. In the KDC’s error it is only an offer, with nothing in it. Here only the request for the service ticket and its answer are wrapped, with the first ticket. A later addition to Kerberos.',
		cite: { rfc: 6113, section: '5.4.2' }
	},
	'PA-AS-FRESHNESS': {
		says: 'Says the client can take a fresh value from the KDC and put it in the signed proof of a login with a certificate, so that proof cannot have been made in advance. No certificate is used here. A later addition to Kerberos.',
		cite: { rfc: 8070, section: '2.1' }
	},
	'PA-REQ-ENC-PA-REP': {
		says: 'Says the client can check its request was not changed on the way: the KDC then seals a checksum of the request inside its answer. Empty, because it only says the client can. A later addition to Kerberos.',
		cite: { rfc: 6806, section: '11' }
	}
};

/** The name a reader gave a value, without its number: "PA-FX-FAST (136)" is PA-FX-FAST. */
const named = (value: string) => value.replace(/\s*\(\d+\)$/, '');

/** What each claim in the picture of a token says, which is the same where the raw view opens one. */
function claimIs(key: string): KeyWhy | undefined {
	const row = CLAIM_ROWS.find(({ names }) => names.includes(key));
	return row ? { says: row.is } : undefined;
}

/** Where a key is, which decides which of its meanings it has: accept is a header and a button. */
export type KeyPlace = 'kerberos' | 'header' | 'jose' | 'claims' | 'wire';

/** What a key in the raw view means, and for a padata-type what its value is too. */
export function keyWhy(
	key: string,
	{ where, value }: { where: KeyPlace; value?: string }
): KeyWhy | undefined {
	if (where === 'kerberos') {
		const about = KERBEROS_KEYS[key];
		const kind = key === 'padata-type' && value ? PADATA_TYPES[named(value)] : undefined;
		if (about && kind) return { says: `${about.says} This one: ${kind.says}`, cite: kind.cite };
		return about;
	}
	if (where === 'header') return HEADERS[key];
	// A proof's header holds its public key, whose fields are those of a key set.
	if (where === 'jose') return JOSE[key] ?? WIRE[key];
	if (where === 'claims') return claimIs(key) ?? CLAIMS[key];
	const says = whyOf({ name: key });
	return (
		WIRE[key] ?? (says ? { says } : undefined) ?? claimIs(key) ?? CLAIMS[key] ?? discovered(key)
	);
}

/** Every key and kind this explains, for a test to hold the recordings to. */
export const explainedKerberos = {
	keys: Object.keys(KERBEROS_KEYS),
	padataTypes: Object.keys(PADATA_TYPES)
};

export const citeUrl = (cite: KeyCite) =>
	'rfc' in cite
		? `https://www.rfc-editor.org/rfc/rfc${cite.rfc}.html#section-${cite.section}`
		: cite.url;

export const citeText = (cite: KeyCite) =>
	'rfc' in cite ? `RFC ${cite.rfc}, section ${cite.section}` : cite.title;
