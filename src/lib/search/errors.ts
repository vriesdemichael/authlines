import type { Settings } from '#lib/flow/settings.ts';

/**
 * What a real server said, and the state that shows it. Someone with an error on their screen can
 * paste it and land on the step where it happens. A test holds these to what the recordings and
 * questions.json contain, in both directions, so none of it is made up and none of it is missed.
 */
export interface KnownError {
	text: string;
	means: string;
	step: string;
	settings: Partial<Settings>;
	/** The base flow it is on, where that is not the one with a login. */
	flow?: string;
}

const stolenFromPublicWithPkce: Partial<Settings> = {
	attacker: true,
	clientType: 'public',
	pkce: true
};
const dpopPublic: Partial<Settings> = { binding: 'dpop', clientType: 'public' };
const storedV1: Partial<Settings> = { broker: true, upstreamTokens: 'v1' };
const storedV2: Partial<Settings> = { broker: true, upstreamTokens: 'v2' };

export const knownErrors: readonly KnownError[] = [
	{
		text: 'Session not active',
		means:
			'The session this refresh token belonged to is over, for example because someone logged out.',
		step: 'refresh-after-logout-response',
		settings: { oidc: true, logout: true }
	},
	{
		text: 'login_required',
		means:
			'The app said not to show a form, and the user would have to log in, usually because this browser has no session.',
		step: 'second-redirect-with-code',
		settings: { sso: true, oidc: true, ssoAsks: 'fresh' }
	},
	{
		text: 'Maximum allowed refresh token reuse exceeded',
		means:
			'A refresh token that had already been used was sent again, and the server allows that no more.',
		step: 'refresh-again-response',
		settings: { refresh: true, reuse: 'ends' }
	},
	{
		text: "Session doesn't have required client",
		means:
			'A refresh token was used twice, which ended the session for this app, so even the newest one stops working.',
		step: 'refresh-newest-response',
		settings: { refresh: true, reuse: 'ends' }
	},
	{
		text: 'Invalid parameter: redirect_uri',
		means: 'The address the app sent is not one registered for this client.',
		step: 'authorize',
		settings: {}
	},
	{
		text: 'invalid_grant',
		means:
			'The code cannot be used this way: it has been used, or its verifier is wrong or missing.',
		step: 'real-app-refused',
		settings: stolenFromPublicWithPkce
	},
	{
		text: 'Code not valid',
		means: 'A code works once, and this one has been used already.',
		step: 'real-app-refused',
		settings: stolenFromPublicWithPkce
	},
	{
		text: 'PKCE code verifier not specified',
		means: 'The login sent a challenge, and this request came without the verifier.',
		step: 'attacker-token-response',
		settings: stolenFromPublicWithPkce
	},
	{
		text: 'PKCE verification failed: Code mismatch',
		means: 'The verifier sent does not match the challenge from the login.',
		step: 'handed-token-response',
		settings: { attacker: true, attackerUses: 'real-app', pkce: true }
	},
	{
		text: 'unauthorized_client',
		means:
			'This client is not allowed to do this. With no user, that usually means it was not set up to act for itself.',
		step: 'service-token-request',
		settings: {},
		flow: 'client-credentials'
	},
	{
		text: 'unauthorized_client',
		means: 'The client did not prove who it is. The spec calls this invalid_client.',
		step: 'attacker-token-response',
		settings: { attacker: true }
	},
	{
		text: 'invalid_client',
		means:
			'The client did not prove who it is, which is what the spec calls this. The server recorded here says unauthorized_client on this step.',
		step: 'attacker-token-response',
		settings: { attacker: true }
	},
	{
		text: 'Invalid client or Invalid client credentials',
		means: 'The client did not prove who it is, usually a missing or wrong secret.',
		step: 'attacker-token-response',
		settings: { attacker: true }
	},
	{
		text: 'Missing parameter: code_challenge_method',
		means: 'This client requires PKCE, and the login came without a challenge.',
		step: 'authorize',
		settings: {}
	},
	{
		text: 'access_denied',
		means: 'The user said no when asked.',
		step: 'consent-page',
		settings: { consent: true }
	},
	{
		text: 'invalid_request',
		means: 'Something this request needs is missing or wrong. With DPoP, usually the proof.',
		step: 'token-request',
		settings: dpopPublic
	},
	{
		text: 'DPoP Proof missing',
		means: 'The login named a key with dpop_jkt, and this request came with no proof.',
		step: 'token-request',
		settings: dpopPublic
	},
	{
		text: 'DPoP Proof public key thumbprint does not match dpop_jkt',
		means: 'The login named one key, and this proof was signed with another.',
		step: 'token-request',
		settings: dpopPublic
	},
	{
		text: 'DPoP proof is missing',
		means: 'This client requires a proof, and this request came without one.',
		step: 'token-request',
		settings: dpopPublic
	},
	{
		text: 'does not support this operation',
		means: 'The identity provider is not storing the tokens from the other provider.',
		step: 'retrieve-upstream-token',
		settings: storedV1
	},
	{
		text: 'not authorized to retrieve tokens from identity provider',
		means: "The user's access token does not have the role that reads stored tokens.",
		step: 'retrieve-upstream-token',
		settings: storedV1
	},
	{
		text: 'Client not allowed to retrieve token for the provider',
		means: 'This client has not been allowed to ask for stored tokens.',
		step: 'retrieve-upstream-token',
		settings: storedV2
	},
	{
		text: 'Identity Brokering API feature not enabled',
		means: 'Turning on API V2 turns off API V1, so this server does not offer the older one.',
		step: 'retrieve-upstream-token',
		settings: storedV2
	}
];

/** What people ask about that is not here yet, which should be said rather than guessed around. */
export const notHereYet: readonly string[] = [
	// Each takes something the diagrams do not have: see section 7 of the premise.
	'pkce downgrade',
	'downgrade attack',
	'native app',
	'custom scheme',
	'custom url scheme',
	'claimed https',
	'malicious app',
	'rfc 8252',
	'rfc8252',
	'device flow',
	'device code',
	'saml',
	'token exchange'
];
