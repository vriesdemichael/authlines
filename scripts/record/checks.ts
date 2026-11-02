// What the demo app and API check, on their own so a test can try to get past them. A step on the
// diagram says they do this, so a 200 in a recording has to mean they looked.
import { createHash, createPublicKey, verify } from 'node:crypto';

export type Jwk = Record<string, unknown> & { kid?: string };

export const sha256 = (value: string) => createHash('sha256').update(value).digest('base64url');

interface Jwt {
	header: Record<string, unknown>;
	claims: Record<string, unknown>;
	signing: string;
	signature: Buffer;
}

function readJwt(jwt: string): Jwt | null {
	const parts = jwt.split('.');
	if (parts.length !== 3) return null;
	const [header, payload, signature] = parts;
	try {
		const decoded = {
			header: JSON.parse(Buffer.from(header, 'base64url').toString()),
			claims: JSON.parse(Buffer.from(payload, 'base64url').toString()),
			signing: `${header}.${payload}`,
			signature: Buffer.from(signature, 'base64url')
		};
		const isObject = (value: unknown) => typeof value === 'object' && value !== null;
		return isObject(decoded.header) && isObject(decoded.claims) ? decoded : null;
	} catch {
		return null;
	}
}

/** The kind of key has to be the kind the header says, so a signature cannot pass as another kind. */
function signedWith(jwt: Jwt, jwk: Jwk) {
	const data = Buffer.from(jwt.signing);
	try {
		const key = createPublicKey({ key: jwk as never, format: 'jwk' });
		if (jwt.header.alg === 'RS256' && jwk.kty === 'RSA') {
			return verify('sha256', data, key, jwt.signature);
		}
		if (jwt.header.alg === 'ES256' && jwk.kty === 'EC' && jwk.crv === 'P-256') {
			return verify('sha256', data, { key, dsaEncoding: 'ieee-p1363' }, jwt.signature);
		}
		return false;
	} catch {
		return false;
	}
}

/** What identifies a public key, whichever kind it is (RFC 7638). */
function thumbprintOf(jwk: Jwk): string | null {
	if (jwk.kty === 'EC') {
		const { crv, kty, x, y } = jwk;
		return sha256(JSON.stringify({ crv, kty, x, y }));
	}
	if (jwk.kty === 'RSA') {
		const { e, kty, n } = jwk;
		return sha256(JSON.stringify({ e, kty, n }));
	}
	return null;
}

const namesAudience = (claims: Record<string, unknown>, audience: string) =>
	[claims.aud].flat().includes(audience);

const hasExpired = (claims: Record<string, unknown>, now: number) =>
	typeof claims.exp !== 'number' || claims.exp * 1000 <= now;

/** What an app checks before it trusts an ID token (OpenID Connect Core 3.1.3.7). */
export function idTokenProblem(
	idToken: string | undefined,
	expected: { issuer: string; clientId: string; nonce: string | null; keys: readonly Jwk[] },
	now = Date.now()
): string | null {
	const jwt = idToken ? readJwt(idToken) : null;
	if (!jwt) return 'not a token';
	const key = expected.keys.find((candidate) => candidate.kid === jwt.header.kid);
	if (!key) return 'signed with a key the issuer does not list';
	if (!signedWith(jwt, key)) return 'bad signature';
	if (jwt.claims.iss !== expected.issuer) return 'from another issuer';
	if (!namesAudience(jwt.claims, expected.clientId)) return 'not for this app';
	const audiences = [jwt.claims.aud].flat();
	if (audiences.length > 1 && jwt.claims.azp === undefined) return 'for several, and says not whom';
	if (jwt.claims.azp !== undefined && jwt.claims.azp !== expected.clientId) {
		return 'issued to another app';
	}
	if (hasExpired(jwt.claims, now)) return 'expired';
	// A flow that sends none has nothing to compare, and a token claiming one is not from this login.
	if ((jwt.claims.nonce ?? null) !== expected.nonce) return 'from another login';
	return null;
}

/** How far a proof's time may be from this server's, in either direction. */
const PROOF_WINDOW_SECONDS = 60;

/** What whoever receives a DPoP proof checks (RFC 9449 section 4.3). */
export function proofProblem(
	proof: string | undefined,
	expected: {
		method: string;
		url: string;
		token: string;
		thumbprint: string;
		/** The proofs already used here, which this adds to. */
		seen: Set<string>;
	},
	now = Date.now()
): string | null {
	if (!proof) return 'no proof';
	const jwt = readJwt(proof);
	if (!jwt) return 'not a proof';
	const jwk = jwt.header.jwk as Jwk | undefined;
	if (jwt.header.typ !== 'dpop+jwt' || !jwk) return 'not a proof';
	if ('d' in jwk) return 'a private key, sent in the open';
	if (!signedWith(jwt, jwk)) return 'bad proof signature';
	if (thumbprintOf(jwk) !== expected.thumbprint) return 'proof from the wrong key';
	if (jwt.claims.htm !== expected.method) return 'proof for another method';
	if (jwt.claims.htu !== expected.url.split('?')[0]) return 'proof for another address';
	if (typeof jwt.claims.iat !== 'number') return 'proof with no time';
	if (Math.abs(now / 1000 - jwt.claims.iat) > PROOF_WINDOW_SECONDS)
		return 'proof at the wrong time';
	if (jwt.claims.ath !== sha256(expected.token)) return 'proof for another token';
	if (typeof jwt.claims.jti !== 'string' || !jwt.claims.jti) return 'proof with no id';
	const id = jwt.claims.jti;
	if (expected.seen.has(id)) return 'proof used before';
	expected.seen.add(id);
	return null;
}

/** Whether a token that was accepted allows this, which is a separate question (RFC 6750 section 3.1). */
export function scopeProblem(authorization: string | undefined, needed: string): string | null {
	const jwt = readJwt((authorization ?? '').split(' ')[1] ?? '');
	if (!jwt) return 'not a token';
	const scopes = String(jwt.claims.scope ?? '').split(' ');
	return scopes.includes(needed) ? null : `does not allow ${needed}`;
}

export interface Trust {
	issuers: readonly string[];
	/** Who a token has to say it is for. */
	audience: string;
	keysOf: (issuer: string) => Promise<readonly Jwk[]>;
	seenProofs: Set<string>;
}

/**
 * What an API checks before it answers (RFC 9449 section 7.1). Not the token type RFC 9068 asks for,
 * because a default Keycloak's tokens say JWT. Whether the scope covers the request is a separate
 * question with a different answer, which is scopeProblem.
 */
export async function accessTokenProblem(
	request: { authorization?: string; dpop?: string; method: string; url: string },
	trust: Trust,
	now = Date.now()
): Promise<string | null> {
	const [scheme, token] = (request.authorization ?? '').split(' ');
	const jwt = token ? readJwt(token) : null;
	if (!jwt) return 'no token';
	const issuer = String(jwt.claims.iss);
	if (!trust.issuers.includes(issuer)) return 'from an issuer this API does not trust';
	const key = (await trust.keysOf(issuer)).find((candidate) => candidate.kid === jwt.header.kid);
	if (!key) return 'signed with a key the issuer does not list';
	if (!signedWith(jwt, key)) return 'bad signature';
	if (hasExpired(jwt.claims, now)) return 'expired';
	if (typeof jwt.claims.nbf === 'number' && jwt.claims.nbf * 1000 > now) return 'not valid yet';
	if (!namesAudience(jwt.claims, trust.audience)) return 'not for this API';
	// An ID token says this as well, and it is not for an API whatever else it says.
	if (jwt.claims.typ !== undefined && !['Bearer', 'DPoP'].includes(String(jwt.claims.typ))) {
		return 'not an access token';
	}

	const cnf = jwt.claims.cnf as { jkt?: string } | undefined;
	if (cnf && !cnf.jkt) return 'tied to something this API cannot check';
	const bound = cnf?.jkt;
	if (!bound) return scheme === 'Bearer' ? null : 'not a DPoP token';
	if (scheme !== 'DPoP') return 'tied to a key, and sent without it';
	return proofProblem(
		request.dpop,
		{
			method: request.method,
			url: request.url,
			token,
			thumbprint: bound,
			seen: trust.seenProofs
		},
		now
	);
}
