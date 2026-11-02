export type SourceId =
	| 'rfc6749'
	| 'rfc6750'
	| 'rfc7617'
	| 'rfc7636'
	| 'rfc9449'
	| 'rfc9207'
	| 'rfc8628'
	| 'rfc9700'
	| 'rfc10017'
	| 'oidc-core'
	| 'oidc-rp-logout'
	| 'oidc-backchannel-logout'
	| 'keycloak-brokering'
	| 'keycloak-stored-tokens'
	| 'keycloak-concepts';

export interface SourceDef {
	label: string;
	title: string;
	status: string;
	/** In our own words. A source's own text stays with its authors (ADR-009). */
	summary: string;
	url: string;
	/** Names a file in static/rfc. Only an RFC's text is shown here, and always in full (ADR-009). */
	textFile?: string;
}

/** A setting pointing at a source, and what the source means for that setting. */
export interface SourceRef {
	source: SourceId;
	section?: string;
	why: string;
}

/** Summaries checked against each document on 2026-10-31, and the logout ones on 2026-11-01. */
export const sources: Record<SourceId, SourceDef> = {
	rfc6749: {
		label: 'RFC 6749',
		title: 'The OAuth 2.0 Authorization Framework',
		status: 'Proposed Standard, October 2012. Updated by RFC 8252, RFC 8996 and RFC 9700.',
		summary:
			'The core of OAuth 2.0. It lets an app get limited access to an HTTP service, either on behalf of a user who approved it or on its own behalf. It defines the roles, the authorization and token endpoints, the ways to get a token, and the two client types. Later RFCs update it, so it is not the last word on security.',
		url: 'https://www.rfc-editor.org/rfc/rfc6749.html',
		textFile: 'rfc6749.txt'
	},
	rfc7617: {
		label: 'RFC 7617',
		title: "The 'Basic' HTTP Authentication Scheme",
		status: 'Proposed Standard, September 2015.',
		summary:
			'A way to send a username and password with an HTTP request, joined with a colon and Base64-encoded. Base64 is not encryption, so it calls this cleartext, and says not to protect anything sensitive with it without something like HTTPS.',
		url: 'https://www.rfc-editor.org/rfc/rfc7617.html',
		textFile: 'rfc7617.txt'
	},
	rfc6750: {
		label: 'RFC 6750',
		title: 'The OAuth 2.0 Authorization Framework: Bearer Token Usage',
		status: 'Proposed Standard, October 2012. Updated by RFC 8996 and RFC 9700.',
		summary:
			'How to send a bearer token with a request, and what the server answers when the token is missing or not good enough. Whoever holds a bearer token can use it, with no key to prove, so it has to be protected in storage and on the way.',
		url: 'https://www.rfc-editor.org/rfc/rfc6750.html',
		textFile: 'rfc6750.txt'
	},
	rfc7636: {
		label: 'RFC 7636',
		title: 'Proof Key for Code Exchange by OAuth Public Clients',
		status: 'Proposed Standard, September 2015.',
		summary:
			'Protects the authorization code. For each login the app makes up a random value and sends a hash of it with the authorization request. It sends the value itself when it trades the code, and the server checks that the two match, so someone who intercepted the code cannot use it. It was written for public clients, such as apps on a phone, where another app can get at the code on its way.',
		url: 'https://www.rfc-editor.org/rfc/rfc7636.html',
		textFile: 'rfc7636.txt'
	},
	rfc9449: {
		label: 'RFC 9449',
		title: 'OAuth 2.0 Demonstrating Proof of Possession (DPoP)',
		status: 'Proposed Standard, September 2023.',
		summary:
			'Ties a token to a key. The app proves it holds a private key by sending a signed JWT in a DPoP header, and the server binds the tokens it issues to the matching public key. The aim is that a leaked or stolen token cannot be used without the key. It works at the application level, so it also suits apps in a browser, where binding through TLS does not work.',
		url: 'https://www.rfc-editor.org/rfc/rfc9449.html',
		textFile: 'rfc9449.txt'
	},
	rfc9207: {
		label: 'RFC 9207',
		title: 'OAuth 2.0 Authorization Server Issuer Identification',
		status: 'Proposed Standard, March 2022.',
		summary:
			'Adds iss to the answer that comes back through the browser, naming the server that sent it. An app that uses more than one server can check that against the one it sent the user to, which counters mix-up attacks.',
		url: 'https://www.rfc-editor.org/rfc/rfc9207.html'
	},
	rfc8628: {
		label: 'RFC 8628',
		title: 'OAuth 2.0 Device Authorization Grant',
		status: 'Proposed Standard, August 2019.',
		summary:
			'For apps on devices with no good way to log anyone in, such as a TV. The app gets a short code to show and a long one to keep, the user enters the short one in a browser on another device, and the app keeps asking with the long one until they are done. It also lists the attacks this makes possible, such as someone sending you their code.',
		url: 'https://www.rfc-editor.org/rfc/rfc8628.html',
		textFile: 'rfc8628.txt'
	},
	rfc9700: {
		label: 'RFC 9700',
		title: 'Best Current Practice for OAuth 2.0 Security',
		status: 'Best Current Practice, January 2025. Updates RFC 6749, RFC 6750 and RFC 6819.',
		summary:
			'The current security advice for OAuth 2.0, written with what has gone wrong since OAuth was published. It describes the attacks and says what clients and servers have to do about them: for example PKCE to protect the code, exact matching of redirect addresses, and no more implicit or password grants.',
		url: 'https://www.rfc-editor.org/rfc/rfc9700.html',
		textFile: 'rfc9700.txt'
	},
	rfc10017: {
		label: 'RFC 10017',
		title: 'OAuth 2.0 for Browser-Based Applications',
		status: 'Best Current Practice (BCP 212), August 2026.',
		summary:
			'What an app in the browser has to do, and what it cannot get away from. It goes through what a script running in the page can do, compares a backend that keeps the tokens, one that hands them over, and an app that keeps them itself, and says what each place in the browser does and does not protect.',
		url: 'https://www.rfc-editor.org/rfc/rfc10017.html',
		textFile: 'rfc10017.txt'
	},
	'oidc-core': {
		label: 'OpenID Connect Core 1.0',
		title: 'OpenID Connect Core 1.0',
		status: 'Final specification, with errata set 2 from December 2023. OpenID Foundation.',
		summary:
			'An identity layer on top of OAuth 2.0. It lets an app verify who logged in, based on the login at the authorization server, and get basic profile information about them. It adds the ID token and the UserInfo endpoint.',
		url: 'https://openid.net/specs/openid-connect-core-1_0.html'
	},
	'oidc-rp-logout': {
		label: 'RP-Initiated Logout 1.0',
		title: 'OpenID Connect RP-Initiated Logout 1.0',
		status: 'Final specification, September 2022. OpenID Foundation.',
		summary:
			'How an app asks the identity provider to log a user out, by sending the browser to its end session address. The ID token that says who is logging out is recommended, and without one the server has to ask the user. It only sends the browser back to an address registered exactly. It says nothing about access or refresh tokens.',
		url: 'https://openid.net/specs/openid-connect-rpinitiated-1_0.html'
	},
	'oidc-backchannel-logout': {
		label: 'Back-Channel Logout 1.0',
		title: 'OpenID Connect Back-Channel Logout 1.0, with errata set 1',
		status: 'Final specification, December 2023. OpenID Foundation.',
		summary:
			'How an identity provider tells an app directly that a session has ended, with a signed logout token and no browser involved. The app clears what it holds for that session and answers 200. Refresh tokens from that session should go, unless they are for offline access, and access tokens are not mentioned.',
		url: 'https://openid.net/specs/openid-connect-backchannel-1_0.html'
	},
	'keycloak-brokering': {
		label: 'Keycloak docs: identity brokering',
		title: 'Integrating identity providers',
		status: 'Keycloak 26.8.1, Server Administration Guide.',
		summary:
			'Keycloak as a go-between: it connects the apps that use it to other identity providers, so users can log in with an identity from elsewhere. Those providers are configured in Keycloak.',
		url: 'https://www.keycloak.org/docs/26.8.1/server_admin/#_identity_broker'
	},
	'keycloak-stored-tokens': {
		label: 'Keycloak docs: stored tokens',
		title: 'Retrieving external IDP tokens',
		status: 'Keycloak 26.8.1, Server Developer Guide.',
		summary:
			'How an app gets the tokens Keycloak stored from an external identity provider. There are two versions. V1 is deprecated and still on by default, and V2 is the one to migrate to.',
		url: 'https://www.keycloak.org/docs/26.8.1/server_development/#_identity-brokering-apis-tokens'
	},
	'keycloak-concepts': {
		label: 'Keycloak docs: core concepts',
		title: 'Core concepts and terms',
		status: 'Keycloak 26.8.1, Server Administration Guide.',
		summary:
			'What Keycloak calls things. A realm holds a set of users and what goes with them, and users log in to a realm. A client is anything that can ask Keycloak to authenticate a user, usually an application. An identity provider is any service that can authenticate a user, which it says Keycloak is, while its console uses the word for the outside ones it can hand off to.',
		url: 'https://www.keycloak.org/docs/26.8.1/server_admin/#core-concepts-and-terms'
	}
};

export const sourceIds = Object.keys(sources) as SourceId[];

/** Where the names of the parties come from. Opened from a party, and not from any setting. */
export const NAMED_BY_OAUTH: SourceRef = {
	source: 'rfc6749',
	section: '1.1',
	why: 'Section 1.1 is where OAuth names its four roles: resource owner, resource server, client and authorization server. It has no role for the browser, and from section 1.3.1 on calls it the user-agent.'
};
export const NAMED_BY_OIDC: SourceRef = {
	source: 'oidc-core',
	why: 'Section 1.2 is where it says End-User, Relying Party and OpenID Provider, and takes Resource Server and User Agent from OAuth. Most of its text still says Client and Authorization Server, and so does this site once you choose the specs’ words.'
};
export const NAMED_BY_KEYCLOAK: SourceRef = {
	source: 'keycloak-concepts',
	why: 'This is where Keycloak says what it means by its words. Its client is the specs’ client, and a realm is not in any spec. Each realm has an issuer of its own, so to an app it is one identity provider.'
};

export const nameSources: readonly SourceRef[] = [NAMED_BY_OAUTH, NAMED_BY_OIDC, NAMED_BY_KEYCLOAK];

/** One product's own docs, as opposed to a specification. */
export const isVendorSource = (id: SourceId) => id.startsWith('keycloak');

export function refLabel(ref: SourceRef): string {
	const { label } = sources[ref.source];
	return ref.section ? `${label} §${ref.section}` : label;
}

/** Where to read it at the source. RFC pages have an anchor for each section. */
export function originalUrl(source: SourceDef, section: string | null): string {
	return source.textFile && section ? `${source.url}#section-${section}` : source.url;
}
