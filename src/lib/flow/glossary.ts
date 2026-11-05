import type { DiagramId } from '#lib/flow/model.ts';
import type { SettingId, Settings } from '#lib/flow/settings.ts';
import type { ArtifactId } from '#lib/flow/vocabulary.ts';

/** Where on the diagram something can be seen, and what has to be on for it to be there. */
export interface TermPlace {
	diagram: DiagramId;
	settings?: Partial<Settings>;
	step?: string;
	lifeline?: string;
}

export interface Term {
	id: string;
	name: string;
	/** How it appears in text. Words with capitals after the first letter only match exactly. */
	words: readonly string[];
	explains: string;
	/** What else it is called, because docs and tools use all of them. */
	alsoCalled?: readonly string[];
	at?: TermPlace;
	/** It is something the diagram already explains, so it says that instead of saying it twice. */
	artifact?: ArtifactId;
	setting?: SettingId;
	/** Only about one server, so it goes when the notes about that server do (ADR-015). */
	vendor?: boolean;
	/** A part of the diagram itself, which lights up as it is explained. */
	part?: boolean;
	/** About a flow other than the one with a login, so that is where looking for it goes. */
	opens?: { flow: string; step: string };
}

const flowAt = (step: string, settings?: Partial<Settings>): TermPlace => ({
	diagram: 'flow',
	step,
	settings
});
const setupAt = (step: string, settings?: Partial<Settings>): TermPlace => ({
	diagram: 'setup',
	step,
	settings
});

const list: readonly Term[] = [
	{
		id: 'saml',
		name: 'SAML',
		words: ['SAML', 'SAML 2.0', 'assertion', 'assertions', 'service provider'],
		explains:
			'An older way for one provider to tell another who logged in, still common at companies. The answer is an assertion in a signed response, which here comes back through the browser in a form, where OpenID Connect sends a code and trades it out of sight. The provider that asks for one is the service provider.',
		at: flowAt('upstream-callback', { broker: true, companies: true, customerSpeaks: 'saml' })
	},
	{
		id: 'entity-id',
		name: 'Entity ID',
		words: ['entity ID'],
		explains:
			'The name a SAML provider goes by, usually an address. Each side is given the other one, so an assertion can say who it is from and who it is for.',
		at: setupAt('send-our-details', { broker: true, companies: true, customerSpeaks: 'saml' })
	},
	{
		id: 'acs-url',
		name: 'ACS URL',
		words: ['ACS URL', 'Assertion Consumer Service'],
		explains:
			"Assertion Consumer Service: where a SAML provider sends its answer, through the browser. Here it is the identity provider's broker endpoint.",
		at: setupAt('send-our-details', { broker: true, companies: true, customerSpeaks: 'saml' })
	},
	{
		id: 'saml-metadata',
		name: 'SAML metadata',
		words: ['SAML metadata', 'IdP metadata'],
		explains:
			'What a SAML provider says about itself: the entity ID it goes by, where to send it a request or an answer, and the certificate it signs with. Swapping these is most of setting one up.',
		at: setupAt('send-their-details', { broker: true, companies: true, customerSpeaks: 'saml' })
	},
	{
		id: 'ldap',
		name: 'LDAP',
		words: ['LDAP', 'LDAPS', 'Active Directory', 'user directory', 'user federation'],
		explains:
			'A directory of users, and the way to ask one. LDAPS is the same over an encrypted connection. An identity provider can use one for its users and still do the login itself, which Keycloak calls user federation.',
		at: flowAt('directory-bind', { federation: true })
	},
	{
		id: 'dcr',
		name: 'Dynamic client registration',
		words: ['dynamic client registration', 'DCR'],
		explains:
			'An app registering itself, by sending what someone would otherwise have told an admin. It gets a client ID and perhaps a secret back.',
		at: { diagram: 'setup', step: 'dcr-request', settings: { registration: 'dcr' } }
	},
	{
		id: 'cimd',
		name: 'Client ID metadata document',
		words: ['client ID metadata document', 'CIMD'],
		explains:
			'A document about an app at an address it controls, with that address as its client ID. So nobody has to register it first, and the identity provider fetches it when it first sees the app.',
		at: flowAt('cimd-document', {
			registration: 'cimd',
			clientType: 'public',
			pkce: true,
			consent: true
		})
	},
	{
		id: 'initial-access-token',
		name: 'Initial access token',
		words: ['initial access token'],
		explains:
			'What an admin hands over so that an app can register itself, on a server that limits who may.',
		at: { diagram: 'setup', step: 'dcr-make-token', settings: { registration: 'dcr' } }
	},
	{
		id: 'http-basic',
		name: 'HTTP Basic',
		words: ['HTTP Basic', 'Basic auth', 'basic authentication'],
		explains:
			'A way to send a username and password with each HTTP request, encoded so anyone can read them back. At the token step, an app sends its client ID and secret the same way.',
		at: flowAt('old-way-call', { oldWay: true })
	},
	{
		id: 'oauth',
		name: 'OAuth',
		words: ['OAuth', 'OAuth 2.0'],
		explains:
			'A way for an app to get access on behalf of a user, without being given their password. It is about access, and defines no way to tell the app who the user is.'
	},
	{
		id: 'openid-connect',
		name: 'OpenID Connect',
		words: ['OpenID Connect', 'OIDC'],
		explains: 'A layer on top of OAuth that also tells the app who logged in, with an ID token.',
		alsoCalled: ['OIDC'],
		at: flowAt('token-response', { oidc: true })
	},
	{
		id: 'identity-provider',
		name: 'Identity provider',
		words: [
			'identity provider',
			'identity providers',
			'IdP',
			'authorization server',
			'authorization servers',
			'OpenID provider',
			'OpenID providers'
		],
		explains:
			'The service that logs users in and hands out tokens, so that each app does not have to handle passwords itself.',
		alsoCalled: ['IdP', 'authorization server, in OAuth', 'OpenID provider, in OpenID Connect'],
		at: { diagram: 'flow', lifeline: 'idp' }
	},
	{
		id: 'issuer',
		name: 'Issuer',
		words: ['issuer', 'issuers'],
		explains:
			'The address that names an identity provider. A token says which issuer made it, and an app or API only trusts the issuer it was told about.',
		at: { diagram: 'setup', step: 'configure-app' }
	},
	{
		id: 'client',
		name: 'Client',
		words: ['client', 'clients', 'relying party', 'relying parties'],
		explains:
			'What the specs call the app, because it is a client of the identity provider. It has nothing to do with the user’s computer. The same program can be a client when it calls something, and a resource server when it is called.',
		alsoCalled: ['app', 'relying party, in OpenID Connect'],
		at: { diagram: 'flow', lifeline: 'app' }
	},
	{
		id: 'resource-owner',
		name: 'Resource owner',
		words: ['resource owner', 'End-User'],
		explains:
			'What OAuth calls the user, because they own what is being accessed, such as their calendar. OpenID Connect calls them the End-User. This site says the user in all three, because the specs’ own words for them read the same.',
		alsoCalled: ['user', 'End-User, in OpenID Connect'],
		at: { diagram: 'flow', lifeline: 'browser' }
	},
	{
		id: 'user-agent',
		name: 'User agent',
		words: ['user agent', 'user-agent'],
		explains:
			'What the specs call the browser, or whatever else carries messages for the user. The head of its column says so in the specs’ words, and the text goes on saying the browser, because the specs do too.',
		alsoCalled: ['browser'],
		at: { diagram: 'flow', lifeline: 'browser' }
	},
	{
		id: 'iss',
		name: 'iss',
		words: ['iss', 'RFC 9207', 'mix-up', 'mix-up attack'],
		explains:
			'Says which server an answer came from, as RFC 9207 defines it. An app that uses more than one has to guard against taking the answer from one for the answer from another, which is the mix-up attack, and RFC 9700 says it should check this, or something like it.',
		at: flowAt('callback')
	},
	{
		id: 'client-id',
		name: 'Client ID',
		words: ['client ID'],
		explains: 'The name an app is registered under at the identity provider. It is not a secret.',
		at: { diagram: 'setup', step: 'create-client' }
	},
	{
		id: 'public-client',
		name: 'Public client',
		words: ['public client', 'public clients'],
		explains:
			'An app that cannot keep a secret, such as one in a browser or on a phone, because whoever has the device can read what is on it.',
		at: flowAt('token-request', { clientType: 'public' })
	},
	{
		id: 'confidential-client',
		name: 'Confidential client',
		words: ['confidential client', 'confidential clients'],
		explains: 'An app that can keep a secret, usually because it runs on a server.',
		at: flowAt('token-request', { clientType: 'confidential' })
	},
	{
		id: 'scope',
		name: 'Scope',
		words: ['scope', 'scopes'],
		explains:
			'What the app is asking to be allowed to do or know, as a list of names. What is granted is not always what was asked for.',
		at: flowAt('consent-page', { consent: true })
	},
	{
		id: 'consent',
		name: 'Consent',
		words: ['consent'],
		explains: 'The user agreeing that this app may have this access.',
		at: flowAt('consent-page', { consent: true })
	},
	{
		id: 'access-denied',
		name: 'access_denied',
		words: ['access_denied'],
		explains: 'The error the app gets back when the user says no, or the server refuses this way.',
		at: flowAt('consent-page', { consent: true })
	},
	{
		id: 'redirect',
		name: 'Redirect',
		words: ['redirect', 'redirects'],
		explains:
			'A server telling the browser to go to another address. It is how this flow moves between the app and the identity provider, and why what is in it passes through the browser.',
		at: flowAt('redirect-with-code')
	},
	{
		id: 'redirect-uri',
		name: 'Redirect URI',
		words: ['redirect URI', 'redirect URIs', 'redirect_uri'],
		explains:
			'The address a user is sent back to after logging in. It has to be registered first, and has to match, so that a code cannot be sent somewhere else.',
		alsoCalled: ['callback address'],
		at: flowAt('authorize')
	},
	{
		id: 'token',
		name: 'Token',
		words: ['token', 'tokens'],
		explains:
			'A piece of data that stands for something, such as what the app may do. Whoever presents it gets treated accordingly, so it has to be looked after.',
		at: flowAt('token-response')
	},
	{
		id: 'access-token',
		name: 'Access token',
		words: ['access token', 'access tokens'],
		explains: '',
		artifact: 'access-token',
		at: flowAt('token-response')
	},
	{
		id: 'id-token',
		name: 'ID token',
		words: ['ID token', 'ID tokens'],
		explains: '',
		artifact: 'id-token',
		at: flowAt('token-response', { oidc: true })
	},
	{
		id: 'refresh-token',
		name: 'Refresh token',
		words: ['refresh token', 'refresh tokens'],
		explains: '',
		artifact: 'refresh-token',
		at: flowAt('token-response')
	},
	{
		id: 'session',
		name: 'Session',
		words: ['session', 'sessions'],
		alsoCalled: ['cookie, which is usually how a browser holds on to one'],
		explains: '',
		artifact: 'session',
		at: flowAt('redirect-with-code')
	},
	{
		id: 'auth-time',
		name: 'auth_time',
		words: ['auth_time'],
		explains: 'When the user last really logged in, as an ID token says.',
		at: flowAt('second-token-response', { sso: true, oidc: true })
	},
	{
		id: 'login-required',
		name: 'login_required',
		words: ['login_required'],
		explains:
			'What comes back when an app said not to show a form, and the user would have to log in.',
		at: flowAt('second-redirect-with-code', { sso: true, oidc: true, ssoAsks: 'fresh' })
	},
	{
		id: 'expires-in',
		name: 'expires_in',
		words: ['expires_in'],
		explains: 'How many seconds the access token lasts, as the token response says.',
		at: flowAt('token-response')
	},
	{
		id: 'code',
		name: 'Code',
		words: ['the code', 'one-time code', 'authorization code'],
		explains: '',
		artifact: 'code',
		at: flowAt('redirect-with-code')
	},
	{
		id: 'client-secret',
		name: 'Client secret',
		words: ['client secret', 'the secret', 'its secret', 'a secret'],
		explains: '',
		artifact: 'secret',
		at: flowAt('token-request')
	},
	{
		id: 'verifier',
		name: 'Code verifier',
		words: ['verifier', 'code verifier'],
		explains: '',
		artifact: 'verifier',
		at: flowAt('make-verifier', { pkce: true })
	},
	{
		id: 'challenge',
		name: 'Code challenge',
		words: ['challenge', 'code challenge'],
		explains: '',
		artifact: 'challenge',
		at: flowAt('make-verifier', { pkce: true })
	},
	{
		id: 'proof',
		name: 'Key proof',
		words: ['proof', 'key proof'],
		explains: '',
		artifact: 'proof',
		at: flowAt('api-request', { binding: 'dpop' })
	},
	{
		id: 'pkce',
		name: 'PKCE',
		words: ['PKCE'],
		explains: '',
		setting: 'pkce',
		at: flowAt('make-verifier', { pkce: true })
	},
	{
		id: 'par',
		name: 'PAR',
		words: ['PAR', 'pushed authorization request', 'pushed authorization requests'],
		alsoCalled: ['pushed authorization request'],
		explains: '',
		setting: 'par',
		at: flowAt('push-request', { par: true })
	},
	{
		id: 'request-uri',
		name: 'Request URI',
		words: ['request URI', 'request URIs', 'request_uri'],
		explains: '',
		artifact: 'request-uri',
		at: flowAt('push-response', { par: true })
	},
	{
		id: 'token-exchange',
		name: 'Token exchange',
		words: ['token exchange'],
		explains: '',
		setting: 'exchange',
		at: flowAt('exchange-request', { exchange: true })
	},
	{
		id: 'exchanged-token',
		name: 'Exchanged token',
		words: ['exchanged token', 'exchanged tokens'],
		explains: '',
		artifact: 'exchanged-token',
		at: flowAt('exchange-response', { exchange: true })
	},
	{
		id: 'exchanged-refresh-token',
		name: 'Exchanged refresh token',
		words: ['exchanged refresh token', 'exchanged refresh tokens'],
		explains: '',
		artifact: 'exchanged-refresh-token',
		at: flowAt('exchange-response', { exchange: true, exchangeGives: 'refresh' })
	},
	{
		id: 'impersonation',
		name: 'Impersonation',
		words: ['impersonation'],
		explains:
			'In RFC 8693, a token that identifies the user and is given to someone else, who then acts as the user within what it allows. Beside it is delegation, where the token also names who is acting.',
		at: flowAt('exchange-response', { exchange: true })
	},
	{
		id: 'dpop',
		name: 'DPoP',
		words: ['DPoP'],
		explains: '',
		setting: 'binding',
		at: flowAt('generate-key', { binding: 'dpop' })
	},
	{
		id: 'invalid-token',
		name: 'invalid_token',
		words: ['invalid_token'],
		explains:
			'What an API says when it does not accept a token, whichever check it failed: expired, changed, or for someone else.',
		at: flowAt('api-response', { apiToken: 'expired' })
	},
	{
		id: 'invalid-request',
		name: 'invalid_request',
		words: ['invalid_request'],
		explains:
			'The error for a request that is wrong or missing something. RFC 8693 also asks for it when the server will not take the token being traded.',
		at: flowAt('exchange-request', { exchange: true })
	},
	{
		id: 'invalid-grant',
		name: 'invalid_grant',
		words: ['invalid_grant'],
		explains:
			'The error a token endpoint sends when the grant or the refresh token it was given is no good: for example a code, a password or a refresh token that is invalid, expired, revoked or issued to another client, or a code sent with another redirect address than the login used. RFC 6749 section 5.2 defines it, and a token it will not trade gets invalid_request instead, by RFC 8693.',
		at: flowAt('trade-refresh-request', { exchange: true, exchangeGives: 'refresh' })
	},
	{
		id: 'invalid-client',
		name: 'invalid_client',
		words: ['invalid_client'],
		explains:
			'RFC 6749 section 5.2 has it for a client that fails to prove who it is, such as an unknown one. The server recorded also sent it to a client that may not have what it asked for.',
		at: flowAt('api-retrieve-upstream-token', {
			broker: true,
			upstreamTokens: 'v2',
			upstreamReader: 'refused'
		})
	},
	{
		id: 'unauthorized-client',
		name: 'unauthorized_client',
		words: ['unauthorized_client'],
		explains:
			'RFC 6749 section 5.2 has it for a client that is not allowed this way of asking. The server recorded also sent it for a token that did not name the client asking, and for a wrong secret, which RFC 6749 calls invalid_client.',
		at: flowAt('api-retrieve-upstream-token', {
			broker: true,
			upstreamTokens: 'v2',
			upstreamReader: 'api'
		})
	},
	{
		id: 'invalid-target',
		name: 'invalid_target',
		words: ['invalid_target'],
		explains:
			'The error RFC 8693 says a server should send when it will not issue a token for the API that was asked for.',
		at: flowAt('exchange-request', { exchange: true })
	},
	{
		id: 'insufficient-scope',
		name: 'insufficient_scope',
		words: ['insufficient_scope'],
		explains:
			'What an API says when it accepts a token, and that token does not allow this. A new token of the same kind will not help.',
		at: flowAt('api-response', { apiToken: 'noscope' })
	},
	{
		id: 'www-authenticate',
		name: 'WWW-Authenticate',
		words: ['WWW-Authenticate'],
		explains:
			'A header on a refusal, saying what kind of token the server wants and what was wrong with this one.',
		at: flowAt('api-response', { apiToken: 'expired' })
	},
	{
		id: 'logout',
		name: 'Logging out',
		words: ['log out', 'logout', 'logging out', 'logs out'],
		at: flowAt('session-ended', { oidc: true, logout: true }),
		explains:
			'Ending a session. An app’s own session and the identity provider’s are separate, so ending one does not by itself end the other, and tokens already handed out can still work until they expire.'
	},
	{
		id: 'library',
		name: 'Library',
		words: ['library', 'libraries'],
		explains:
			'Code someone else wrote, that yours calls to do a job. For this flow, it is what you add so you do not have to write each of these messages yourself.'
	},
	{
		id: 'framework',
		name: 'Framework',
		words: ['framework', 'frameworks'],
		explains:
			'Code that your whole app is built on, and so it can do more of this for you than a library that you call yourself.'
	},
	{
		id: 'gateway',
		name: 'Gateway',
		words: ['gateway', 'gateways'],
		explains: 'A server in front of an API, which can do checks before a request gets to it.'
	},
	{
		id: 'http',
		name: 'HTTP',
		words: ['HTTP', 'HTTPS'],
		explains:
			'How browsers and servers talk: a request, and an answer. HTTPS is the same with the connection encrypted, which is what all of this needs outside a test.',
		at: flowAt('open-app')
	},
	{
		id: 'tls',
		name: 'TLS',
		words: ['TLS'],
		explains:
			'What encrypts a connection, and shows it is really that server. It is the S in HTTPS.'
	},
	{
		id: 'api',
		name: 'API',
		words: ['API', 'APIs', 'resource server', 'resource servers'],
		explains: 'A service the app calls to get or change something, such as someone’s calendar.',
		alsoCalled: ['resource server, in OAuth'],
		at: { diagram: 'flow', lifeline: 'api' }
	},
	{
		id: 'endpoint',
		name: 'Endpoint',
		words: ['endpoint', 'endpoints'],
		explains: 'An address on a server that does one job, such as where tokens are handed out.',
		at: { diagram: 'setup', step: 'discover' }
	},
	{
		id: 'discovery',
		name: 'Discovery',
		words: ['discovery', 'discovers'],
		explains: 'An app looking up the addresses of an identity provider, starting from its issuer.',
		at: { diagram: 'setup', step: 'discover' }
	},
	{
		id: 'signature',
		name: 'Signature',
		words: ['signature', 'signatures', 'signed'],
		explains:
			'A value made with a private key, which anyone with the matching public key can check. So a token cannot be changed without that being noticed. Some are made with a shared key instead, which only those who hold it can check.',
		at: flowAt('api-check-token')
	},
	{
		id: 'bearer',
		name: 'Bearer token',
		words: ['bearer', 'bearer token', 'bearer tokens'],
		explains: 'A token where holding it is enough: whoever presents it gets in.',
		at: flowAt('api-request')
	},
	{
		id: 'fingerprint',
		name: 'Fingerprint',
		words: ['fingerprint'],
		explains:
			'A short value worked out from a longer one, in a way that cannot be turned back. The same input always gives the same fingerprint.',
		at: flowAt('make-verifier', { pkce: true })
	},
	{
		id: 'state',
		name: 'State',
		words: ['state'],
		explains:
			"A random value, tied to this browser, that the app sends with the login and checks when the user comes back, so nobody can slip an answer into this user's login. It does not stop someone starting a login in their own browser and handing the app a stolen code, which takes PKCE or a nonce. Those can also do what state does, once the app has made sure the server supports PKCE.",
		alsoCalled: ['CSRF protection'],
		at: flowAt('authorize')
	},
	{
		id: 'device-flow',
		name: 'Device flow',
		words: ['device flow', 'device authorization grant', 'device code flow', 'device grant'],
		explains:
			'For an app with no good way to log anyone in, such as on a TV. It shows a short code, the user types that into a browser on another device and logs in there, and the app keeps asking until they are done.',
		alsoCalled: ['device authorization grant', 'device code flow', 'RFC 8628'],
		opens: { flow: 'device', step: 'device-request' }
	},
	{
		id: 'device-code',
		name: 'Device code',
		words: ['device code', 'device codes', 'device_code'],
		explains: '',
		artifact: 'device-code',
		opens: { flow: 'device', step: 'device-response' }
	},
	{
		id: 'user-code',
		name: 'User code',
		words: ['user code', 'user codes', 'user_code'],
		explains: '',
		artifact: 'user-code',
		opens: { flow: 'device', step: 'device-show-code' }
	},
	{
		id: 'authn-authz',
		name: 'Authentication and authorization',
		words: ['authentication and authorization', 'authn', 'authz'],
		explains:
			'Authentication is finding out who someone is, and authorization is what they may do. Someone logs in under OAuth too, but OAuth only says what the app may do. OpenID Connect also tells the app who it was, with an ID token.',
		alsoCalled: [
			'authentication vs authorization',
			'authn vs authz',
			'OAuth is not login',
			'is OAuth login',
			'difference between OAuth and OpenID Connect',
			'difference between OAuth and OIDC'
		],
		at: flowAt('token-response', { oidc: true })
	},
	{
		id: 'refresh-rotation',
		name: 'Refresh token rotation',
		words: [
			'refresh token rotation',
			'token rotation',
			'rotation',
			'rotate',
			'rotates',
			'rotating'
		],
		explains:
			'Giving out a new refresh token each time one is used. It only helps if the old one then stops working, which a server may have to be set to do.',
		at: flowAt('refresh-again-response', { refresh: true })
	},
	{
		id: 'xss',
		name: 'XSS',
		words: ['XSS', 'cross-site scripting'],
		explains:
			'Someone getting a script of theirs to run in your page. It can then do whatever your page can, including reading or using any token the page holds, and asking for new ones.',
		alsoCalled: ['cross-site scripting']
	},
	{
		id: 'web-storage',
		name: 'Storage in the browser',
		words: ['localStorage', 'sessionStorage', 'IndexedDB', 'local storage', 'session storage'],
		explains:
			'Where a page can keep things in the browser. Any script running in that page can read it, so a token kept there is only as safe as the page. Keeping it in memory limits that, and does not end it.',
		at: flowAt('token-response', { oidc: true, clientType: 'public', pkce: true })
	},
	{
		id: 'worker',
		name: 'Worker',
		words: ['worker', 'workers', 'Web Worker', 'Service Worker'],
		explains:
			'Code the browser runs apart from the page, so the page can only ask it to do things. A token kept there is out of a script’s reach, though the script can still ask the worker to use it.'
	},
	{
		id: 'bff',
		name: 'Backend for frontend',
		words: ['backend for frontend', 'backend-for-frontend', 'BFF'],
		at: flowAt('set-session', { appRuns: 'bff', clientType: 'confidential', pkce: true }),
		explains:
			'A server of your own behind an app in the browser. It is the client: it does the login and uses the tokens, and the browser only gets a cookie from it that no script can read, so there are no tokens in the page to take. A script running there can still send requests through it as the user.',
		alsoCalled: ['BFF']
	},
	{
		id: 'spa',
		name: 'Single-page app',
		words: ['single-page app', 'single page app', 'SPA', 'SPAs'],
		explains:
			'An app whose code runs in the browser. That code cannot keep a secret, and what it holds is within reach of the page, unless a server behind it holds it instead.',
		alsoCalled: ['SPA'],
		at: flowAt('token-request', { oidc: true, clientType: 'public', pkce: true })
	},
	{
		id: 'password-grant',
		name: 'Password grant',
		words: ['password grant', 'resource owner password credentials'],
		explains:
			'An app taking the user’s password itself and sending it for a token. Current advice says it must not be used, because it hands the app the one thing all of this keeps from it.'
	},
	{
		id: 'authorization-pending',
		name: 'authorization_pending',
		words: ['authorization_pending'],
		explains:
			'What the app is told while the user has not finished. On the wire it is an error, and here it means wait and ask again.',
		opens: { flow: 'device', step: 'device-pending' }
	},
	{
		id: 'slow-down',
		name: 'slow_down',
		words: ['slow_down'],
		explains:
			'What the app can be told if it asks too often. It has to wait 5 seconds longer from then on.',
		opens: { flow: 'device', step: 'device-pending' }
	},
	{
		id: 'expired-token',
		name: 'expired_token',
		words: ['expired_token'],
		explains:
			'What the app is told when the codes ran out before the user finished. It stops asking, and trying again takes new codes.',
		opens: { flow: 'device', step: 'device-token-response' }
	},
	{
		id: 'polling',
		name: 'Polling',
		words: ['polling', 'poll'],
		explains:
			'Asking the same thing again and again until the answer changes. An app does it when nothing can call it back.',
		opens: { flow: 'device', step: 'device-poll' }
	},
	{
		id: 'device-phishing',
		name: 'Device code phishing',
		words: ['device code phishing', 'device phishing', 'remote phishing'],
		explains:
			'Someone starts the device flow on a device of their own, and sends you the address and the user code. If you log in and agree, they get the tokens, and you never gave away a password.',
		opens: { flow: 'device', step: 'device-consent-page' }
	},
	{
		id: 'code-injection',
		name: 'Code injection',
		words: ['injection', 'code injection', 'authorization code injection'],
		explains:
			'Getting an app to trade a stolen code for you, by handing it to the app in a login of your own. Its secret does not help, because the app is the one using it. PKCE stops it, and so does a nonce if the app checks it and uses no token before then. Neither helps if they can also change the request.',
		at: flowAt('attacker-hands-code', { attacker: true, attackerUses: 'real-app' })
	},
	{
		id: 'csrf',
		name: 'CSRF',
		words: ['CSRF', 'cross-site request forgery'],
		explains:
			'Cross-site request forgery: getting someone’s browser to send a request they did not mean to. Against a login, it can leave them working in the attacker’s account without noticing.',
		at: flowAt('callback')
	},
	{
		id: 'claim',
		name: 'Claim',
		words: ['claim', 'claims'],
		explains: 'A statement inside a token, such as who it is about or when it runs out.'
	},
	{
		id: 'opaque',
		name: 'Opaque',
		words: ['opaque'],
		explains:
			'What a token is to whoever is not meant to read it: just a string to pass on, whatever is in it.'
	},
	{
		id: 'nonce',
		name: 'Nonce',
		words: ['nonce'],
		explains:
			'A value that is only used once, so that something made with it cannot be used again.',
		at: flowAt('authorize', { oidc: true })
	},
	{
		id: 'audience',
		name: 'Audience',
		words: ['audience'],
		explains:
			'Who a token is for. An API should refuse a token that names someone else, because otherwise a token meant for another API gets in.',
		alsoCalled: ['aud'],
		at: flowAt('api-check-token')
	},
	{
		id: 'front-channel',
		name: 'Front channel',
		words: ['front channel'],
		explains:
			'Messages that go through the browser, where the user and anything running in their browser can see them.',
		at: flowAt('redirect-with-code')
	},
	{
		id: 'back-channel',
		name: 'Back channel',
		words: ['back channel'],
		explains: 'Messages one system sends straight to another, which do not go through the browser.',
		at: flowAt('token-request')
	},
	{
		id: 'jwt',
		name: 'JWT',
		words: ['JWT', 'JWTs'],
		explains:
			'JSON Web Token, a token format that can usually be read by anyone and is signed so it cannot be changed. Many tokens here are JWTs, though an access token does not have to be one.',
		at: flowAt('token-response')
	},
	{
		id: 'sso',
		name: 'Single sign-on',
		words: ['SSO', 'single sign-on'],
		at: flowAt('idp-recognises', { sso: true }),
		explains:
			'Logging in once, and then not being asked again by other apps that use the same identity provider, because it remembers you in your browser.',
		alsoCalled: ['SSO']
	},
	{
		id: 'keycloak',
		name: 'Keycloak',
		words: ['Keycloak'],
		vendor: true,
		explains:
			'A free identity provider you can run yourself. The messages on this site came from one. What the specs say is the same on other identity providers, and the wording of its errors, its token contents, defaults and console are its own.'
	},
	{
		id: 'realm',
		name: 'Realm',
		words: ['realm', 'realms'],
		vendor: true,
		explains:
			'What Keycloak calls one separate set of users and apps. Each realm has its own issuer, so to an app each one is an identity provider of its own.',
		at: { diagram: 'setup', step: 'configure-app' }
	}
];

/** What is on the diagram itself. Someone new has not been told what any of it means. */
const parts: readonly Term[] = [
	{
		id: 'part-column',
		name: 'A column',
		words: [],
		part: true,
		explains:
			'Someone or something taking part, with its name at the top. Select a name to learn more.'
	},
	{
		id: 'part-arrow',
		name: 'A solid arrow',
		words: [],
		part: true,
		explains: 'A message, from the column it starts at to the one it points to.'
	},
	{
		id: 'part-answer',
		name: 'A dashed arrow',
		words: [],
		part: true,
		explains: 'An answer to a message before it.'
	},
	{
		id: 'part-browser',
		name: 'Orange',
		words: [],
		part: true,
		explains:
			'This message goes through the browser, where the user and software in their browser can see it.'
	},
	{
		id: 'part-direct',
		name: 'Teal',
		words: [],
		part: true,
		explains:
			'One system calls another directly, without sending the browser there. If the app runs in the browser, that call comes from the page.'
	},
	{
		id: 'part-number',
		name: 'A number',
		words: [],
		part: true,
		explains: 'The order things happen in. Next moves through them, and a number can be selected.'
	},
	{
		id: 'part-chip',
		name: 'A chip on an arrow',
		words: [],
		part: true,
		explains: 'Something this message carries, such as a code or a token. Select one to learn more.'
	},
	{
		id: 'part-seen',
		name: 'A chip under a name',
		words: [],
		part: true,
		explains:
			'What that one has seen so far. It grows as you step, and it is the point of all this.'
	},
	{
		id: 'part-ahead',
		name: 'A faint arrow',
		words: [],
		part: true,
		explains: 'What is still to come. What it carries shows when it gets there.'
	},
	{
		id: 'part-time',
		name: 'A gap across every line',
		words: [],
		part: true,
		explains: 'Time passing. Nothing is sent, and whatever comes after it happens later.'
	}
];

export const diagramParts = parts;

export const READING: Term = {
	id: 'reading',
	name: 'How to read this',
	words: [],
	explains:
		'Each arrow is a message, and its number says when it happens. Its colour says how it travels, and what is still ahead is faint. The chips under a name are what it has seen so far. Next and the arrow keys move through it, and selecting any part says what it means.'
};

export const terms: Readonly<Record<string, Term>> = Object.fromEntries(
	[...list, ...parts, READING].map((term) => [term.id, term])
);

const escaped = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isExact = (word: string) => /[A-Z]/.test(word.slice(1));

// Longest first, so that "access token" is that and not "token", and each word only in its own case
// when it has capitals in it, so that "API" does not match in "apiary" and "the code" does in "The code".
const byWord = new Map(
	list
		.flatMap((term) => term.words.map((word) => [word, term] as const))
		.sort(([a], [b]) => b.length - a.length)
);
const pattern = new RegExp(
	`(?<![\\w-])(?:${[...byWord.keys()].map(escaped).join('|')})(?![\\w-])`,
	'gi'
);

function termFor(found: string): Term | undefined {
	const exact = byWord.get(found);
	if (exact) return exact;
	for (const [word, term] of byWord) {
		if (!isExact(word) && word.toLowerCase() === found.toLowerCase()) return term;
	}
	return undefined;
}

/** Whether a word in text has an explanation, whichever way it is written. */
export const isExplained = (word: string) => termFor(word) !== undefined;

export interface Segment {
	text: string;
	term?: Term;
}

/**
 * Text cut up by the terms in it. Only the first use of each is marked across what is passed in,
 * because the same word underlined six times on a step is noise. Nobody writes a mark by hand.
 */
export function markTerms(
	texts: readonly string[],
	{ serverNamed = true }: { serverNamed?: boolean } = {}
): Segment[][] {
	const marked = new Set<string>();
	return texts.map((text) => {
		const segments: Segment[] = [];
		let last = 0;
		for (const match of text.matchAll(pattern)) {
			const term = termFor(match[0]);
			if (!term || marked.has(term.id) || (term.vendor && !serverNamed)) continue;
			marked.add(term.id);
			if (match.index > last) segments.push({ text: text.slice(last, match.index) });
			segments.push({ text: match[0], term });
			last = match.index + match[0].length;
		}
		if (last < text.length) segments.push({ text: text.slice(last) });
		return segments;
	});
}
