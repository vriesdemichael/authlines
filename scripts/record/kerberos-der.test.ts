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
