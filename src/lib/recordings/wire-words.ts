import type { KeyCite, KeyWhy } from '#lib/recordings/key-why.ts';

// What the names in HTTP traffic mean, for the raw view to say when someone points at one (the
// maintainer, 2026-11-09: "The mouseover addition is amazing, can we do that in more places?").

const rfc = (number: number, section: string): KeyCite => ({ rfc: number, section });
const spec = (title: string, url: string): KeyCite => ({ title, url });
const OIDC_CORE = spec(
	'OpenID Connect Core 1.0',
	'https://openid.net/specs/openid-connect-core-1_0.html'
);
const OIDC_LOGOUT = spec(
	'OpenID Connect RP-Initiated Logout 1.0',
	'https://openid.net/specs/openid-connect-rpinitiated-1_0.html'
);
const OIDC_BACKCHANNEL = spec(
	'OpenID Connect Back-Channel Logout 1.0',
	'https://openid.net/specs/openid-connect-backchannel-1_0.html'
);
const OIDC_FRONTCHANNEL = spec(
	'OpenID Connect Front-Channel Logout 1.0',
	'https://openid.net/specs/openid-connect-frontchannel-1_0.html'
);
const OIDC_SESSION = spec(
	'OpenID Connect Session Management 1.0',
	'https://openid.net/specs/openid-connect-session-1_0.html'
);
const WEBAUTHN = spec('Web Authentication, Level 3', 'https://www.w3.org/TR/webauthn-3/');
const OIDC_DISCOVERY = spec(
	'OpenID Connect Discovery 1.0',
	'https://openid.net/specs/openid-connect-discovery-1_0.html'
);

/** What a server keeps its own pages going with, which no spec says, said once for all of it. */
const ITS_OWN: KeyWhy = {
	says: 'The identity provider’s own, for keeping its pages and forms going. It is not part of OAuth, and another server would send something else.'
};
const ITS_OWN_SETTING: KeyWhy = {
	says: 'One of the identity provider’s own settings for this app. It is not part of a spec.'
};
const ITS_OWN_ADMIN: KeyWhy = {
	says: 'Part of the identity provider’s own admin API, which is not part of OAuth.'
};
const ITS_OWN_CLAIM: KeyWhy = {
	says: 'The identity provider’s own. Another one would send others, or none.'
};
const THE_DEMO: KeyWhy = {
	says: 'Made up by the demo app or API this was recorded with, so it is not part of any spec.'
};

/** Headers, which mean the same whatever the message. */
export const HEADERS: Readonly<Record<string, KeyWhy>> = {
	'content-type': {
		says: 'What kind of data the body is, such as JSON or a form.',
		cite: rfc(9110, '8.3')
	},
	location: {
		says: 'Where to go next. With a redirect, such as 302 or 303, the browser goes there by itself.',
		cite: rfc(9110, '10.2.2')
	},
	'set-cookie': {
		says: 'A cookie for the browser to keep and send back to this site by itself, with how long and to which addresses.',
		cite: rfc(6265, '4.1')
	},
	cookie: {
		says: 'The cookies the browser kept for this site, which it sends back by itself.',
		cite: rfc(6265, '4.2')
	},
	authorization: {
		says: 'What lets the one asking in: here a token, or an app’s ID and secret.',
		cite: rfc(9110, '11.6.2')
	},
	'www-authenticate': {
		says: 'Sent with a refusal: what the server wants instead, and with a token, why this one was not enough.',
		cite: rfc(6750, '3')
	},
	accept: { says: 'What kinds of answer the one asking can read.', cite: rfc(9110, '12.5.1') },
	origin: {
		says: 'Which site the page that sent this came from. The browser adds it by itself.',
		cite: rfc(6454, '7')
	},
	'access-control-allow-origin': {
		says: 'Which site’s pages the browser may let read this answer, which is how a page on one site may call another.',
		cite: spec('Fetch Standard', 'https://fetch.spec.whatwg.org/#http-cors-protocol')
	},
	dpop: {
		says: 'A proof signed with the app’s own key and made for this one request, so a token tied to that key is no use without it.',
		cite: rfc(9449, '4')
	}
};

/** The header of a signed token, before its claims. */
export const JOSE: Readonly<Record<string, KeyWhy>> = {
	alg: { says: 'Which algorithm signed it, such as RS256.', cite: rfc(7515, '4.1.1') },
	typ: { says: 'What kind of token it says it is.', cite: rfc(7515, '4.1.9') },
	kid: {
		says: 'Which of the signer’s keys signed it, to find among the keys it publishes.',
		cite: rfc(7515, '4.1.4')
	},
	jwk: {
		says: 'The public key itself, to check this proof with. In DPoP, the key the token gets tied to.',
		cite: rfc(9449, '4.2')
	}
};

/** Claims the picture of a token has no row for, because they are not in its two tokens. */
export const CLAIMS: Readonly<Record<string, KeyWhy>> = {
	groups: { says: 'Which groups the user is in.', cite: rfc(9068, '2.2.3.1') },
	roles: { says: 'The names of the roles, inside the identity provider’s own claims for them.' },
	account: {
		says: 'The account service, one of the identity provider’s own clients, with the roles the user has there.'
	},
	cnf: {
		says: 'The key the token is tied to, as a thumbprint, so only whoever holds that key can use it.',
		cite: rfc(9449, '6')
	},
	htm: { says: 'The method of the one request this proof is for.', cite: rfc(9449, '4.2') },
	htu: { says: 'The address of the one request this proof is for.', cite: rfc(9449, '4.2') },
	ath: {
		says: 'A hash of the access token sent with this proof, so the proof cannot go with another.',
		cite: rfc(9449, '4.2')
	},
	events: {
		says: 'What this token is about: here, that the user logged out.',
		cite: OIDC_BACKCHANNEL
	},
	'http://schemas.openid.net/event/backchannel-logout': {
		says: 'The event this is: a logout, which says nothing more about itself.',
		cite: OIDC_BACKCHANNEL
	},
	jkt: {
		says: 'The thumbprint of the key the token is tied to.',
		cite: rfc(9449, '6.1')
	},
	'kc-jkt-type': ITS_OWN_CLAIM,
	broker: ITS_OWN_CLAIM,
	organization: ITS_OWN_CLAIM,
	state_checker: ITS_OWN_CLAIM,
	aud_x: ITS_OWN_CLAIM,
	prov: ITS_OWN_CLAIM,
	reuse_id: ITS_OWN_CLAIM,
	'req-aud': ITS_OWN_CLAIM,
	registration_auth: ITS_OWN_CLAIM
};

/** Names in a request or an answer that the site has no word on elsewhere. */
export const WIRE: Readonly<Record<string, KeyWhy>> = {
	// The key set, at jwks_uri.
	kty: { says: 'What kind of key: RSA, or an elliptic curve.', cite: rfc(7517, '4.1') },
	use: {
		says: 'What the key is for: sig to check signatures with, enc to encrypt.',
		cite: rfc(7517, '4.2')
	},
	alg: { says: 'Which algorithm the key is used with.', cite: rfc(7517, '4.4') },
	kid: {
		says: 'The key’s name, which a token’s header gives to say this key signed it.',
		cite: rfc(7517, '4.5')
	},
	n: {
		says: 'Part of an RSA public key: a very long number, the modulus.',
		cite: rfc(7518, '6.3.1.1')
	},
	e: {
		says: 'The other part of an RSA public key, the exponent. Almost always AQAB, which is 65537.',
		cite: rfc(7518, '6.3.1.2')
	},
	crv: {
		says: 'Which elliptic curve the key is on, such as P-256.',
		cite: rfc(7518, '6.2.1.1')
	},
	x: {
		says: 'Part of an elliptic-curve public key: the x of a point.',
		cite: rfc(7518, '6.2.1.2')
	},
	y: { says: 'The other part: the y of that point.', cite: rfc(7518, '6.2.1.3') },
	x5c: { says: 'The certificate the key is in.', cite: rfc(7517, '4.7') },
	x5t: { says: 'A fingerprint of that certificate, by SHA-1.', cite: rfc(7517, '4.8') },
	'x5t#S256': { says: 'A fingerprint of that certificate, by SHA-256.', cite: rfc(7517, '4.9') },
	// Asking for a login, and logging out.
	code_challenge_method: {
		says: 'How the challenge was made from the verifier. S256 is a one-way hash.',
		cite: rfc(7636, '4.3')
	},
	code_verifier: {
		says: 'The secret the challenge was made from, which only the app has, so only it can trade the code.',
		cite: rfc(7636, '4.5')
	},
	login_hint: {
		says: 'Who is about to log in, so the form can be filled in for them.',
		cite: OIDC_CORE
	},
	prompt: {
		says: 'Whether to make the user log in or agree again, or show nothing at all.',
		cite: OIDC_CORE
	},
	id_token_hint: {
		says: 'An ID token from earlier, which says who is logging out.',
		cite: OIDC_LOGOUT
	},
	post_logout_redirect_uri: {
		says: 'Where to send the browser after logging out. It has to be registered.',
		cite: OIDC_LOGOUT
	},
	post_logout_redirect_uris: {
		says: 'Where the browser may be sent after logging out.',
		cite: OIDC_LOGOUT
	},
	session_state: {
		says: 'An ID of the user’s session at the identity provider, for a page to check it is still there.',
		cite: OIDC_SESSION
	},
	dpop_jkt: {
		says: 'The thumbprint of the app’s key, so the code can only be traded with a proof from that key.',
		cite: rfc(9449, '10')
	},
	logout_token: {
		says: 'A signed token that tells the app the user logged out.',
		cite: OIDC_BACKCHANNEL
	},
	// Trading, asking about and giving up a token.
	requested_token_type: {
		says: 'Which kind of token the trade should give back.',
		cite: rfc(8693, '2.1')
	},
	token: { says: 'The token being asked about, or given up.', cite: rfc(7662, '2.1') },
	active: {
		says: 'Whether the token is still good, as the server sees it now.',
		cite: rfc(7662, '2.2')
	},
	error: { says: 'What went wrong, as a code a spec defines.', cite: rfc(6749, '5.2') },
	refresh_expires_in: {
		says: 'How many seconds the refresh token lasts. The identity provider’s own, beside the ones OAuth defines.'
	},
	'not-before-policy': {
		says: 'The identity provider’s own: a time before which every token is refused. 0 means none is.'
	},
	// The device flow.
	device_code: {
		says: 'The long code the app asks with, which only it has.',
		cite: rfc(8628, '3.2')
	},
	user_code: {
		says: 'The short code the user types on the other device.',
		cite: rfc(8628, '3.2')
	},
	verification_uri: { says: 'Where the user goes to type the code.', cite: rfc(8628, '3.2') },
	verification_uri_complete: {
		says: 'The same address with the code already in it, for a link or a code to scan.',
		cite: rfc(8628, '3.2')
	},
	interval: {
		says: 'How many seconds the app should wait between asks.',
		cite: rfc(8628, '3.2')
	},
	device_user_code: { says: 'The user code, as typed on the other device.' },
	// What a person types, or their device signs.
	username: { says: 'The user’s name, as typed in the form.' },
	otp: { says: 'The one-time code, as typed in.' },
	clientDataJSON: {
		says: 'What the browser says was asked for: the challenge and the address of the page, which the device signed.',
		cite: WEBAUTHN
	},
	authenticatorData: {
		says: 'What the device says about itself and this login, which it signed too.',
		cite: WEBAUTHN
	},
	signature: { says: 'The passkey’s signature over all of that.', cite: WEBAUTHN },
	userHandle: {
		says: 'Which user the passkey is for, as the identity provider named them.',
		cite: WEBAUTHN
	},
	credentialId: { says: 'Which saved credential, by its ID.' },
	selectedCredentialId: { says: 'Which saved credential, by its ID.' },
	// An app that registered itself.
	client_secret_expires_at: {
		says: 'When the secret stops working. 0 means it does not.',
		cite: rfc(7591, '3.2.1')
	},
	registration_access_token: {
		says: 'A token for changing or deleting this registration later.',
		cite: rfc(7591, '3.2.1')
	},
	subject_type: {
		says: 'Whether the user’s ID is the same for every app, public, or different for each, pairwise.',
		cite: OIDC_CORE
	},
	dpop_bound_access_tokens: {
		says: 'Whether this app’s tokens have to be tied to a key with DPoP.',
		cite: rfc(9449, '5.2')
	},
	tls_client_certificate_bound_access_tokens: {
		says: 'Whether tokens are tied to the app’s certificate, as mTLS does.',
		cite: rfc(8705, '3.4')
	},
	backchannel_logout_session_required: {
		says: 'Whether a logout message sent to this app has to name the session.',
		cite: OIDC_BACKCHANNEL
	},
	frontchannel_logout_session_required: {
		says: 'Whether a logout through the browser has to name the session.',
		cite: OIDC_FRONTCHANNEL
	},
	backchannel_logout_revoke_offline_tokens: ITS_OWN_SETTING,
	request_uris: ITS_OWN_SETTING,
	require_request_uri_registration: {
		says: 'Whether an app has to register first the addresses it may send a request from.',
		cite: OIDC_DISCOVERY
	},
	require_pushed_authorization_requests: {
		says: 'Whether every login has to be pushed first.',
		cite: rfc(9126, '5')
	},
	mtls_endpoint_aliases: {
		says: 'Other addresses to use with a certificate, as mTLS does.',
		cite: rfc(8705, '5')
	},
	check_session_iframe: {
		says: 'A page an app can load, unseen, to check the user’s session is still there.',
		cite: OIDC_SESSION
	},
	// What the identity provider keeps its own forms going with.
	session_code: ITS_OWN,
	execution: ITS_OWN,
	tab_id: ITS_OWN,
	client_data: ITS_OWN,
	kc_action: ITS_OWN,
	kc_action_status: ITS_OWN,
	continue: ITS_OWN,
	'cancel-aia': ITS_OWN,
	cancel: ITS_OWN,
	accept: ITS_OWN,
	exact: ITS_OWN_ADMIN,
	// What its admin API says about a user or a role.
	id: ITS_OWN_ADMIN,
	firstName: ITS_OWN_ADMIN,
	lastName: ITS_OWN_ADMIN,
	emailVerified: ITS_OWN_ADMIN,
	enabled: ITS_OWN_ADMIN,
	createdTimestamp: ITS_OWN_ADMIN,
	totp: ITS_OWN_ADMIN,
	disableableCredentialTypes: ITS_OWN_ADMIN,
	requiredActions: ITS_OWN_ADMIN,
	notBefore: ITS_OWN_ADMIN,
	access: ITS_OWN_ADMIN,
	manage: ITS_OWN_ADMIN,
	composite: ITS_OWN_ADMIN,
	clientRole: ITS_OWN_ADMIN,
	containerId: ITS_OWN_ADMIN,
	attributes: ITS_OWN_ADMIN,
	// The demo app and API, which the recordings use.
	resource: THE_DEMO,
	loggedIn: THE_DEMO,
	accessTokenExpiration: THE_DEMO
};

/** What discovery says, by the shape of its name, for the many that follow one pattern. */
export function discovered(key: string): KeyWhy | undefined {
	const metadata = rfc(8414, '2');
	if (key.endsWith('_supported')) {
		return {
			says: 'Something the server says it supports, in what it tells an app at discovery, so the app need not guess.',
			cite: metadata
		};
	}
	if (key.endsWith('_endpoint')) {
		return {
			says: 'Where to send one kind of request, as discovery tells an app.',
			cite: metadata
		};
	}
	return undefined;
}
