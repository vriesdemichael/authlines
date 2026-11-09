import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Recording } from '#lib/recordings/format.ts';
import { decodeKerberos, decodeNegotiate } from './kerberos-der.ts';
import { PASSWORD } from './keycloak.ts';

const recorded = (preset: string) => {
	const file = `static/recordings/authorization-code/${preset}.json`;
	return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Recording) : null;
};

describe('reading Kerberos off the wire', () => {
	it('reads SPNEGO’s last word, as Keycloak 26.8.1 sent it with its redirect', () => {
		// Seen in a spike on 2026-11-08: done, with Kerberos, and nothing for the browser to check.
		expect(decodeNegotiate('oRQwEqADCgEAoQsGCSqGSIb3EgECAg==')).toEqual({
			negTokenResp: {
				negState: 'accept-completed',
				supportedMech: 'Kerberos 5 (1.2.840.113554.1.2.2)'
			}
		});
	});

	it('refuses what is not Kerberos', () => {
		expect(() => decodeKerberos(Buffer.from('3000', 'hex'))).toThrow(/Not a Kerberos message/);
	});

	for (const preset of ['kerberos', 'kerberos-no-ticket']) {
		const recording = recorded(preset);
		it.skipIf(!recording)(`${preset}: each message is what its bytes say`, () => {
			const kerberos = recording!.messages.filter((m) => m.protocol === 'kerberos');
			expect(kerberos.length).toBeGreaterThan(0);
			for (const message of kerberos) {
				const bytes = Buffer.from(message.bytes ?? '', 'base64');
				expect(decodeKerberos(bytes)).toEqual(message.body);
				expect(bytes.includes(PASSWORD)).toBe(false);
			}
		});
	}

	// Read by hand with openssl asn1parse, so that this does not only hold the reader to itself.
	it.skipIf(!recorded('kerberos'))('reads what openssl reads in the same bytes', () => {
		const body = (step: string) =>
			recorded('kerberos')!.messages.find((message) => message.step === step)!.body as Record<
				string,
				unknown
			>;
		expect(body('computer-asks')).toMatchObject({
			'msg-type': 'AS-REQ (10)',
			// 00 00 00 10: bit 27 alone.
			'kdc-options': ['renewable-ok']
		});
		expect(body('kdc-wants-proof')).toMatchObject({
			'msg-type': 'KRB-ERROR (30)',
			// 0x19
			'error-code': 'KDC_ERR_PREAUTH_REQUIRED (25)',
			crealm: 'EXAMPLE.TEST'
		});
		expect(body('ask-for-service-ticket')).toMatchObject({
			'msg-type': 'TGS-REQ (12)',
			// 00 01 00 00: bit 15 alone.
			'kdc-options': ['canonicalize']
		});
	});

	// One AS-REQ as recorded on 2026-11-09, kept here because a new run has a new nonce and time.
	// Every value below is what openssl asn1parse read in these bytes.
	it('reads what openssl reads in one AS-REQ, value for value', () => {
		const asReq = Buffer.from(
			'aoG2MIGzoQMCAQWiAwIBCqMaMBgwCqEEAgIAlqICBAAwCqEEAgIAlaICBACkgYowgYegBwMFAAAAABChEjAQoAMCAQGhCTAHGwVhbGljZaIOGwxFWEFNUExFLlRFU1SjITAfoAMCAQKhGDAWGwZrcmJ0Z3QbDEVYQU1QTEUuVEVTVKURGA8yMDI2MTExMDA3MjI0M1qnBgIEfsCJfagaMBgCARICARECARQCARMCARACARcCARkCARo=',
			'base64'
		);
		expect(decodeKerberos(asReq)).toEqual({
			// appl [10], pvno 05, msg-type 0A
			'msg-type': 'AS-REQ (10)',
			// INTEGER 96 and 95, each with an empty OCTET STRING
			padata: [
				{ 'padata-type': 'PA-AS-FRESHNESS (150)' },
				{ 'padata-type': 'PA-REQ-ENC-PA-REP (149)' }
			],
			// 00 00 00 00 10: no unused bits, and bit 27 alone
			'kdc-options': ['renewable-ok'],
			// name-type 01 and one GENERALSTRING
			cname: 'alice',
			realm: 'EXAMPLE.TEST',
			// name-type 02 and two GENERALSTRINGs
			sname: 'krbtgt/EXAMPLE.TEST',
			// GENERALIZEDTIME 20261110072243Z
			till: '2026-11-10T07:22:43Z',
			// INTEGER 7EC0897D
			nonce: 2126547325,
			// INTEGERs 12, 11, 14, 13, 10, 17, 19, 1A
			etype: [
				'aes256-cts-hmac-sha1-96 (18)',
				'aes128-cts-hmac-sha1-96 (17)',
				'aes256-cts-hmac-sha384-192 (20)',
				'aes128-cts-hmac-sha256-128 (19)',
				'des3-cbc-sha1 (16)',
				'arcfour-hmac (23)',
				'camellia128-cts-cmac (25)',
				'camellia256-cts-cmac (26)'
			]
		});
	});

	it('refuses a length whose bytes run past the message', () => {
		expect(() => decodeKerberos(Buffer.from('6a84ff', 'hex'))).toThrow(/runs past/);
		expect(() => decodeKerberos(Buffer.from('6a', 'hex'))).toThrow(/runs past/);
	});

	it.skipIf(!recorded('kerberos'))(
		'the ticket the browser sends is the one the KDC gave it, sealed for the identity provider',
		() => {
			const { messages } = recorded('kerberos')!;
			const given = messages.find(({ step }) => step === 'kdc-gives-service-ticket')!;
			const sent = messages.find(({ step }) => step === 'send-ticket')!;
			const token = decodeNegotiate(sent.headers.authorization.replace(/^Negotiate /, ''));
			const apReq = (token.negTokenInit as { mechToken: { ticket: unknown } }).mechToken;
			expect(apReq.ticket).toEqual((given.body as { ticket: unknown }).ticket);
			expect((apReq.ticket as { sname: string }).sname).toBe('HTTP/localhost');
		}
	);
});
