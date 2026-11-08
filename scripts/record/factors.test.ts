import { describe, expect, it } from 'vitest';
import { codeAt } from './factors.ts';

// The test values in RFC 6238 appendix B, for HMAC-SHA1 with the secret "12345678901234567890".
describe('a code from an authenticator app', () => {
	const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
	it.each([
		[59, '94287082'],
		[1111111109, '07081804'],
		[1234567890, '89005924'],
		[20000000000, '65353130']
	])('is what RFC 6238 says at %s seconds', (seconds, expected) => {
		expect(codeAt(secret, seconds, 8)).toBe(expected);
	});
});
