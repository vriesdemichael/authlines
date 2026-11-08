export type SourceId =
	| 'rfc6749'
	| 'rfc6750'
	| 'rfc7617'
	| 'rfc7591'
	| 'cimd-draft'
	| 'rfc7636'
	| 'rfc9449'
	| 'rfc9068'
	| 'rfc6238'
	| 'rfc9126'
	| 'rfc8693'
	| 'rfc9207'
	| 'rfc8628'
	| 'rfc9700'
	| 'rfc10017'
	| 'rfc8252'
	| 'oidc-core'
	| 'oidc-rp-logout'
	| 'oidc-backchannel-logout'
	| 'keycloak-brokering'
	| 'keycloak-federation'
	| 'keycloak-organizations'
	| 'keycloak-timeouts'
	| 'saml-core'
	| 'keycloak-stored-tokens'
	| 'keycloak-account-linking'
	| 'keycloak-broker-mappers'
	| 'keycloak-role-scope'
	| 'keycloak-admin-permissions'
	| 'keycloak-concepts'
	| 'webauthn';

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
	rfc7591: {
		label: 'RFC 7591',
		title: 'OAuth 2.0 Dynamic Client Registration Protocol',
		status: 'Proposed Standard, July 2015.',
		summary:
			'How an app registers itself with an authorization server: it sends what it would otherwise tell an admin, and gets a client ID and perhaps a secret back. The server can ask for an initial access token first, so that it is not open to anyone.',
		url: 'https://www.rfc-editor.org/rfc/rfc7591.html',
		textFile: 'rfc7591.txt'
	},
	'cimd-draft': {
		label: 'CIMD draft',
		title: 'OAuth Client ID Metadata Document',
		status: 'Internet-Draft, at -03 on 2026-11-02, and not a standard.',
		summary:
			'The client ID is an HTTPS address, and at that address is a document about the app, such as where users may be sent back to. So nobody has to register it first, and the server fetches the document when an app it has not seen asks for a login, and may keep a copy.',
		url: 'https://datatracker.ietf.org/doc/draft-ietf-oauth-client-id-metadata-document/'
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
	rfc9068: {
		label: 'RFC 9068',
		title: 'JSON Web Token (JWT) Profile for OAuth 2.0 Access Tokens',
		status: 'Proposed Standard, October 2021.',
		summary:
			'Says what an access token that is a JWT holds, so that APIs from different makers can read it the same way: who issued it, who it is about and for, when it runs out, which client it went to, and its scope. Roles, groups and entitlements are left open, with names to use for them if a server puts them in, and no words for what they mean.',
		url: 'https://www.rfc-editor.org/rfc/rfc9068.html',
		textFile: 'rfc9068.txt'
	},
	rfc6238: {
		label: 'RFC 6238',
		title: 'TOTP: Time-Based One-Time Password Algorithm',
		status: 'Informational, May 2011.',
		summary:
			'How an authenticator app and a server make the same code without talking: both keep a secret shared once, and make a code from it and the number of time steps since 1970. A step is 30 seconds unless set otherwise, and a server can take a code from a step or so either side, for clocks that differ.',
		url: 'https://www.rfc-editor.org/rfc/rfc6238.html',
		textFile: 'rfc6238.txt'
	},
	rfc9126: {
		label: 'RFC 9126',
		title: 'OAuth 2.0 Pushed Authorization Requests',
		status: 'Proposed Standard, September 2021.',
		summary:
			'Lets the app send its authorization request straight to the authorization server, proving who it is the way it would at the token endpoint, and get back a reference to it. The browser then carries only the client ID and that reference. What the app asked for stays out of the browser, where it could be read or changed, and the server can check it before the user is involved. The app must use a reference once, and a server may require every request to come this way.',
		url: 'https://www.rfc-editor.org/rfc/rfc9126.html',
		textFile: 'rfc9126.txt'
	},
	rfc8693: {
		label: 'RFC 8693',
		title: 'OAuth 2.0 Token Exchange',
		status: 'Proposed Standard, January 2020.',
		summary:
			'Lets a client, which can be an API, hand the authorization server a token it has and get a different one back, usually for the same subject, and meant for somewhere else. An API can trade the access token it was sent for one to send to the service behind it. The new token can stand for the user, which the RFC calls impersonation, or also say who is acting for them, in an act claim, which it calls delegation. It defines the request and the answer, and leaves which exchanges are allowed to the server.',
		url: 'https://www.rfc-editor.org/rfc/rfc8693.html',
		textFile: 'rfc8693.txt'
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
	rfc8252: {
		label: 'RFC 8252',
		title: 'OAuth 2.0 for Native Apps',
		status: 'Best Current Practice (BCP 212), October 2017.',
		summary:
			'What an app installed on a device has to do: log in through the user’s own browser rather than a page built into the app, use PKCE because it has no secret worth the name, and get the answer back through an address it owns, a scheme of its own, or a port on 127.0.0.1. It says what each of those does and does not protect.',
		url: 'https://www.rfc-editor.org/rfc/rfc8252.html',
		textFile: 'rfc8252.txt'
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
	'keycloak-federation': {
		label: 'Keycloak docs: user federation',
		title: 'Using external storage',
		status: 'Keycloak 26.8.1, Server Administration Guide.',
		summary:
			'Keycloak can use users from LDAP or Active Directory, imported or not, and check their passwords on the LDAP server.',
		url: 'https://www.keycloak.org/docs/26.8.1/server_admin/#_user-storage-federation'
	},
	'keycloak-organizations': {
		label: 'Keycloak docs: organizations',
		title: 'Managing organizations',
		status: 'Keycloak 26.8.1, Server Administration Guide.',
		summary:
			"Keycloak can keep customers apart as organizations, each with its members, domains and identity providers. With organizations on, the login can ask for an email first, and send someone whose email is at one of an organization's domains straight to its provider.",
		url: 'https://www.keycloak.org/docs/26.8.1/server_admin/#_managing_organizations'
	},
	'keycloak-timeouts': {
		label: 'Keycloak docs: timeouts',
		title: 'Session and token timeouts',
		status: 'Keycloak 26.8.1, Server Administration Guide.',
		summary:
			'How long sessions and tokens last on a realm. A session ends when it has not been used for SSO Session Idle, and at the latest after SSO Session Max. Logging in again or refreshing a token counts as using it. A token has a lifespan of its own.',
		url: 'https://www.keycloak.org/docs/26.8.1/server_admin/#_timeouts'
	},
	'saml-core': {
		label: 'SAML 2.0 Core',
		title: 'Assertions and Protocols for the OASIS Security Assertion Markup Language (SAML) V2.0',
		status: 'OASIS Standard, 15 March 2005.',
		summary:
			'Defines the assertion, a statement one system makes about someone: that they logged in and how, what else it knows about them, and what they may do. It also defines the requests and responses that carry assertions. How those messages travel, such as in a form through the browser, is in a separate document on bindings.',
		url: 'https://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf'
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
	'keycloak-account-linking': {
		label: 'Keycloak docs: account linking',
		title: 'Client initiated account linking',
		status: 'Keycloak 26.8.1, Server Developer Guide.',
		summary:
			'How an app sends a logged-in user to link an account at another identity provider: an ordinary authentication request, with kc_action=idp_link and the provider’s alias added. The user needs a role that lets them manage their account links. An older way, with a protocol of its own rather than application-initiated actions, is off by default and may be removed.',
		url: 'https://www.keycloak.org/docs/26.8.1/server_development/#_client-initiated-account-linking'
	},
	'keycloak-broker-mappers': {
		label: 'Keycloak docs: identity provider mappers',
		title: 'Mapping claims and assertions',
		status: 'Keycloak 26.8.1, Server Administration Guide.',
		summary:
			'Each user who logs in through another provider has a user here too, made from what that provider said. Mappers on the provider take a claim or an assertion and turn it into something here, such as an attribute or a role, and each says whether it does that at the first login only or at every login.',
		url: 'https://www.keycloak.org/docs/26.8.1/server_admin/#_mappers'
	},
	'keycloak-role-scope': {
		label: 'Keycloak docs: role scope mappings',
		title: 'Role scope mappings',
		status: 'Keycloak 26.8.1, Server Administration Guide.',
		summary:
			'A user’s roles become claims in the tokens made for them. With Full Scope Allowed on, every token has every role the user has, so one that is stolen carries all of them. Turned off, a token has only the roles given to that client’s scope. The guide says the switch is deprecated, and to turn it off on every client.',
		url: 'https://www.keycloak.org/docs/26.8.1/server_admin/#_role_scope_mappings'
	},
	webauthn: {
		label: 'WebAuthn',
		title: 'Web Authentication: An API for accessing Public Key Credentials, Level 3',
		status: 'W3C Recommendation.',
		summary:
			'How a site has the browser make a key pair for its domain, and later asks for a signature with it. The site keeps only the public half. The browser puts the page’s origin and the site’s challenge into what the key signs, and offers a key only to the site it was made for, which is why a fake site gets nothing it can pass on.',
		url: 'https://www.w3.org/TR/webauthn-3/'
	},
	'keycloak-admin-permissions': {
		label: 'Keycloak docs: admin permissions',
		title: 'Fine-grained admin permissions',
		status: 'Keycloak 26.8.1, Server Administration Guide.',
		summary:
			'How to let someone, or an app’s own service account, manage only part of a realm through its admin console and API. Turned on for the realm, permissions name what may be done to users, roles, groups and clients, such as mapping one role, and policies name who may do it.',
		url: 'https://www.keycloak.org/docs/26.8.1/server_admin/#_fine_grained_permissions'
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
