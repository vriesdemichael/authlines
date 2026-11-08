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
	/** The question that says what it means straight away, where the step alone would not. */
	question?: string;
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
	// The admin API refusing an app with no user a role nobody let it give (#183).
	{
		text: 'HTTP 403 Forbidden',
		means:
			'The identity provider’s admin API refused: the app the token was given to was not let do this, such as give a role nobody allowed it.',
		step: 'service-role-refused',
		settings: { givesRole: true },
		flow: 'client-credentials'
	},
	{
		text: 'public clients not allowed',
		means:
			'A client with no secret asked for a stored upstream token with API V2, which takes a client that proves who it is.',
		step: 'api-retrieve-upstream-token',
		settings: {
			broker: true,
			upstreamTokens: 'v2',
			upstreamReader: 'api',
			clientType: 'public',
			pkce: true
		}
	},
	{
		text: 'requested_token_type unsupported',
		means:
			'A trade asked for a kind of token the identity provider will not give from a trade. Here that was a refresh token, which the server recorded gives only when set to.',
		step: 'exchange-request',
		settings: { exchange: true, exchangeGives: 'refresh' }
	},
	{
		text: "Token client and authorized client don't match",
		means:
			'A refresh token was sent by a client it was not issued to, such as the app sending the one a trade gave the API.',
		step: 'trade-refresh-request',
		settings: { exchange: true, exchangeGives: 'refresh' }
	},
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
		step: 'address-refused',
		settings: { address: 'other' }
	},
	{
		text: 'invalid_grant',
		means:
			'The code or refresh token will not do. It may have expired, been used, or been issued to another client or address, or the verifier may be wrong or missing.',
		step: 'real-app-refused',
		settings: stolenFromPublicWithPkce
	},
	{
		text: 'Code not valid',
		means:
			'A code works once, so this one has usually been used already. It is shown here on someone else’s stolen code, because that is where a real server said it.',
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
		text: 'authorization_pending',
		means:
			'It is not a failure: the user has not finished yet, so wait as long as the interval said and ask again.',
		step: 'device-pending',
		settings: {},
		flow: 'device',
		question: 'device-pending-error'
	},
	{
		text: 'The authorization request is still pending',
		means:
			'It is not a failure: the user has not finished yet, so wait as long as the interval said and ask again.',
		step: 'device-pending',
		settings: {},
		flow: 'device',
		question: 'device-pending-error'
	},
	{
		text: 'slow_down',
		means: 'The app asked again too soon. It has to wait 5 seconds longer from then on.',
		step: 'device-pending',
		settings: {},
		flow: 'device',
		question: 'device-pending-error'
	},
	{
		text: 'expired_token',
		means: 'The codes ran out before the user finished. Trying again takes new ones.',
		step: 'device-expired-response',
		settings: { deviceEnds: 'runs-out' },
		flow: 'device',
		question: 'device-ran-out'
	},
	{
		text: 'Device code is expired',
		means: 'The codes ran out before the user finished. Trying again takes new ones.',
		step: 'device-expired-response',
		settings: { deviceEnds: 'runs-out' },
		flow: 'device',
		question: 'device-ran-out'
	},
	{
		text: 'The end user denied the authorization request',
		means: 'The user said no on the other device, so the app stops asking.',
		step: 'device-denied-response',
		settings: { deviceEnds: 'says-no' },
		flow: 'device',
		question: 'device-no-answer'
	},
	{
		text: 'Device code not valid',
		means:
			'The server will not take this device code. One that has already got its tokens gets this, because it works once, and so does one it never gave out.',
		step: 'device-token-response',
		settings: {},
		flow: 'device'
	},
	{
		text: 'Invalid code, please try again.',
		means: 'What the page says to someone who typed a code it does not know, or one already used.',
		step: 'device-submit-code',
		settings: {},
		flow: 'device'
	},
	{
		text: 'The code has expired.',
		means: 'What the page says to someone who took too long. The app has to start again.',
		step: 'device-submit-code',
		settings: {},
		flow: 'device'
	},
	{
		text: 'Client is not allowed to initiate OAuth 2.0 Device Authorization Grant',
		means: 'This client has not been allowed to use this flow, which is off on a new client.',
		step: 'device-request',
		settings: {},
		flow: 'device'
	},
	{
		text: 'invalid_grant',
		means:
			'On the device flow, this device code will not do: it has been used, it was never given out, or this is another client.',
		step: 'device-token-response',
		settings: {},
		flow: 'device'
	},
	{
		text: 'unauthorized_client',
		means:
			'This client is not allowed to do this, or on this server, it did not prove who it is. With no user, it may not be set up to act for itself, or the secret is wrong or missing. The description says which.',
		step: 'service-token-request',
		settings: {},
		flow: 'client-credentials'
	},
	{
		text: 'unauthorized_client',
		means:
			'The client did not prove who it is. The spec calls this invalid_client. It is shown here on someone else’s stolen code, because that is where a real server said it.',
		step: 'attacker-token-response',
		settings: { attacker: true }
	},
	{
		text: 'unauthorized_client',
		means:
			'On the device flow, this flow may be off for this client, or the client has a secret and did not send it.',
		step: 'device-request',
		settings: {},
		flow: 'device'
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
		means:
			'The client did not prove who it is, usually a missing or wrong secret. It is shown here on someone else’s stolen code, because that is where a real server said it.',
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
		means: 'Usually the user said no when asked. The spec lets the server refuse this way too.',
		step: 'consent-page',
		settings: { consent: true }
	},
	{
		text: 'access_denied',
		means: 'The user said no on the other device, so the app stops asking.',
		step: 'device-denied-response',
		settings: { deviceEnds: 'says-no' },
		flow: 'device',
		question: 'device-no-answer'
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
		means: 'This client has not been allowed to ask for stored tokens, or not for this provider.',
		// Where a recording has it: an API that is not allowed this provider (#180).
		step: 'api-upstream-refused',
		settings: {
			...storedV2,
			upstreamReader: 'refused',
			clientType: 'public',
			pkce: true
		}
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
	// A program on the user's computer is drawn (#178), and an app on a phone is not.
	'mobile app',
	'phone app',
	'custom scheme',
	'custom url scheme',
	'claimed https',
	'malicious app',
	// What #147 lists, which has no flow yet. Nothing here may have a result, or it would hide it.
	// A passkey and a one-time password are explained, with what each proves, and a login with one
	// is drawn since 2026-11-08. So is an API key, against tokens, and calling an API with one is not.
	'kerberos',
	'spnego',
	'ntlm',
	'fido2',
	'magic link',
	'sms code',
	'client certificate',
	'smart card',
	'ssh key',
	'ws-federation',
	'radius',
	'tacacs',
	'802.1x',
	'api key auth',
	'sigv4',
	'message signatures',
	'spiffe',
	'scram',
	'oauth 1',
	'digest auth'
];
