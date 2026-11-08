// Kerberos messages are ASN.1 in DER (RFC 4120 section 5), and SPNEGO wraps them for HTTP (RFC 4178,
// RFC 4559). This reads what a recording caught on the wire into the spec's own field names, so that
// what anyone carrying it can read is plain, and what is sealed for someone else stays bytes.

interface Element {
	/** The first byte: class, whether it is constructed, and the tag number. */
	tag: number;
	constructed: boolean;
	content: Buffer;
}

function read(bytes: Buffer, at = 0): { element: Element; next: number } {
	const tag = bytes[at];
	let length = bytes[at + 1];
	let start = at + 2;
	if (length & 0x80) {
		const octets = length & 0x7f;
		length = 0;
		for (let i = 0; i < octets; i++) length = length * 256 + bytes[start + i];
		start += octets;
	}
	if (start + length > bytes.length) throw new Error('A DER element runs past its message');
	return {
		element: {
			tag,
			constructed: (tag & 0x20) !== 0,
			content: bytes.subarray(start, start + length)
		},
		next: start + length
	};
}

function children(element: Element): Element[] {
	const out: Element[] = [];
	for (let at = 0; at < element.content.length;) {
		const { element: child, next } = read(element.content, at);
		out.push(child);
		at = next;
	}
	return out;
}

/** The fields of a SEQUENCE whose members are tagged [0], [1] and so on, by their number. */
function fields(element: Element): Map<number, Element> {
	const sequence = element.tag === 0x30 ? element : children(element)[0];
	const out = new Map<number, Element>();
	for (const field of children(sequence)) out.set(field.tag & 0x1f, children(field)[0]);
	return out;
}

const integer = (element: Element) => {
	let value = element.content[0] & 0x80 ? -1 : 0;
	for (const byte of element.content) value = value * 256 + byte;
	return value;
};
const text = (element: Element) => element.content.toString('utf8');
const oid = (element: Element) => {
	const [first, ...rest] = element.content;
	const parts = [Math.floor(first / 40), first % 40];
	let value = 0;
	for (const byte of rest) {
		value = value * 128 + (byte & 0x7f);
		if (!(byte & 0x80)) {
			parts.push(value);
			value = 0;
		}
	}
	return parts.join('.');
};
/** GeneralizedTime as Kerberos writes it, YYYYMMDDHHMMSSZ, as ISO 8601. */
const time = (element: Element) =>
	text(element).replace(/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)Z$/, '$1-$2-$3T$4:$5:$6Z');

/** Section 7.5.1 numbers the kinds of message, and they are tagged with it. */
export const MESSAGE_TYPES: Record<number, string> = {
	10: 'AS-REQ',
	11: 'AS-REP',
	12: 'TGS-REQ',
	13: 'TGS-REP',
	14: 'AP-REQ',
	15: 'AP-REP',
	30: 'KRB-ERROR'
};

// RFC 3961, RFC 3962, RFC 8009 and RFC 6803 for the ones a client lists today.
const ETYPES: Record<number, string> = {
	16: 'des3-cbc-sha1',
	17: 'aes128-cts-hmac-sha1-96',
	18: 'aes256-cts-hmac-sha1-96',
	19: 'aes128-cts-hmac-sha256-128',
	20: 'aes256-cts-hmac-sha384-192',
	23: 'arcfour-hmac',
	25: 'camellia128-cts-cmac',
	26: 'camellia256-cts-cmac'
};
const named = (names: Record<number, string>, value: number) =>
	names[value] ? `${names[value]} (${value})` : String(value);

// Section 7.5.2, and the ones later RFCs and MIT add that a run here sends.
const PA_TYPES: Record<number, string> = {
	1: 'PA-TGS-REQ',
	2: 'PA-ENC-TIMESTAMP',
	3: 'PA-PW-SALT',
	11: 'PA-ETYPE-INFO',
	19: 'PA-ETYPE-INFO2',
	128: 'PA-PAC-REQUEST',
	133: 'PA-FX-COOKIE',
	136: 'PA-FX-FAST',
	138: 'PA-ENCRYPTED-CHALLENGE',
	149: 'PA-REQ-ENC-PA-REP',
	150: 'PA-AS-FRESHNESS'
};

// Section 7.5.9, for the ones a login runs into.
const ERRORS: Record<number, string> = {
	6: 'KDC_ERR_C_PRINCIPAL_UNKNOWN',
	7: 'KDC_ERR_S_PRINCIPAL_UNKNOWN',
	24: 'KDC_ERR_PREAUTH_FAILED',
	25: 'KDC_ERR_PREAUTH_REQUIRED',
	37: 'KRB_AP_ERR_SKEW'
};

// Section 5.4.1, bit 0 first, where 15 is canonicalize, which RFC 6806 defines.
const KDC_OPTIONS: Record<number, string> = {
	0: 'reserved',
	1: 'forwardable',
	2: 'forwarded',
	3: 'proxiable',
	4: 'proxy',
	5: 'allow-postdate',
	6: 'postdated',
	8: 'renewable',
	11: 'opt-hardware-auth',
	15: 'canonicalize',
	26: 'disable-transited-check',
	27: 'renewable-ok',
	28: 'enc-tkt-in-skey',
	30: 'renew',
	31: 'validate'
};
// Section 5.5.1.
const AP_OPTIONS: Record<number, string> = {
	0: 'reserved',
	1: 'use-session-key',
	2: 'mutual-required'
};

function flags(element: Element, names: Record<number, string>): string[] {
	const bits = element.content.subarray(1);
	const out: string[] = [];
	for (let bit = 0; bit < bits.length * 8; bit++) {
		if (bits[bit >> 3] & (0x80 >> (bit & 7))) out.push(names[bit] ?? `bit ${bit}`);
	}
	return out;
}

const principal = (element: Element) => {
	const parts = fields(element);
	const strings = parts.get(1);
	return strings ? children(strings).map(text).join('/') : '';
};

/** Sealed for someone with the key: what kind, which version of the key, and the bytes. */
function encrypted(element: Element) {
	const parts = fields(element);
	const etype = parts.get(0);
	const kvno = parts.get(1);
	const cipher = parts.get(2);
	return {
		etype: etype ? named(ETYPES, integer(etype)) : '',
		...(kvno ? { kvno: integer(kvno) } : {}),
		cipher: cipher ? cipher.content.toString('base64') : ''
	};
}

function ticket(element: Element) {
	const parts = fields(element);
	return {
		realm: text(parts.get(1)!),
		sname: principal(parts.get(2)!),
		'enc-part': encrypted(parts.get(3)!)
	};
}

function paData(element: Element) {
	return children(element).map((entry) => {
		const parts = fields(entry);
		const type = integer(parts.get(1)!);
		const value = parts.get(2)?.content ?? Buffer.alloc(0);
		const out: Record<string, unknown> = { 'padata-type': named(PA_TYPES, type) };
		if (type === 2 && value.length) out['padata-value'] = encrypted(read(value).element);
		else if (type === 1 && value.length) out['padata-value'] = decodeKerberos(value);
		else if (type === 19 && value.length) {
			out['padata-value'] = children(read(value).element).map((info) => {
				const of = fields(info);
				return {
					etype: named(ETYPES, integer(of.get(0)!)),
					...(of.get(1) ? { salt: text(of.get(1)!) } : {})
				};
			});
		} else if (value.length) out['padata-value'] = value.toString('base64');
		return out;
	});
}

function kdcRequest(element: Element, type: number) {
	const parts = fields(element);
	const body = fields(parts.get(4)!);
	const padata = parts.get(3);
	const cname = body.get(1);
	const sname = body.get(3);
	// What the spec puts in req-body is shown beside padata, as a diagram shows the fields of a message.
	return {
		'msg-type': named(MESSAGE_TYPES, type),
		...(padata ? { padata: paData(padata) } : {}),
		'kdc-options': flags(body.get(0)!, KDC_OPTIONS),
		...(cname ? { cname: principal(cname) } : {}),
		realm: text(body.get(2)!),
		...(sname ? { sname: principal(sname) } : {}),
		till: time(body.get(5)!),
		nonce: integer(body.get(7)!),
		etype: children(body.get(8)!).map((e) => named(ETYPES, integer(e)))
	};
}

function kdcReply(element: Element, type: number) {
	const parts = fields(element);
	const padata = parts.get(2);
	return {
		'msg-type': named(MESSAGE_TYPES, type),
		...(padata ? { padata: paData(padata) } : {}),
		crealm: text(parts.get(3)!),
		cname: principal(parts.get(4)!),
		ticket: ticket(parts.get(5)!),
		'enc-part': encrypted(parts.get(6)!)
	};
}

function apRequest(element: Element) {
	const parts = fields(element);
	return {
		'msg-type': named(MESSAGE_TYPES, 14),
		'ap-options': flags(parts.get(2)!, AP_OPTIONS),
		ticket: ticket(parts.get(3)!),
		authenticator: encrypted(parts.get(4)!)
	};
}

function error(element: Element) {
	const parts = fields(element);
	const code = integer(parts.get(6)!);
	const data = parts.get(12);
	let eData: unknown;
	if (data) {
		// For a login that has to prove itself first, the ways it may, as PA-DATA (section 5.9.1).
		try {
			eData = paData(read(data.content).element);
		} catch {
			eData = data.content.toString('base64');
		}
	}
	return {
		'msg-type': named(MESSAGE_TYPES, 30),
		stime: time(parts.get(4)!),
		'error-code': named(ERRORS, code),
		...(parts.get(8) ? { cname: principal(parts.get(8)!) } : {}),
		realm: text(parts.get(9)!),
		sname: principal(parts.get(10)!),
		...(parts.get(11) ? { 'e-text': text(parts.get(11)!) } : {}),
		...(eData ? { 'e-data': eData } : {})
	};
}

/** A Kerberos message as the spec names its parts. */
export function decodeKerberos(bytes: Buffer): Record<string, unknown> {
	const { element } = read(bytes);
	const type = element.tag & 0x1f;
	if ((element.tag & 0xc0) !== 0x40) throw new Error(`Not a Kerberos message: tag ${element.tag}`);
	if (type === 10 || type === 12) return kdcRequest(element, type);
	if (type === 11 || type === 13) return kdcReply(element, type);
	if (type === 14) return apRequest(element);
	if (type === 30) return error(element);
	throw new Error(`A Kerberos message this does not read: ${type}`);
}

/** The kind of a Kerberos message, from its first byte. */
export const messageType = (bytes: Buffer) => MESSAGE_TYPES[bytes[0] & 0x1f] ?? 'unknown';

const MECHANISMS: Record<string, string> = {
	'1.2.840.113554.1.2.2': 'Kerberos 5',
	'1.2.840.48018.1.2.2': 'Kerberos 5, as Windows once numbered it',
	'1.3.6.1.5.5.2': 'SPNEGO',
	'1.3.6.1.4.1.311.2.2.10': 'NTLM',
	'1.3.6.1.5.2.5': 'IAKERB'
};
const mechanism = (element: Element) => {
	const id = oid(element);
	return MECHANISMS[id] ? `${MECHANISMS[id]} (${id})` : id;
};

// RFC 4178 section 4.2.2.
const NEG_STATES = ['accept-completed', 'accept-incomplete', 'reject', 'request-mic'];

/**
 * What follows Negotiate in an Authorization or WWW-Authenticate header (RFC 4559): SPNEGO's first
 * token, with Kerberos's own inside it (RFC 4121 section 4.1), or SPNEGO's answer.
 */
export function decodeNegotiate(base64: string): Record<string, unknown> {
	const bytes = Buffer.from(base64, 'base64');
	const { element } = read(bytes);
	if (element.tag === 0x60) {
		// [APPLICATION 0]: SPNEGO's OID, then its first token.
		const [, init] = children(element);
		const parts = fields(init);
		const token = parts.get(2)?.content;
		let mechToken: unknown;
		if (token) {
			// Kerberos's own token: its OID, two bytes saying an AP-REQ follows, and the AP-REQ.
			const inner = read(token).element;
			const { next } = read(inner.content);
			mechToken = decodeKerberos(inner.content.subarray(next + 2));
		}
		return {
			negTokenInit: {
				mechTypes: children(parts.get(0)!).map(mechanism),
				...(mechToken ? { mechToken } : {})
			}
		};
	}
	if (element.tag === 0xa1) {
		const parts = fields(element);
		const state = parts.get(0);
		const supported = parts.get(1);
		const response = parts.get(2);
		return {
			negTokenResp: {
				...(state ? { negState: NEG_STATES[integer(state)] ?? String(integer(state)) } : {}),
				...(supported ? { supportedMech: mechanism(supported) } : {}),
				...(response ? { responseToken: response.content.toString('base64') } : {})
			}
		};
	}
	throw new Error(`Not a Negotiate token: tag ${element.tag}`);
}
