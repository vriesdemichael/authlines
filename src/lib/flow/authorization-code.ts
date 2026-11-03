import { withTheOldWayInTheFlow } from '#lib/flow/old-way.ts';
import type { DiagramDef, FieldDef } from '#lib/flow/model.ts';
import { example } from '#lib/flow/libraries.ts';
import {
	apiWords,
	appWords,
	browserWords,
	directoryWords,
	idpWords,
	secondAppWords,
	upstreamWords
} from '#lib/flow/parties.ts';
import { all, any, is, not, type Settings } from '#lib/flow/settings.ts';

const oidc = is('oidc', true);
const confidential = is('clientType', 'confidential');
const pkce = is('pkce', true);
const consent = is('consent', true);
const inPage = is('appRuns', 'page');
const behindThePage = is('appRuns', 'bff');
const fromADocument = is('registration', 'cimd');
const inADirectory = is('federation', true);
const byHand = is('registration', 'manual');
const attacker = is('attacker', true);
// The code is one-time, and on a public client nothing stops someone else using it first.
const codeTaken = all(attacker, not(confidential));
const handedToTheApp = is('attackerUses', 'real-app');
const codeGone = any(codeTaken, handedToTheApp);
const stillGoing = not(codeGone);
const attackerWins = all(codeTaken, not(pkce));
const stoppedByPkce = all(codeTaken, pkce);
const stoppedByNonce = all(handedToTheApp, oidc, not(pkce));
const stoppedBySecret = all(attacker, confidential);
const dpop = is('binding', 'dpop');
const bearer = is('binding', 'bearer');
const nonce = is('dpopNonce', true);
const broker = is('broker', true);
/** Each customer has a provider of their own, and the identity provider finds which (issue 118). */
const companies = is('companies', true);
const saml = all(companies, is('customerSpeaks', 'saml'));
/** Their company turns their account off, and what still works here. */
const leaves = is('leaves', true);
const storedTokens = any(is('upstreamTokens', 'v1'), is('upstreamTokens', 'v2'));
const apiV1 = is('upstreamTokens', 'v1');
const apiV2 = is('upstreamTokens', 'v2');
const sends = (value: Settings['apiToken']) => is('apiToken', value);
const apiRefuses = not(sends('good'));
const logsOut = is('logout', true);
const secondApp = is('sso', true);
const secondInsists = all(secondApp, is('ssoAsks', 'insists'));
const secondIsFresh = all(secondApp, is('ssoAsks', 'fresh'));
const remembered = all(secondApp, is('ssoAsks', 'remembered'));
const secondGetsACode = all(secondApp, not(is('ssoAsks', 'fresh')));
const refreshes = is('refresh', true);
const reuseEnds = all(refreshes, is('reuse', 'ends'));
const refreshFields: FieldDef[] = [
	{ name: 'grant_type=refresh_token', place: 'body' },
	{ name: 'client_id', place: 'body', when: not(confidential) },
	{
		name: 'Authorization: Basic',
		place: 'header',
		note: 'The client ID and secret',
		artifact: 'secret',
		when: confidential
	}
];

/**
 * Every field here is held to the recordings of a real Keycloak by src/lib/recordings/recordings.test.ts.
 * The concept texts are not, because they explain and do not describe the wire.
 */
export const authorizationCode: DiagramDef = withTheOldWayInTheFlow({
	id: 'authorization-code',
	title: 'Authorization code flow',
	caption: 'What happens when a user arrives.',
	summary: 'An app gets access on behalf of a user, without ever seeing their password.',
	intro:
		'An app wants to do something for a user, such as read their calendar, without ever seeing their password. OAuth is how it gets permission. OpenID Connect adds who the user is, which is what logging in with an account elsewhere comes down to. Press Next to follow it, one message at a time.',
	specs: ['rfc6749', 'rfc6750'],
	lifelines: [
		{
			id: 'browser',
			plainName: "User's browser",
			plainRole: 'Where the user is',
			...browserWords,
			icon: 'browser',
			front: true,
			when: all(not(inPage), not(behindThePage)),
			concept:
				'Where the user is. Anything sent through the browser can be seen, and changed, by the user and by software in the browser. That is why the flow is careful about what goes this way.'
		},
		{
			id: 'browser',
			plainName: 'Browser and app',
			plainRole: 'The app is a page',
			...browserWords,
			name: 'Browser and client',
			role: 'The client is a page',
			icon: 'browser',
			front: true,
			when: inPage,
			concept:
				'The app runs here, as a page in the user’s browser, so the two are one place. It makes its calls from the page, and what it gets stays in the page, where the user and any script running in it can reach it. The login page is not part of that: it is the identity provider’s own, at another address, and the browser keeps the app’s script out of it. So the password is here in the browser, and still does not reach the app.'
		},
		{
			id: 'browser',
			plainName: 'Browser and page',
			plainRole: 'The page runs here',
			...browserWords,
			name: 'Browser and page',
			role: 'The page runs here',
			icon: 'browser',
			front: true,
			when: behindThePage,
			concept:
				'Where the user is, and where the app’s page runs. The page is not the client here, and has no tokens and no secret.'
		},
		{
			id: 'app',
			plainName: 'App',
			plainRole: 'What the user uses',
			...appWords,
			icon: 'app',
			when: not(behindThePage),
			joins: { lifeline: 'browser', when: inPage },
			startsWith: [{ artifact: 'secret', when: confidential }],
			concept: [
				{
					when: not(confidential),
					text: "The application the user wants to use. In OAuth's terms it is the client, and it never sees the user's password. If it runs in the browser, it and the browser on this diagram are the same place: its direct calls come from the page, and anything running in that page can see them."
				},
				{
					text: "The application the user wants to use. In OAuth's terms it is the client, and it never sees the user's password."
				}
			]
		},
		{
			id: 'app',
			plainName: 'App’s server',
			plainRole: 'Keeps the tokens',
			...appWords,
			icon: 'app',
			when: behindThePage,
			startsWith: [{ artifact: 'secret', when: confidential }],
			concept:
				"A small server of the app's own, behind the page. In OAuth's terms this is the client: it has the secret, does the login and keeps the tokens, and it never sees the user's password."
		},
		{
			id: 'second-app',
			plainName: 'Second app',
			plainRole: 'Same provider',
			...secondAppWords,
			icon: 'app',
			startsWith: [{ artifact: 'secret' }],
			when: secondApp,
			concept:
				'Another application, with a registration of its own. It knows nothing about the first app. All they share is the identity provider they use.'
		},
		{
			id: 'idp',
			plainName: 'Identity provider',
			plainRole: 'Logs users in',
			...idpWords,
			icon: 'idp',
			startsWith: [{ artifact: 'secret', when: confidential }],
			concept:
				'The identity provider, or IdP, logs users in and issues tokens. Its issuer is the address that names it: a token it signs says who issued it, and everyone checks that against the address they were set up with.'
		},
		{
			id: 'attacker',
			plainName: 'Someone else',
			plainRole: 'Has no business here',
			name: 'Attacker',
			role: 'Has a copy of the code',
			icon: 'attacker',
			concept:
				"Someone who can read the redirects that go through the browser, but is not the app. Someone who can also change a request can swap in a challenge or a nonce of their own, and then neither stops them. On a phone that can be another app claiming the same address, which gets the code first. A log or a history that keeps addresses usually sees it too late, because a code works once. Something running inside the app's own page sees far more than this, and no setting here stops that.",
			when: attacker
		},
		{
			id: 'directory',
			plainName: 'User directory',
			plainRole: 'Has the users',
			...directoryWords,
			icon: 'api',
			concept:
				'Where the users already are, such as LDAP or Active Directory. On this diagram only the identity provider talks to it.',
			when: inADirectory
		},
		{
			id: 'upstream',
			plainName: 'Other provider',
			plainRole: 'Does the login',
			...upstreamWords,
			icon: 'upstream',
			concept:
				"Another identity provider, such as the one at the user's employer, which the identity provider trusts to log the user in.",
			when: all(broker, not(companies))
		},
		{
			id: 'upstream',
			plainName: 'Their company',
			plainRole: 'Its own provider',
			...upstreamWords,
			icon: 'upstream',
			concept:
				"The provider at the user's own company, which the company runs. Each customer can have one, and this is the one for the person logging in now. The identity provider trusts it for that company's people.",
			when: companies
		},
		{
			id: 'api',
			plainName: 'API',
			plainRole: 'Has the data',
			...apiWords,
			icon: 'api',
			concept:
				'What the app wants to call on behalf of the user. It decides from the token whether to answer, without ever talking to the user.'
		}
	],
	groups: [
		{
			id: 'brokered-login',
			plain: 'The login at the other provider',
			label: 'Brokered login: here the identity provider is the client',
			when: all(broker, not(companies))
		},
		{
			id: 'brokered-login',
			plain: 'The login at their company',
			label: 'Brokered login: here the identity provider is the client',
			when: all(companies, not(saml))
		},
		{
			id: 'brokered-login',
			plain: 'The login at their company',
			label: 'Brokered login: in SAML, the identity provider is the service provider',
			when: saml
		},
		{ id: 'nonce-retry', plain: 'A fresh proof', label: 'Nonce retry', when: nonce }
	],
	parts: [
		{
			label: 'Ask',
			why: 'The app does not handle the password, so it sends the user off to log in elsewhere.',
			from: 'open-app'
		},
		{
			label: 'Log in',
			why: 'The user proves who they are away from the app, which never sees the password.',
			from: 'login-page'
		},
		{
			label: 'Stolen',
			why: 'What someone else can do with the code, if they get hold of it on its way back.',
			from: 'attacker-steals-code'
		},
		{
			label: 'Trade',
			why: 'Only a code went through the browser. This is where the app tries to trade it for tokens.',
			from: 'callback'
		},
		{
			label: 'Use',
			why: 'This is what the token was for, and whatever gets the call decides what to do with it.',
			from: 'userinfo-request'
		},
		{
			label: 'Leave',
			why: 'Their company turns their account off. What still works here is what a customer asks about.',
			from: 'company-turns-off'
		},
		{
			label: 'Renew',
			why: 'An access token does not last, and a refresh token can get another without asking the user again.',
			from: 'token-runs-out'
		},
		{
			label: 'Second app',
			why: 'Another app sends a browser to the same identity provider, which may remember it.',
			from: 'second-open-app'
		},
		{
			label: 'Log out',
			why: 'Logging out ends some things and leaves others, and this shows which on a real server.',
			from: 'logout-start'
		},
		{
			label: 'Stored token',
			why: "The app gets the other provider's token from the identity provider, which kept it.",
			from: 'retrieve-upstream-token'
		}
	],
	steps: [
		{
			id: 'open-app',
			from: 'browser',
			to: 'app',
			kind: 'request',
			plain: 'The user opens the app',
			label: 'Open the app',
			concept: [
				{
					when: behindThePage,
					text: 'The page loads. It is not the client here, the server behind it is, so it has nothing of its own to log in with.'
				},
				{
					when: inPage,
					text: 'The page loads, from wherever it is served, and from here on the app is the page. That place still matters: it serves the scripts, so whoever controls it controls the app, and it is sent the address the login comes back to, with the code in it.'
				},
				{ text: 'The user wants something from the app, and the app needs them logged in first.' }
			],
			inPractice:
				'Which pages need a login is your code. For most of what follows a library does the work, and how much depends on the library: a framework integration does nearly all of it, and a low-level one leaves some checks to you.',
			practice: [
				example('authjs', true, 'does nearly all of it'),
				example('oauth4webapi', false, 'leaves you to call each step and pass it what to check')
			],
			links: [
				{
					diagram: 'setup',
					step: 'register-client',
					when: byHand,
					text: 'See how the app and the identity provider got to know each other'
				}
			]
		},
		{
			id: 'page-served',
			when: behindThePage,
			from: 'app',
			to: 'browser',
			kind: 'response',
			plain: 'The page',
			label: '200, the page',
			concept:
				'The page and its scripts. Here its own server sends them, though another host could, because serving them and keeping tokens are separate jobs.',
			fields: []
		},
		{
			id: 'session-check',
			when: behindThePage,
			from: 'browser',
			to: 'app',
			kind: 'request',
			plain: 'The page asks if anyone is logged in',
			label: 'GET /session',
			concept: 'The page holds nothing that could tell it, so it asks its server.',
			fields: []
		},
		{
			id: 'no-session',
			when: behindThePage,
			from: 'app',
			to: 'browser',
			kind: 'response',
			plain: 'Nobody yet',
			label: 'Not logged in',
			concept:
				'How this looks is up to the app. This server and page were written for the recording, and only the identity provider is someone else’s.',
			fields: [{ name: 'loggedIn', place: 'body', note: 'Whether a cookie came that it knows' }]
		},
		{
			id: 'bff-login',
			when: behindThePage,
			from: 'browser',
			to: 'app',
			kind: 'request',
			plain: 'The page sends the browser to its server',
			label: 'GET /login',
			concept:
				'The whole browser goes, and not a call from a script, because it is about to leave for the identity provider. From here the login is the one any app on a server has, because to the identity provider that is what this is.',
			fields: []
		},
		{
			id: 'generate-key',
			from: 'app',
			to: 'app',
			kind: 'internal',
			plain: 'The app makes a key pair',
			label: 'Generate a key pair',
			concept:
				'DPoP ties tokens to a key only this app holds, so at an API that checks the proof a stolen token is useless without the key.',
			inPractice: 'A library does this, if it supports DPoP. Not all of them do yet.',
			practice: [
				example('oauth4webapi', true, 'has DPoP, and you give it the key'),
				example('passport', false, 'has no DPoP')
			],
			when: dpop
		},
		{
			id: 'make-verifier',
			from: 'app',
			to: 'app',
			kind: 'internal',
			plain: 'The app makes up a one-time value',
			label: 'Generate the verifier and challenge',
			concept:
				'The app makes up a random value for this login, the verifier, and keeps it to itself. From it, it works out a fingerprint, the challenge, that cannot be turned back. Only the fingerprint goes through the browser.',
			inPractice: 'A library does this for you, often once you turn it on.',
			practice: [
				example('authjs', true, 'does this unless told otherwise'),
				example('passport', false, 'only with pkce: true and state: true')
			],
			when: pkce,
			fields: [
				{
					name: 'code_verifier',
					place: 'memory',
					note: 'Random, for this login only',
					artifact: 'verifier'
				},
				{
					name: 'code_challenge',
					place: 'memory',
					note: 'SHA-256 of the verifier',
					artifact: 'challenge'
				}
			]
		},
		{
			id: 'page-goes-to-log-in',
			when: inPage,
			from: 'app',
			to: 'app',
			kind: 'internal',
			plain: 'The page sends them to log in',
			label: 'Go to the identity provider',
			concept:
				'Its own script sends the browser to the identity provider. There is no server to answer with a redirect, so nothing crosses the network until the browser gets there.',
			inPractice:
				'A library does this, from the values you gave it in setup. Turn on its PKCE option as well, if it is not on by default.',
			practice: [example('oidcClientTs', true, 'with PKCE on by default')]
		},
		{
			id: 'redirect-to-idp',
			when: not(inPage),
			cites: [
				{
					source: 'rfc9700',
					section: '2.1.1',
					why: 'Section 2.1.1 is the current advice: public clients must use PKCE, and for confidential clients it is recommended.',
					when: not(pkce)
				}
			],
			from: 'app',
			to: 'browser',
			kind: 'response',
			plain: 'The app sends them to log in',
			label: '302 to the identity provider',
			concept:
				'The app sends the browser to the identity provider, because the password must never reach the app.',
			inPractice: [
				{ when: pkce, text: 'A library does this, from the values you gave it in setup.' },
				{
					text: 'A library does this, from the values you gave it in setup. Turn on its PKCE option as well, which current advice recommends for every app.'
				}
			],
			practice: [
				example('passport', true, 'from its authorizationURL and clientID options'),
				example('authjs', true, 'from the issuer and client ID')
			],
			fields: [{ name: 'code_challenge', place: 'query', artifact: 'challenge', when: pkce }]
		},
		{
			id: 'authorize',
			cites: [
				{
					source: 'rfc6749',
					section: '4.1.2.1',
					why: 'Section 4.1.2.1 says that with a wrong redirect address, the server should tell the user, and must not send the browser there.'
				},
				{
					source: 'rfc9700',
					section: '2.1',
					why: 'Section 2.1 says servers must compare redirect addresses by exact match, which is the current advice this step mentions.'
				},
				{
					source: 'rfc7636',
					section: '4.2',
					why: 'Section 4.2 has the two ways of making a challenge: plain, where it is the verifier itself, and S256.',
					when: pkce
				},
				{
					source: 'rfc9700',
					section: '2.1.1',
					why: 'Section 2.1.1 says to use a challenge method that does not give the verifier away, and that S256 is the only one that does not.',
					when: pkce
				}
			],
			from: 'browser',
			to: 'idp',
			kind: 'request',
			plain: 'The browser asks to log in',
			label: 'GET /authorize',
			concept: [
				{
					when: fromADocument,
					text: 'The browser asks the identity provider to log the user in and grant the app access. The client ID here is an address, and where to send the user back to gets checked against what the app’s document says.'
				},
				{
					when: oidc,
					text: 'The browser asks the identity provider to log the user in. The openid scope asks for proof of who that was as well. The identity provider first checks that the address to send the user back to is one registered in setup.'
				},
				{
					text: 'The browser asks the identity provider to log the user in and grant the app access. The identity provider first checks that the address to send the user back to is one registered in setup.'
				}
			],
			pitfall: {
				title: 'What if the address does not match?',
				shot: 'wrong-redirect',
				shows: "The identity provider's own error page, with no way back to the app.",
				text: 'The identity provider must not send the browser to that address, and should show the user an error. Otherwise an attacker could ask for the code to be sent to them, which is why current advice is an exact match.'
			},
			links: [
				{
					diagram: 'setup',
					step: 'register-client',
					when: byHand,
					text: 'See where the address was registered'
				}
			],
			fields: [
				{ name: 'response_type=code', place: 'query' },
				{
					name: 'client_id',
					place: 'query',
					note: 'The address of a document about the app, on HTTPS in a real one',
					when: fromADocument
				},
				{ name: 'client_id', place: 'query', when: not(fromADocument) },
				{
					name: 'redirect_uri',
					place: 'query',
					note: 'Must match what was registered in setup',
					when: all(not(is('address', 'other')), not(fromADocument))
				},
				{
					name: 'redirect_uri',
					place: 'query',
					note: 'Must match what the document says',
					when: fromADocument
				},
				{
					name: 'redirect_uri',
					place: 'query',
					note: 'Not one that was registered in setup',
					when: is('address', 'other')
				},
				{ name: 'state', place: 'query' },
				{ name: 'scope=openid', place: 'query', when: oidc },
				{ name: 'nonce', place: 'query', when: oidc },
				{
					name: 'scope=organization',
					place: 'query',
					note: 'Asks for which customer they are from to be in the token',
					when: companies
				},
				{
					name: 'dpop_jkt',
					place: 'query',
					note: 'Optional: ties the code to the key',
					when: dpop
				},
				{
					name: 'code_challenge',
					place: 'query',
					note: 'The identity provider keeps this with the code',
					artifact: 'challenge',
					when: pkce
				},
				{
					name: 'code_challenge_method=S256',
					place: 'query',
					note: 'How the fingerprint was made: a one-way hash, which is why it cannot be turned back. RFC 7636 also has plain, where the challenge is the verifier itself, and RFC 9700 says to use a method that does not expose it.',
					when: pkce
				}
			]
		},
		{
			id: 'address-refused',
			when: is('address', 'other'),
			last: true,
			cites: [
				{
					source: 'rfc6749',
					section: '4.1.2.1',
					why: 'Section 4.1.2.1 says that with a wrong redirect address, the server should tell the user, and must not send the browser there.'
				},
				{
					source: 'rfc9700',
					section: '2.1',
					why: 'Section 2.1 says servers must compare redirect addresses by exact match, which is the current advice this step mentions.'
				}
			],
			from: 'idp',
			to: 'browser',
			kind: 'response',
			plain: 'It refuses, and says so',
			label: '400 Invalid parameter: redirect_uri',
			page: {
				address: 'authorize',
				shows: "The identity provider's own error page, with no way back to the app.",
				shot: 'wrong-redirect'
			},
			concept:
				'This is where it stops. The address is not one registered for this app, so there is no login and no code. It does not send the browser back to the app either, because that address is the one it cannot trust, so the page says what is wrong and has no way back. What your app sent is in the address of this page, after redirect_uri.',
			inPractice:
				'Compare what your app sent with what is registered for this client, in the provider’s settings for it. Current advice is that they have to match exactly, so look at http or https, the port, and a slash at the end. Your app usually takes it from its own settings, so the fix is in those or in the registration.',
			links: [
				{
					diagram: 'setup',
					step: 'register-client',
					when: byHand,
					text: 'See where the address is registered'
				}
			]
		},
		{
			id: 'cimd-fetch',
			when: fromADocument,
			from: 'idp',
			to: 'app',
			kind: 'request',
			plain: 'The identity provider fetches the app’s document',
			label: 'GET the client_id address',
			concept:
				'The first time it sees this app, it fetches the address the client ID names, and goes by what it finds there. Later it may use a copy.',
			cites: [
				{
					source: 'cimd-draft',
					why: 'The draft has the server fetch the document when it sees a client ID that is an address, and lets it keep a copy.'
				}
			],
			links: [{ diagram: 'setup', step: 'cimd-host', text: 'See where this document came from' }],
			fields: []
		},
		{
			id: 'cimd-document',
			when: fromADocument,
			from: 'app',
			to: 'idp',
			kind: 'response',
			plain: 'What the document says',
			label: '200 with client metadata',
			concept:
				'This is what would otherwise have been registered by hand. Anyone can publish a document, so each server decides how far to trust one. The server recorded only goes on for domains it was told to trust.',
			pitfall: {
				title: 'What if the domain is not trusted?',
				text: 'The login stops, and the user sees an error. On the server recorded, a client ID on a domain it does not trust, or on plain HTTP, is refused before anything is fetched, and an address in the document on such a domain after.'
			},
			fields: [
				{
					name: 'client_id',
					place: 'body',
					note: 'The same address it was fetched from, on HTTPS in a real one'
				},
				{ name: 'client_name', place: 'body' },
				{ name: 'redirect_uris', place: 'body' },
				{ name: 'token_endpoint_auth_method', place: 'body', note: 'None, so it has no secret' },
				{ name: 'grant_types', place: 'body' },
				{ name: 'response_types', place: 'body' }
			]
		},
		{
			id: 'login-page',
			from: 'idp',
			to: 'browser',
			kind: 'response',
			plain: 'The login page',
			label: 'Login page',
			concept: 'The identity provider asks the user to prove who they are, on its own page.',
			page: {
				address: 'authorize',
				shows: "The identity provider's own page, asking for a username and a password.",
				shot: 'login',
				marks: ['redirect_uri', 'state']
			},
			when: not(broker)
		},
		{
			id: 'submit-credentials',
			from: 'browser',
			to: 'idp',
			kind: 'request',
			plain: 'The user enters their password',
			label: 'Submit credentials',
			concept: 'The user signs in at the identity provider. The app sees none of this.',
			when: not(broker),
			execute: { answer: 'redirect-with-code', when: not(consent) },
			fields: [{ name: 'username and password', place: 'body', artifact: 'password' }]
		},
		{
			id: 'directory-search',
			when: inADirectory,
			from: 'idp',
			to: 'directory',
			kind: 'request',
			plain: 'It looks the user up in the directory',
			label: 'LDAP search',
			concept:
				'The identity provider does not have the password to compare, so it asks the directory, with an account an admin gave it. The server recorded asked at every login it was tried on, and after the first it looks the user up by an ID it kept.',
			recordedAs:
				'From the log of an OpenLDAP server, because this is LDAP and not HTTP. Active Directory was not tried.',
			fields: [
				{
					name: 'filter',
					place: 'body',
					note: 'At a first login, the username from the login page'
				},
				{ name: 'attributes', place: 'body', note: 'What it wants to know about them' }
			]
		},
		{
			id: 'directory-found',
			when: inADirectory,
			from: 'directory',
			to: 'idp',
			kind: 'response',
			plain: 'Who that is',
			label: 'One entry',
			concept:
				'The server recorded keeps a copy of these details, because Import Users was on, and marks the password as being somewhere else.',
			recordedAs: "From the directory's own log, because this is LDAP and not HTTP.",
			fields: [{ name: 'entries', place: 'body', note: 'How many users that found' }]
		},
		{
			id: 'directory-bind',
			when: inADirectory,
			from: 'idp',
			to: 'directory',
			kind: 'request',
			plain: 'It tries the password on the directory',
			label: 'LDAP bind',
			concept:
				'The server recorded checks the password by logging in to the directory as the user. So the identity provider does handle the password, and passes it on. With another provider it never would, which is a difference between the two.',
			inPractice:
				'Your app does nothing different. Whoever runs this should use LDAPS or StartTLS, because the password crosses this connection, and in the recording it was not encrypted.',
			recordedAs:
				"From the directory's own log, because this is LDAP and not HTTP. The log leaves the password out, and it was seen crossing the connection.",
			fields: [
				{ name: 'mechanism', place: 'body', note: 'Simple, which sends the password itself' },
				{ name: 'password', place: 'body', artifact: 'password' }
			]
		},
		{
			id: 'directory-bound',
			when: inADirectory,
			from: 'directory',
			to: 'idp',
			kind: 'response',
			plain: 'The password is right',
			label: 'LDAP result 0',
			concept:
				'Right or not is all the answer says. From here on the login goes as it always does, with no new message for the browser or the app.',
			recordedAs: "From the directory's own log, because this is LDAP and not HTTP.",
			pitfall: {
				title: 'What if the directory is down?',
				text: 'Nobody in the directory can log in with a password, including people who logged in before, because it can only be checked there. The server recorded showed them "Unexpected error when handling authentication request to identity provider." Someone with a session stayed logged in, a refresh token still worked, and a user kept in the provider could still log in. A wrong password is different: it just gets the login page again.'
			},
			fields: []
		},
		{
			id: 'email-page',
			when: companies,
			from: 'idp',
			to: 'browser',
			kind: 'response',
			plain: 'A page that asks only for an email',
			label: 'Login page, email only',
			concept:
				'The identity provider cannot know who this is yet, or which company they are from, so it asks for the email first and nothing else.',
			page: {
				address: 'authorize',
				shows:
					"The identity provider's own page, with one field for a username or email and no password."
			}
		},
		{
			id: 'submit-email',
			when: companies,
			from: 'browser',
			to: 'idp',
			kind: 'request',
			plain: 'The user enters their email',
			label: 'Submit the email',
			concept:
				'Only the email goes. The identity provider has to know who this is, and which company they are from, before it can say where they log in.',
			fields: [{ name: 'username', place: 'body', note: 'The email their company gave them' }]
		},
		{
			id: 'find-company',
			when: companies,
			from: 'idp',
			to: 'idp',
			kind: 'internal',
			plain: 'It finds their company from the email',
			label: 'Find the organization',
			concept:
				'The identity provider takes the part after the @, finds the customer with that domain, and so the provider to send them to. Every other customer has a provider of its own too, and nothing about them is on this diagram.',
			inPractice:
				'Your app does nothing here. An admin adds each customer, with its domains and its provider, which is where a new customer starts. The other way is for your app to connect to each customer itself, which means it speaks SAML too, and that is not drawn here.',
			pitfall: {
				title: 'What if they already have a password here?',
				text: "Then they are not sent to their company. On the server recorded, someone at a customer's domain with an account and a password of ours got the usual page with every customer's button, logged in with that password, and had no customer in their token: their company was never asked, and they were not a member of it here."
			}
		},
		{
			id: 'redirect-to-upstream',
			group: 'brokered-login',
			from: 'idp',
			to: 'browser',
			kind: 'response',
			plain: [
				{ when: saml, text: 'A form that sends the browser to their company' },
				{ when: companies, text: 'Sent on to their company' },
				{ text: 'Sent on to the other provider' }
			],
			label: [
				{ when: saml, text: '200, a form that posts itself' },
				{ when: companies, text: '303 to their company' },
				{ text: '303 to the other provider' }
			],
			concept: [
				{
					when: saml,
					text: 'Their company was set up to take a request in a form, one of the ways SAML can travel. The page holds a signed request for a login, saying who asks and where to answer, and sends itself on as soon as it loads, so there is little to see.'
				},
				{
					text: 'The identity provider does not log the user in itself. It sends the browser on to the other provider.'
				}
			],
			page: {
				when: saml,
				address: 'redirect-to-upstream',
				shows:
					'A page with a form, which sends itself on as soon as it loads, so there is little to see.'
			},
			inPractice:
				'Nothing changes for an app that already uses this identity provider. It does not know this is happening.',
			when: broker
		},
		{
			id: 'upstream-authorize',
			group: 'brokered-login',
			from: 'browser',
			to: 'upstream',
			kind: 'request',
			page: {
				when: not(saml),
				address: 'upstream-authorize',
				shows: "The other provider's own login page. The app is nowhere on it.",
				shot: 'login-upstream',
				marks: ['client_id', 'redirect_uri']
			},
			plain: 'The browser asks to log in there',
			label: [{ when: saml, text: 'POST the SAML request' }, { text: 'GET /authorize' }],
			concept: [
				{
					when: saml,
					text: 'The browser posts the request to their company. It names the identity provider by the ID their company was given at setup.'
				},
				{
					text: 'The same request the app made, but now the identity provider is the client asking for a login.'
				}
			],
			when: broker,
			fields: [
				{ name: 'SAMLRequest', place: 'body', when: saml },
				{ name: 'RelayState', place: 'body', when: saml },
				{ name: 'response_type=code', place: 'query', when: not(saml) },
				{
					name: 'client_id',
					place: 'query',
					note: "The identity provider's own client ID at the upstream",
					when: not(saml)
				},
				{
					name: 'redirect_uri',
					place: 'query',
					note: "The identity provider's broker endpoint",
					when: not(saml)
				},
				{ name: 'state', place: 'query', when: not(saml) },
				{ name: 'scope=openid', place: 'query', when: not(saml) },
				{ name: 'nonce', place: 'query', when: not(saml) }
			]
		},
		{
			id: 'upstream-sign-in',
			group: 'brokered-login',
			from: 'browser',
			to: 'upstream',
			kind: 'request',
			plain: 'The user enters their password there',
			label: 'Sign in',
			concept:
				'The user signs in at the other provider. Neither the app nor the identity provider sees the password.',
			when: broker,
			// With SAML the answer is a page, and what it holds comes in the next request.
			execute: { answer: 'upstream-redirect-back', when: not(saml) },
			fields: [{ name: 'username and password', place: 'body', artifact: 'password' }]
		},
		{
			id: 'upstream-redirect-back',
			group: 'brokered-login',
			from: 'upstream',
			to: 'browser',
			kind: 'response',
			plain: [
				{ when: saml, text: 'Sent back with a signed answer' },
				{ text: 'Sent back with a code' }
			],
			label: [
				{ when: saml, text: '200, a form that posts itself' },
				{ text: '302 back with a code' }
			],
			concept: [
				{
					when: saml,
					text: 'Their company answers with another form that sends itself, and the answer is in it: an assertion saying who this is, in a response their provider signed. Sent this way there is no code to trade, so the browser carries the answer itself.'
				},
				{
					text: 'The other provider sends the browser back to the identity provider with a one-time code.'
				}
			],
			when: broker,
			fields: [
				{ name: 'code', place: 'query', when: not(saml) },
				{ name: 'state', place: 'query', when: not(saml) },
				{
					name: 'iss',
					place: 'query',
					note: 'Names the server this came from, so an app that uses more than one can tell which answered',
					when: not(saml)
				}
			]
		},
		{
			id: 'upstream-callback',
			group: 'brokered-login',
			from: 'browser',
			to: 'idp',
			kind: 'request',
			plain: [
				{ when: saml, text: 'The answer reaches the identity provider' },
				{ text: 'The code reaches the identity provider' }
			],
			label: [{ when: saml, text: 'POST the assertion' }, { text: 'Deliver the code' }],
			concept: [
				{
					when: saml,
					text: 'The browser posts the answer to the identity provider, which checks the signature with the certificate their company handed over at setup. Then it has who logged in, with nothing to trade.'
				},
				{ text: "The browser delivers the code to the identity provider's broker endpoint." }
			],
			when: broker,
			fields: [
				{
					name: 'SAMLResponse',
					place: 'body',
					artifact: 'assertion',
					note: 'In a response their provider signed. It was not encrypted, so whoever has it can read it',
					when: saml
				},
				{ name: 'RelayState', place: 'body', when: saml },
				{ name: 'code', place: 'query', when: not(saml) },
				{ name: 'state', place: 'query', when: not(saml) },
				{
					name: 'iss',
					place: 'query',
					note: 'Names the server this came from, so an app that uses more than one can tell which answered',
					when: not(saml)
				}
			]
		},
		{
			id: 'upstream-token-request',
			group: 'brokered-login',
			from: 'idp',
			to: 'upstream',
			kind: 'request',
			plain: 'It trades the code for tokens',
			label: 'POST /token',
			concept:
				'The identity provider trades the code for tokens, on a connection the browser never sees.',
			when: all(broker, not(saml)),
			execute: { answer: 'upstream-token-response', when: storedTokens },
			fields: [
				{ name: 'grant_type=authorization_code', place: 'body' },
				{ name: 'code', place: 'body' },
				{ name: 'redirect_uri', place: 'body' },
				{ name: 'client_id', place: 'body' },
				{ name: 'client_secret', place: 'body' }
			]
		},
		{
			id: 'upstream-token-response',
			group: 'brokered-login',
			from: 'upstream',
			to: 'idp',
			kind: 'response',
			plain: 'Tokens for the identity provider',
			label: 'Upstream tokens',
			concept:
				'These tokens belong to the identity provider. The app will get tokens the identity provider issues itself.',
			when: all(broker, not(saml)),
			fields: [
				{ name: 'access_token', place: 'body', artifact: 'upstream-token' },
				{ name: 'id_token', place: 'body' },
				{ name: 'token_type=Bearer', place: 'body' },
				{ name: 'expires_in', place: 'body' },
				{ name: 'refresh_token', place: 'body' },
				{ name: 'scope', place: 'body' }
			]
		},
		{
			id: 'store-upstream-tokens',
			group: 'brokered-login',
			from: 'idp',
			to: 'idp',
			kind: 'internal',
			plain: 'It keeps those tokens',
			label: 'Store upstream tokens',
			concept: [
				{
					when: apiV2,
					text: 'The identity provider keeps the upstream tokens, in the user session or the database.'
				},
				{
					text: 'The identity provider keeps the upstream tokens in its database, per user and upstream IdP.'
				}
			],
			when: storedTokens
		},
		{
			id: 'match-user',
			group: 'brokered-login',
			from: 'idp',
			to: 'idp',
			kind: 'internal',
			plain: 'It links this person to a user',
			label: 'Match or create the user',
			concept:
				'The identity provider links the external identity to a local user, creating one if needed.',
			when: broker
		},
		{
			id: 'consent-page',
			from: 'idp',
			to: 'browser',
			kind: 'response',
			plain: 'What the app is asking for',
			label: 'Consent page',
			page: {
				address: 'submit-credentials',
				shows:
					"The identity provider's own page, asking the user to agree to what the app asked for.",
				shot: 'consent'
			},
			concept: [
				{
					when: fromADocument,
					text: 'The identity provider asks the user whether this app may have this access. The server recorded asks here, though nobody turned this on and a default client is not asked. What it lists are scopes.'
				},
				{
					text: 'The identity provider asks the user whether this app may have this access. What it lists are scopes: each one names some access or some information. They come from what the app asked for and from how it was set up. This is between the user and the identity provider, and the app has no part in it.'
				}
			],
			pitfall: {
				title: 'What if the user says no?',
				text: 'The browser still goes back to the app, but with error=access_denied in place of a code. So the app has to expect this, and has nothing to trade.'
			},
			when: consent
		},
		{
			id: 'consent-grant',
			cites: [
				{
					source: 'rfc6749',
					section: '10.2',
					why: 'Section 10.2 says a server should not go through a repeated request with no user there, unless it has authenticated the client or can be sure some other way that the request comes from it. With no secret, it cannot authenticate the client.'
				}
			],
			from: 'browser',
			to: 'idp',
			kind: 'request',
			plain: 'The user agrees',
			label: 'Grant access',
			concept:
				'The user says yes. Many identity providers remember that for this user and this app, and do not ask again at the next login, though the spec advises care when the app has no secret.',
			when: consent,
			execute: { answer: 'redirect-with-code' },
			fields: [
				{
					name: 'accept',
					place: 'body',
					note: 'How this form says yes, which is up to the server'
				},
				{
					name: 'code',
					place: 'body',
					note: "The server's own login session, not the code in this flow"
				}
			]
		},
		{
			id: 'redirect-with-code',
			cites: [
				{
					source: 'rfc9207',
					why: 'This is what defines iss in this redirect, as a way to tell which server answered.'
				},
				{
					source: 'rfc9700',
					section: '2.1',
					why: 'Section 2.1 says an app that can talk to more than one server has to defend against mix-up, and that it should do so with iss.'
				},
				{
					source: 'rfc9700',
					section: '4.4',
					why: 'Section 4.4 is the mix-up attack, where an app that uses more than one provider is tricked into sending a code from one to another. Its main countermeasure is to check who answered, which is what iss is for.'
				},
				{
					source: 'rfc9700',
					section: '2.1.2',
					why: 'Section 2.1.2 is the current advice on the implicit grant: clients should not use it, or anything else that puts an access token in the redirect.'
				}
			],
			from: 'idp',
			to: 'browser',
			kind: 'response',
			plain: 'Sent back with a one-time code',
			label: '302 back with a code',
			concept:
				'The identity provider sets a cookie on its own address, so it will know this browser next time, and sends the browser back to the app with a short-lived, one-time code. This goes through the browser, where it can be seen, so it should not be a token.',
			pitfall: {
				title: 'Why not send the token here?',
				text: 'That is the implicit flow, and it is what apps in a browser used to do. The token then sits in the address, where browser history and anything running in the page can get at it, and it cannot be tied to the app that asked. Current advice is not to use it, though you will still see it offered.'
			},
			fields: [
				{ name: 'code', place: 'query', artifact: 'code' },
				{ name: 'state', place: 'query' },
				{
					name: 'iss',
					place: 'query',
					note: 'Names the server this came from, so an app that uses more than one can tell which answered'
				},
				{
					name: 'Set-Cookie',
					place: 'header',
					note: 'The session, on the address of the identity provider',
					artifact: 'session'
				}
			]
		},
		{
			id: 'attacker-steals-code',
			cites: [
				{
					source: 'rfc9700',
					section: '4.5.4',
					why: 'Section 4.5.4 is the limit of all this. Someone who can only read what goes by is stopped by PKCE or a nonce. Someone who can also change the request can make them match, and it says so.'
				}
			],
			from: 'browser',
			to: 'attacker',
			kind: 'request',
			plain: 'Someone else copies the code',
			label: 'Code intercepted',
			concept:
				'The code crosses the browser, so anything that can see that can copy it. This shows them getting there before the real app, which is the case that matters.',
			recordedAs:
				'The request the real app gets, drawn going to them as well. How someone gets a copy is not something a recording can show.',
			when: attacker,
			fields: [
				{ name: 'code', place: 'query', artifact: 'code' },
				{ name: 'state', place: 'query', note: 'Means nothing to them, and they can ignore it' },
				{ name: 'iss', place: 'query', note: 'Tells them where to take the code' }
			]
		},
		{
			id: 'attacker-opens-app',
			from: 'attacker',
			to: 'app',
			kind: 'request',
			channel: 'front',
			plain: 'They open the real app themselves',
			label: 'GET /',
			concept:
				'In their own browser, they start a login at the real app, as anyone can. They have no intention of finishing it. What they want is a login in progress, so that the app will take an answer for it.',
			when: handedToTheApp
		},
		{
			id: 'attacker-sent-to-login',
			from: 'app',
			to: 'attacker',
			kind: 'response',
			channel: 'front',
			plain: 'The app starts a login for them',
			label: '302 to the identity provider',
			concept: [
				{
					when: pkce,
					text: 'The app makes up a state and a verifier for this login, and keeps them with it. The challenge goes in this redirect, and it has nothing to do with the real user’s.'
				},
				{
					when: oidc,
					text: 'The app makes up a state and a nonce for this login, and keeps them with it. The nonce has nothing to do with the real user’s.'
				},
				{ text: 'The app makes up a state for this login, and keeps it with them.' }
			],
			when: handedToTheApp,
			fields: [
				{ name: 'response_type', place: 'query' },
				{
					name: 'client_id',
					place: 'query',
					note: 'The real app’s, because the real app sends this'
				},
				{ name: 'redirect_uri', place: 'query' },
				{ name: 'state', place: 'query', note: 'For the login they started' },
				{
					name: 'code_challenge',
					place: 'query',
					note: 'For the login they started, and not the real user’s',
					chip: 'their challenge',
					when: pkce
				},
				{
					name: 'code_challenge_method',
					place: 'query',
					note: 'How the challenge was made',
					when: pkce
				},
				{ name: 'scope', place: 'query', when: oidc },
				{
					name: 'nonce',
					place: 'query',
					note: 'For the login they started',
					chip: 'their nonce',
					when: oidc
				}
			]
		},
		{
			id: 'attacker-hands-code',
			from: 'attacker',
			to: 'app',
			kind: 'request',
			channel: 'front',
			cites: [
				{
					source: 'rfc9700',
					section: '4.5',
					why: 'Section 4.5 is this attack, authorization code injection. A secret does not stop it, because it is the real app that ends up using the code.'
				}
			],
			plain: 'They hand it the stolen code',
			label: 'GET /callback',
			concept:
				'They go to the app’s own callback address, with the real user’s code and the state of their own login. So the state matches: it ties an answer to the browser that started the login, and this browser did.',
			when: handedToTheApp,
			fields: [
				{ name: 'code', place: 'query', artifact: 'code', note: 'The real user’s' },
				{ name: 'state', place: 'query', note: 'Their own, so it matches' }
			]
		},
		{
			id: 'handed-token-request',
			from: 'app',
			to: 'idp',
			kind: 'request',
			plain: 'The app trades the code, with its secret',
			label: 'POST /token',
			concept: [
				{
					when: pkce,
					text: 'The app does what it always does. It sends its secret, and the verifier for the login it thinks this is, which is the one they started.'
				},
				{
					text: 'The app does what it always does, and sends its secret. So the secret proves this really is the app, and it is.'
				}
			],
			when: handedToTheApp,
			fields: [
				{ name: 'grant_type=authorization_code', place: 'body' },
				{ name: 'code', place: 'body', artifact: 'code' },
				{ name: 'redirect_uri', place: 'body' },
				{
					name: 'Authorization: Basic',
					place: 'header',
					note: 'The client ID and secret',
					artifact: 'secret'
				},
				{
					name: 'code_verifier',
					place: 'body',
					note: 'For the login they started, and not the real user’s',
					chip: 'their verifier',
					when: pkce
				}
			]
		},
		{
			id: 'handed-token-response',
			from: 'idp',
			to: 'app',
			kind: 'response',
			cites: [
				{
					source: 'rfc9700',
					section: '4.5.3.1',
					why: 'Section 4.5.3.1 is why this fails: the verifier is right for the app, and the code is tied to a challenge that does not match it.',
					when: pkce
				}
			],
			plain: [
				{ when: pkce, text: 'Refused: the verifier does not match' },
				{ text: 'Tokens for the real user' }
			],
			label: [{ when: pkce, text: '400 invalid_grant' }, { text: '200 with tokens' }],
			concept: [
				{
					when: pkce,
					text: 'The code was tied to the real user’s challenge when it was issued, and this verifier belongs to the login they started. This is what PKCE adds that a secret cannot: it ties a code to the login it came from.'
				},
				{
					text: 'The server has no way to tell. The code is good and the secret is good, so the tokens come back, for the real user, to the app, in a login someone else started.'
				}
			],
			when: handedToTheApp,
			fields: [
				{ name: 'access_token', place: 'body', artifact: 'access-token', when: not(pkce) },
				{ name: 'token_type=Bearer', place: 'body', when: not(pkce) },
				{ name: 'id_token', place: 'body', artifact: 'id-token', when: all(oidc, not(pkce)) },
				{ name: 'expires_in', place: 'body', when: not(pkce) },
				{ name: 'refresh_token', place: 'body', artifact: 'refresh-token', when: not(pkce) },
				{ name: 'scope', place: 'body', when: not(pkce) },
				{
					name: 'error=invalid_grant',
					place: 'body',
					note: 'The code cannot be used this way',
					when: pkce
				},
				{ name: 'error_description', place: 'body', note: 'Which check it failed', when: pkce }
			]
		},
		{
			id: 'handed-nonce-check',
			from: 'app',
			to: 'app',
			kind: 'internal',
			cites: [
				{
					source: 'rfc9700',
					section: '4.5.3.2',
					why: 'Section 4.5.3.2 is why this works: the nonce in the ID token is the real user’s, and the one kept for this login is not. It is up to the app to compare them.'
				}
			],
			plain: 'The app checks the ID token, and it is for another login',
			label: 'Compare the nonce',
			concept:
				'The ID token has the nonce from the real user’s login, and the app made a different one for this login. So it stops here. That only helps if the check is really done and no token is used before it, and it happens after the server has already handed over the tokens.',
			when: stoppedByNonce,
			fields: [{ name: 'nonce', place: 'memory', note: 'The one made for this login' }]
		},
		{
			id: 'attacker-handed-answer',
			from: 'app',
			to: 'attacker',
			kind: 'response',
			channel: 'front',
			plain: [
				{ when: pkce, text: 'The login fails' },
				{ when: stoppedByNonce, text: 'The app refuses' },
				{ text: 'They are logged in as the real user' }
			],
			label: [{ when: any(pkce, stoppedByNonce), text: '400' }, { text: '200' }],
			concept: [
				{
					when: pkce,
					text: 'They get nothing. They still hold a code, and it is no use to them.'
				},
				{
					when: stoppedByNonce,
					text: 'They get nothing, because the app did the check. The tokens went no further than the app.'
				},
				{
					text: 'The app now takes this browser for the real user’s. They never saw a token and did not need to. The secret did nothing, because the real app was the one using it.'
				}
			],
			when: handedToTheApp
		},
		{
			id: 'attacker-token-request',
			from: 'attacker',
			to: 'idp',
			kind: 'request',
			plain: 'They try to trade it for tokens',
			label: 'POST /token',
			execute: { answer: 'attacker-token-response', when: attackerWins },
			concept: [
				{
					when: all(not(confidential), pkce),
					text: 'They send the code to the identity provider, as the real app would, but without the verifier, which they never saw.'
				},
				{
					when: not(confidential),
					text: 'They send the code to the identity provider, exactly as the real app would. This app has no secret, so nothing marks this request as not coming from it.'
				},
				{
					text: 'They send the code to the identity provider, as the real app would, but they do not have the secret to send with it.'
				}
			],
			when: all(attacker, not(handedToTheApp)),
			fields: [
				{ name: 'grant_type=authorization_code', place: 'body' },
				{ name: 'code', place: 'body', artifact: 'code' },
				{ name: 'redirect_uri', place: 'body' },
				{ name: 'client_id', place: 'body', note: 'Not a secret, and it was in the login address' }
			]
		},
		{
			id: 'attacker-token-response',
			cites: [
				{
					source: 'rfc6749',
					section: '5.2',
					why: 'Section 5.2 lists the errors a token request can get, and invalid_client is the one for a client that did not prove who it is.'
				}
			],
			from: 'idp',
			to: 'attacker',
			kind: 'response',
			plain: [
				{ when: attackerWins, text: 'They get the tokens' },
				{ when: stoppedByPkce, text: 'Refused: they have no verifier' },
				{ text: 'Refused: they have no secret' }
			],
			label: [
				{ when: attackerWins, text: '200 with tokens' },
				{ when: stoppedByPkce, text: '400 invalid_grant' },
				{ text: '401 unauthorized_client' }
			],
			concept: [
				{
					when: attackerWins,
					text: 'This app has no secret, and nothing ties the code to it, so the identity provider has no way to tell. They now hold what the app was supposed to get, including a refresh token, which gets them new access tokens without the user, and nothing has told the user.'
				},
				{
					when: stoppedByPkce,
					text: 'The code was tied to a challenge when it was issued, and only the verifier matches it. That was never in a redirect, so someone who only saw the code does not have it.'
				},
				{
					when: pkce,
					text: 'Without the secret, the identity provider refuses them. Handing it to the real app from their own browser gets them nothing, because the verifier does not match, though on this server it uses up the code.'
				},
				{
					text: 'Without the secret, the identity provider refuses them. But they could still hand it to the real app from their own browser, so that it trades the code for them, which is what PKCE stops.'
				}
			],
			when: all(attacker, not(handedToTheApp)),
			fields: [
				{ name: 'access_token', place: 'body', artifact: 'access-token', when: attackerWins },
				{ name: 'token_type=Bearer', place: 'body', when: attackerWins },
				{ name: 'id_token', place: 'body', artifact: 'id-token', when: all(attackerWins, oidc) },
				{ name: 'expires_in', place: 'body', when: attackerWins },
				{ name: 'refresh_token', place: 'body', artifact: 'refresh-token', when: attackerWins },
				{ name: 'scope', place: 'body', when: attackerWins },
				{
					name: 'error=invalid_grant',
					place: 'body',
					note: 'The code cannot be used this way',
					when: stoppedByPkce
				},
				{
					name: 'error=unauthorized_client',
					place: 'body',
					note: 'The client did not prove who it is. The spec calls this invalid_client, and this server says this instead',
					when: stoppedBySecret
				},
				{
					name: 'error_description',
					place: 'body',
					note: 'Which check it failed',
					when: not(attackerWins)
				}
			]
		},
		{
			id: 'attacker-api-request',
			from: 'attacker',
			to: 'api',
			kind: 'request',
			plain: 'They call the API as the user',
			label: 'GET /resource',
			concept: 'A bearer token works for whoever holds it, so this is all it takes.',
			when: attackerWins,
			fields: [{ name: 'Authorization: Bearer', place: 'header', artifact: 'access-token' }]
		},
		{
			id: 'attacker-api-response',
			from: 'api',
			to: 'attacker',
			kind: 'response',
			plain: 'The API answers them',
			label: '200 with the resource',
			concept:
				"The API has no way to tell either. As far as it knows, this is the user's app, doing what the user allowed.",
			when: attackerWins
		},
		{
			id: 'callback',
			cites: [
				{
					source: 'rfc6749',
					section: '10.12',
					why: 'Section 10.12 is what state is for: without it, someone can get their own code accepted in a victim’s browser, and the app then works with the attacker’s account.'
				},
				{
					source: 'rfc9700',
					section: '4.7',
					why: 'Section 4.7 is the same attack in the current advice, and says that PKCE or a nonce can stand in for state, once the app has made sure the server supports PKCE.'
				}
			],
			from: 'browser',
			to: 'app',
			kind: 'request',
			page: {
				address: 'callback',
				shows:
					'Whatever the app answers here, a page of its own or a move straight on to another. What matters is the address, because the code is in it, for anything that can see the address.',
				marks: ['code', 'state']
			},
			plain: 'The code reaches the app',
			label: 'Deliver the code',
			concept: [
				{
					when: all(not(confidential), not(pkce), dpop),
					text: "The code reaches the app. It has just been through the browser, with no secret and no PKCE behind it. What protects it is that the login named this app's key, so the code alone gets nobody the tokens."
				},
				{
					when: all(not(confidential), not(pkce)),
					text: 'The code reaches the app. With no secret and no PKCE, this code is all anyone needs to get the tokens, and it has just been through the browser.'
				},
				{
					when: pkce,
					text: 'The code reaches the app. On its own it is worth little, which is the point.'
				},
				{
					text: 'The code reaches the app. Someone with only the code cannot trade it without the secret, though that is not quite the end of it, as the question on the next step says.'
				}
			],
			inPractice:
				'Many frameworks handle this, some only once you turn it on, so check. The address has to be the one you registered, exactly. With a low-level library, comparing state with what this browser was given is your code. Do not skip it.',
			practice: [
				example('springSecurity', true, 'compares state without being asked'),
				example('passport', false, 'only compares state with state: true')
			],
			fields: [
				{ name: 'code', place: 'query', artifact: 'code' },
				{ name: 'state', place: 'query', note: 'Must match what the app sent' },
				{
					name: 'iss',
					place: 'query',
					note: 'Names the server this came from, so an app that uses more than one can tell which answered'
				}
			]
		},
		{
			id: 'token-request',
			cites: [
				{
					source: 'rfc10017',
					section: '6.3.3.1',
					why: 'Section 6.3.3.1 says a secret that ships with an app in the browser should not be treated as a secret, and that a server must not take it as proof of who the client is.',
					when: not(confidential)
				},
				{
					source: 'rfc9700',
					section: '2.1.1',
					why: 'Section 2.1.1 is the current advice: public clients must use PKCE, and for confidential clients it is recommended.',
					when: all(not(confidential), not(pkce), dpop)
				},
				{
					source: 'rfc9449',
					section: '10',
					why: 'Section 10 is how a login can name a key with dpop_jkt, which is what ties the code to it. Without that, or a proof on a pushed request as in section 10.1, nothing does.',
					when: all(not(confidential), not(pkce), dpop)
				}
			],
			from: 'app',
			to: 'idp',
			kind: 'request',
			plain: 'The app trades the code for tokens',
			label: 'POST /token',
			// With no token sent on or a changed one, nothing later uses what this returns.
			execute: {
				answer: 'token-response',
				when: all(stillGoing, not(sends('none')), not(sends('changed')))
			},
			inPractice: [
				{
					when: confidential,
					text: 'A library does this. Keep the secret in your configuration, and out of your code.'
				},
				{ text: 'A library does this. There is no secret to keep, because there could not be one.' }
			],
			practice: [
				example('passport', true, 'once it has the code', confidential),
				example('openidClient', true, 'when you call its code grant', confidential),
				example('oidcClientTs', true, 'does this in the browser, with PKCE', not(confidential))
			],
			concept: [
				{
					when: all(inPage, pkce),
					text: 'The page trades the code for tokens, on a call from its own script. So this one goes through the browser too, which is the difference an app in the page makes. It has no secret to prove which app it is. The verifier, which was never in a redirect, is what someone who only saw the code does not have.'
				},
				{
					when: inPage,
					text: 'The page trades the code for tokens, on a call from its own script, so this one goes through the browser too. It has no secret to prove which app it is, so anyone holding the code could do this, which is the gap PKCE closes.'
				},
				{
					when: all(confidential, pkce),
					text: 'The app trades the code for tokens on a direct call. Its secret proves which app it is, and the verifier proves it started this very login. Neither was ever in a redirect.'
				},
				{
					when: confidential,
					text: 'The app trades the code for tokens on a direct call, and proves who it is with its secret. Someone who only saw the code in the browser cannot do this.'
				},
				{
					when: pkce,
					text: 'The app trades the code for tokens on a direct call. A public client has no secret to prove who it is, but it does have the verifier, which was never in a redirect. Someone who only saw the code cannot do this. If the app runs in the browser, this call comes from its own JavaScript.'
				},
				{
					when: dpop,
					text: "The app trades the code for tokens on a direct call. A public client has no secret to prove who it is. But the login named this app's key, so this takes a proof signed with that key, which someone who only saw the code does not have. If the app runs in the browser, this call comes from its own JavaScript."
				},
				{
					text: 'The app trades the code for tokens on a direct call. A public client has no secret to prove who it is, so anyone holding the code could do this too, which is the gap PKCE closes. If the app runs in the browser, this call comes from its own JavaScript.'
				}
			],
			pitfall: {
				title: 'What if someone else gets hold of the code?',
				text: [
					{
						when: all(not(confidential), not(pkce), dpop),
						text: "The login named this app's key, so the identity provider refuses the code with no proof, or with a proof from any other key. PKCE is still the advice, because that only helps when the login names the key: without it, they can use a key of their own, even with a setting that requires a proof."
					},
					{
						when: all(not(confidential), not(pkce)),
						text: 'They can do exactly this. Nothing in this request shows it comes from the real app, so whoever intercepted the code gets the tokens. This is the attack PKCE was made for.'
					},
					{
						when: not(confidential),
						text: 'If all they can do is read the code, they get nothing. They would also need the verifier, which is only being sent now, and the challenge they may have seen cannot be turned back into it. Someone who can also change the login request as it goes by can get round this, though that takes much more.'
					},
					{
						when: pkce,
						text: 'They get nothing, even by handing the code to the real app from their own browser. The app would send the verifier of that other login, and it does not match.'
					},
					{
						when: oidc,
						text: 'They cannot do this alone, because they do not have the secret. They could hand the code to the real app from their own browser, so that it trades the code for them. The nonce lets the app notice this, if it checks. PKCE stops it at the identity provider.'
					},
					{
						text: 'They cannot do this alone, because they do not have the secret. But they can hand the code to the real app from their own browser, so that it trades the code for them, and then they are in as the user. PKCE stops this as well.'
					}
				]
			},
			fields: [
				{ name: 'grant_type=authorization_code', place: 'body' },
				{ name: 'code', place: 'body', artifact: 'code' },
				{ name: 'redirect_uri', place: 'body' },
				{
					name: 'Origin',
					place: 'header',
					note: 'Which page this is from. The browser only hands it the answer if the server allows that page',
					when: inPage
				},
				{ name: 'client_id', place: 'body', when: not(confidential) },
				{
					name: 'Authorization: Basic',
					place: 'header',
					note: 'The client ID and secret',
					artifact: 'secret',
					when: confidential
				},
				{
					name: 'code_verifier',
					place: 'body',
					note: 'Sent now, and never in a redirect',
					artifact: 'verifier',
					when: pkce
				},
				{
					name: 'DPoP',
					place: 'header',
					note: 'A proof signed with the key',
					artifact: 'proof',
					when: dpop
				}
			]
		},
		{
			id: 'nonce-challenge',
			cites: [
				{
					source: 'rfc9449',
					section: '8',
					why: 'Section 8 is how a server hands out a nonce for a proof to include. The server these messages were recorded from did not do this, so it comes from here alone.'
				}
			],
			group: 'nonce-retry',
			from: 'idp',
			to: 'app',
			kind: 'response',
			plain: 'The server asks for a fresh proof',
			label: '400 use_dpop_nonce',
			concept: 'The server rejects the proof and hands the app a nonce to sign into the next one.',
			when: all(all(dpop, nonce), stillGoing),
			specOnly: 'RFC 9449 section 8',
			fields: [
				{ name: 'error=use_dpop_nonce', place: 'body' },
				{ name: 'DPoP-Nonce', place: 'header' }
			]
		},
		{
			id: 'token-request-retry',
			cites: [
				{
					source: 'rfc9449',
					section: '8',
					why: 'Section 8 is how a server hands out a nonce for a proof to include. The server these messages were recorded from did not do this, so it comes from here alone.'
				}
			],
			group: 'nonce-retry',
			from: 'app',
			to: 'idp',
			kind: 'request',
			plain: 'The app tries again',
			label: 'POST /token',
			concept: 'The same request again, with a new proof that includes the nonce.',
			when: all(all(dpop, nonce), stillGoing),
			specOnly: 'RFC 9449 section 8',
			fields: [{ name: 'DPoP', place: 'header', note: 'A proof with the nonce', artifact: 'proof' }]
		},
		{
			id: 'real-app-refused',
			cites: [
				{
					source: 'rfc6749',
					section: '4.1.2',
					why: 'Section 4.1.2 says a code used more than once must be refused, and that the server should revoke what was issued from it. It does not say whether a try that failed counts as a use.'
				},
				{
					source: 'rfc9700',
					section: '4.2.4',
					why: 'Section 4.2.4 says a code must be invalidated after its first use at the token endpoint, as a defence against someone using it later.'
				}
			],
			from: 'idp',
			to: 'app',
			kind: 'response',
			plain: 'The real app is refused',
			label: '400 invalid_grant',
			inPractice: 'A library reports this as an error. Your app should offer to start again.',
			practice: [example('passport', true, 'as a TokenError')],
			concept: [
				{
					when: pkce,
					text: 'A code works once, and this server counts a failed try as that once. The specs say a code is good for one use, and not whether a failed try counts. So PKCE kept the tokens from them, but someone with the code can still spoil the login. The user has to start again.'
				},
				{
					when: stoppedByNonce,
					text: 'A code works once, and it has been used, so the real user gets nothing and sees an error. The nonce kept someone else out, and did not save this login.'
				},
				{
					when: handedToTheApp,
					text: 'A code works once, and it has been used, so the real user gets nothing and sees an error, while someone else is logged in as them. The specs advise the server to cancel what that code got, which does not end the session the app has already started.'
				},
				{
					text: 'A code works once, and it has been used, so the app gets nothing and the user sees an error. The specs advise the server to cancel what that code got, and this one does. But someone else has had the tokens by then, and an API that only looks at the token itself goes on taking them until they expire.'
				}
			],
			when: codeGone,
			fields: [
				{ name: 'error=invalid_grant', place: 'body', note: 'The code cannot be used this way' },
				{ name: 'error_description', place: 'body', note: 'Which check it failed' }
			]
		},
		{
			id: 'check-verifier',
			from: 'idp',
			to: 'idp',
			kind: 'internal',
			plain: 'It checks the one-time value',
			label: 'Check the verifier',
			concept:
				'The identity provider works out the fingerprint of the verifier it just got, and compares it with the challenge it kept with this code. They only match for whoever started this login.',
			when: all(pkce, stillGoing),
			fields: [
				{
					name: 'code_verifier',
					place: 'memory',
					note: 'Its SHA-256 has to match',
					artifact: 'verifier'
				},
				{ name: 'code_challenge', place: 'memory', artifact: 'challenge' }
			]
		},
		{
			id: 'token-response',
			cites: [
				{
					source: 'rfc10017',
					section: '6.1.2.3',
					why: 'Section 6.1.2.3 is the two ways to keep them: all on the server, or in a signed cookie, which it says suits this better than usual, because the tokens are what can be revoked.',
					when: behindThePage
				},
				{
					source: 'rfc10017',
					section: '5.1.3',
					why: 'Section 5.1.3 is a script in the page starting a login of its own, which keeping tokens somewhere better does not stop. It takes a session at the server, and a server that allows it silently.',
					when: not(confidential)
				},
				{
					source: 'rfc10017',
					section: '6.1.4.1',
					why: 'Section 6.1.4.1 says a script in the page can still send requests through a backend for frontend, and that nothing stops that except keeping the script out.',
					when: not(confidential)
				},
				{
					source: 'rfc10017',
					section: '8.5',
					why: 'Section 8.5 goes through localStorage, sessionStorage and IndexedDB, and says none of them can fully stop a script running in the page from taking tokens.',
					when: not(confidential)
				},
				{
					source: 'rfc10017',
					section: '6.1.4.3',
					why: 'Section 6.1.4.3 strongly recommends a backend that keeps the tokens for business applications and those that handle personal data, and section 6.3.4.3 does not recommend keeping them in the browser for those.',
					when: not(confidential)
				}
			],
			when: stillGoing,
			from: 'idp',
			to: 'app',
			kind: 'response',
			plain: [{ when: oidc, text: 'An access token and an ID token' }, { text: 'An access token' }],
			label: [{ when: oidc, text: 'Access token and ID token' }, { text: 'Access token' }],
			concept: [
				{
					when: behindThePage,
					text: 'The tokens stop here, at the server, and no script in the page can get them, which is what the server is for.'
				},
				{
					when: inPage,
					text: 'The tokens are in the page now, and so in the browser, which the rest of this flow took care to avoid. On a server they would be out of reach of the user’s browser. Here, any script running in this page can reach them, and that is the price of having no server.'
				},
				{
					when: companies,
					text: 'The same token another provider would give, with one thing more: which customer they are from, because the app asked. An app that keeps each customer apart can go by that. It is the same whether their provider spoke SAML or OpenID Connect.'
				},
				{
					when: inADirectory,
					text: 'Nearly the same token as ever. Real runs gave the same claim names with the user in a directory, kept in the provider, or at another provider. One value differed: here it said the email address was not verified, because nobody had said to trust the directory.'
				},
				{
					when: fromADocument,
					text: 'The access token lets the app call the API, and is meant for the API to read. No refresh token comes here, because the document did not ask for one.'
				},
				{
					when: oidc,
					text: 'The access token is for the API, and the ID token tells the app who logged in. Here a refresh token comes too, to get a new access token later without the user.'
				},
				{
					text: 'The access token lets the app call the API, and is meant for the API to read. Here a refresh token comes too, to get a new one later without the user.'
				}
			],
			inPractice: [
				{
					when: behindThePage,
					text: 'Keep them with the session you start next, on the server or in an encrypted cookie. RFC 10017 section 6.1.2.3 weighs the two.'
				},
				{
					when: inPage,
					text: 'A library takes these, and they are in the page now. A script running in that page can reach whatever the page can, and can often start a login of its own for new tokens. A worker narrows the first and not the second. That is why current advice for business apps, and anything sensitive or personal, is a server behind the app that keeps them, called a backend for frontend. A script can still act through the open page.'
				},
				{
					when: not(confidential),
					text: 'A library takes these. If your app runs in the browser, so do they: the diagram draws the two apart to show the redirects, but a script running in that page can reach whatever the page can, and can often start a login of its own for new tokens. A worker narrows the first and not the second. That is why current advice for business apps, and anything sensitive or personal, is a server behind the app that keeps them, called a backend for frontend. A script can still act through the open page.'
				},
				{
					when: dpop,
					text: 'A library takes these. Where they are kept is up to you. At an API that checks the proof a stolen token is no use without the key, but code running inside your app can use the key while it is there.'
				},
				{
					text: 'A library takes these. Where they are kept is up to you, and worth thinking about, because whoever gets them can use them.'
				}
			],
			practice: [
				example('passport', true, 'hands them to the function you give it', confidential),
				example('openidClient', true, 'returns them from its code grant', confidential),
				example(
					'oidcClientTs',
					true,
					'keeps them in sessionStorage unless you tell it otherwise',
					not(confidential)
				),
				example('oauth4webapi', false, 'leaves where they are kept to you', not(confidential))
			],
			fields: [
				{ name: 'access_token', place: 'body', artifact: 'access-token' },
				{ name: 'token_type=Bearer', place: 'body', when: bearer },
				{ name: 'token_type=DPoP', place: 'body', when: dpop },
				{ name: 'id_token', place: 'body', artifact: 'id-token', when: oidc },
				{ name: 'expires_in', place: 'body' },
				{
					name: 'refresh_token',
					place: 'body',
					artifact: 'refresh-token',
					note: 'Gets a new access token later, without the user',
					when: not(fromADocument)
				},
				{ name: 'scope', place: 'body' }
			]
		},
		{
			id: 'set-session',
			when: behindThePage,
			cites: [
				{
					source: 'rfc10017',
					section: '6.1.3.2',
					why: 'Section 6.1.3.2 lists what this cookie has to have: Secure and HttpOnly, and SameSite=Strict and the prefix unless there is a reason not to.'
				}
			],
			from: 'app',
			to: 'browser',
			kind: 'response',
			plain: 'The browser gets a cookie, not tokens',
			label: '302 to the page, with a cookie',
			concept:
				'All the browser gets is a cookie that only means something to this server, and HttpOnly keeps scripts from reading it. The page then loads again, asks again and gets a yes, which the diagram leaves out.',
			fields: [
				{
					name: 'Set-Cookie',
					place: 'header',
					artifact: 'app-session',
					note: 'HttpOnly, Secure and SameSite=Strict'
				},
				{ name: 'location', place: 'header', note: 'Back to the page' }
			]
		},
		{
			id: 'validate-id-token',
			cites: [
				{
					source: 'oidc-core',
					why: 'Section 3.1.3.7 is the list of checks, and its step 6 is what lets an app skip the signature when the token came straight from the token endpoint over TLS.'
				}
			],
			from: 'app',
			to: 'app',
			kind: 'internal',
			plain: 'The app checks the ID token',
			label: 'Validate the ID token',
			concept:
				'The app checks issuer, audience, expiry and nonce before it trusts the token, and usually the signature. The spec lets it skip that one when the token came straight from the token endpoint over TLS.',
			largerJob:
				'Your own session for the user is yours to write, and so is logging out of it. Neither is on this diagram.',
			inPractice:
				'A framework may do most of this. Parts of it can be left to you, such as the nonce, so read what yours does, and do not skip any of it.',
			practice: [
				example('authjs', false, 'keeps and checks a nonce only once you add it to its checks'),
				example(
					'oauth4webapi',
					false,
					'checks the nonce you pass it, and leaves the signature to a separate call'
				)
			],
			when: all(oidc, stillGoing),
			fields: [
				{ name: 'iss', place: 'token' },
				{ name: 'aud', place: 'token' },
				{ name: 'exp', place: 'token' },
				{ name: 'nonce', place: 'token' }
			]
		},
		{
			id: 'userinfo-request',
			from: 'app',
			to: 'idp',
			kind: 'request',
			plain: 'The app asks about the user',
			label: 'GET /userinfo',
			concept: 'The app can ask for more about the user, using the access token.',
			inPractice: 'Often not needed, because the ID token may already say enough.',
			when: all(oidc, stillGoing),
			fields: [
				{ name: 'Authorization: Bearer', place: 'header', artifact: 'access-token', when: bearer },
				{ name: 'Authorization: DPoP', place: 'header', artifact: 'access-token', when: dpop },
				{
					name: 'DPoP',
					place: 'header',
					note: 'A proof tied to this access token',
					artifact: 'proof',
					when: dpop
				}
			]
		},
		{
			id: 'userinfo-response',
			from: 'idp',
			to: 'app',
			kind: 'response',
			plain: 'Details about the user',
			label: 'User claims',
			concept:
				'Who the user is, limited to the scopes granted, which are not always those asked for.',
			when: all(oidc, stillGoing),
			fields: [{ name: 'sub', place: 'body' }]
		},
		{
			id: 'page-calls-api',
			when: behindThePage,
			cites: [
				{
					source: 'rfc10017',
					section: '6.1',
					why: 'Section 6.1 says what a script here can and cannot do: it can send requests through this server, and has no tokens to take and no way to read this cookie.'
				}
			],
			from: 'browser',
			to: 'app',
			kind: 'request',
			plain: 'The page asks its server for the data',
			label: 'GET /api/resource',
			concept:
				'The script calls its own server, and the browser adds the cookie by itself. The script sees neither the cookie nor a token.',
			pitfall: {
				title: 'What can a script in this page still do?',
				text: 'In a real page, a script could not read this cookie and found no token. But it can do what the page does: the same request worked from a script. So a script that gets in can act for the user through this server, and take what comes back, but finds no cookie or token to take away.'
			},
			fields: [
				{
					name: 'Cookie',
					place: 'header',
					artifact: 'app-session',
					note: 'The browser adds it by itself'
				}
			]
		},
		{
			id: 'api-request',
			when: stillGoing,
			from: 'app',
			to: 'api',
			kind: 'request',
			plain: [
				{ when: behindThePage, text: 'The server calls the API with the token' },
				{ when: sends('none'), text: 'The app calls the API with no token' },
				{ when: sends('expired'), text: 'The app calls the API with an old token' },
				{ when: sends('changed'), text: 'The app calls the API with a changed token' },
				{ when: sends('elsewhere'), text: 'The token goes to another API' },
				{ when: sends('noscope'), text: 'The app asks for more than the token allows' },
				{ text: 'The app calls the API with the token' }
			],
			label: [
				{ when: sends('elsewhere'), text: 'GET /my-api/resource' },
				{ when: sends('noscope'), text: 'GET /contacts' },
				{ text: 'GET /resource' }
			],
			concept: [
				{
					when: behindThePage,
					text: 'The server takes the cookie off, puts the token on, and calls the API. The API gets what it always gets, and knows nothing about the page.'
				},
				{
					when: sends('none'),
					text: 'The app calls the API without a token, as happens when a library has not added one or the app has none yet.'
				},
				{
					when: sends('expired'),
					text: 'The app sends the token it has, which has run out. Everything else about it is still right.'
				},
				{
					when: sends('changed'),
					text: 'The token has been changed along the way. It still looks like a token, and the part that says who it is for still reads the same.'
				},
				{
					when: sends('elsewhere'),
					text: 'The app sends its token to an API that expects its own name in it. This is what happens with a new API, until someone arranges for tokens to name it.'
				},
				{
					when: sends('noscope'),
					text: 'The token is fine, and this API asks for a scope it does not have.'
				},
				{
					when: dpop,
					text: 'The app sends the token and a new proof, which shows it holds the key the token is tied to.'
				},
				{ text: 'The app sends the access token. Whoever holds a bearer token can use it.' }
			],
			inPractice:
				'This part is your code, though a library can add the token to each call for you.',
			practice: [example('oauth4webapi', true, 'with protectedResourceRequest')],
			fields: [
				{
					name: 'Authorization: Bearer',
					place: 'header',
					artifact: 'access-token',
					when: all(bearer, not(sends('none')))
				},
				{ name: 'Authorization: DPoP', place: 'header', artifact: 'access-token', when: dpop },
				{
					name: 'DPoP',
					place: 'header',
					note: 'A proof tied to this access token',
					artifact: 'proof',
					when: dpop
				}
			]
		},
		{
			id: 'api-check-token',
			when: stillGoing,
			from: 'api',
			to: 'api',
			kind: 'internal',
			plain: 'The API checks the token',
			label: 'Check the token',
			concept: [
				{
					when: dpop,
					text: 'The API checks the token, and that the proof was signed with the key the token names.'
				},
				{
					text: 'The API checks the signature, who issued the token, that it has not expired, and who it is for. An opaque token it has to ask the server about.'
				}
			],
			inPractice: [
				{
					when: dpop,
					text: 'An ordinary JWT library or gateway checks the token and ignores the proof, so it takes a stolen DPoP token sent as Bearer. Checking the proof takes a library that does DPoP. Which scopes a request needs is yours to set, in code or on the gateway. Whether this user may see this thing is your code, and a valid token says neither.'
				},
				{
					text: 'A library or a gateway does this, once you tell it the issuer and who tokens have to be for. Forget the second, and a token meant for another API gets in. Which scopes a request needs is yours to set, in code or on the gateway. Whether this user may see this thing is your code, and a valid token says neither.'
				}
			],
			practice: [
				example('springSecurity', true, 'can check the proof', dpop),
				example('awsJwt', false, 'lists no proof among what it checks', dpop),
				example('jose', true, 'when you pass it the issuer and audience', bearer),
				example('awsJwt', true, 'once it is given them', bearer)
			],
			pitfall: {
				title: 'What if one of these checks fails?',
				text: 'The API answers 401 when it does not accept the token: none at all, expired, changed, from another issuer, or for someone else. It answers 403 when it accepts the token and still refuses, often because the token does not allow this. So a new token can help with a 401, and usually will not help with a 403.'
			},
			links: [
				{ diagram: 'setup', step: 'configure-api', text: 'See how the API was told who to trust' }
			],
			fields: [
				{ name: 'iss', place: 'token' },
				{ name: 'aud', place: 'token' },
				{ name: 'exp', place: 'token' },
				{
					name: 'scope',
					place: 'token',
					note: 'What the token allows, to compare with what this request needs'
				},
				{ name: 'cnf.jkt', place: 'token', note: 'The key the token is tied to', when: dpop }
			]
		},
		{
			id: 'api-response',
			when: stillGoing,
			from: 'api',
			to: 'app',
			kind: 'response',
			plain: [
				{ when: sends('none'), text: 'The API asks for a token' },
				{ when: sends('expired'), text: 'The API refuses: the token has expired' },
				{ when: sends('changed'), text: 'The API refuses: the signature is wrong' },
				{ when: sends('elsewhere'), text: 'The API refuses: the token is for someone else' },
				{ when: sends('noscope'), text: 'The API refuses: the token does not allow this' },
				{ text: 'The API answers' }
			],
			label: [
				{ when: sends('none'), text: '401 with no error' },
				{ when: sends('noscope'), text: '403 insufficient_scope' },
				{ when: apiRefuses, text: '401 invalid_token' },
				{ text: '200 with the resource' }
			],
			concept: [
				{
					when: sends('none'),
					text: 'A 401, and WWW-Authenticate says which kind of token it wants, with no error, because there was no token to be wrong.'
				},
				{
					when: sends('expired'),
					text: 'A 401 with invalid_token. This is the one an app expects: it gets a new access token, and tries again.'
				},
				{
					when: sends('changed'),
					text: 'A 401 with invalid_token. Anyone can read a token like this and change what it says, but they cannot sign the result, which is what this check is for.'
				},
				{
					when: sends('elsewhere'),
					text: 'A 401 with invalid_token. The signature is good and it has not expired, and it is still refused, because it does not name this API. Otherwise a token meant for one API would open every other one. The fix is at the identity provider, which has to put this API’s name in the tokens it issues for this app.'
				},
				{
					when: sends('noscope'),
					text: 'A 403 with insufficient_scope. The API accepts this token and it does not allow this, so a new token of the same kind will not help. The app would have to ask for more, and the user may have to agree.'
				},
				{ text: 'The app has what it came for, and the user never gave it their password.' }
			],
			inPractice: [
				{
					when: apiRefuses,
					text: 'Read the WWW-Authenticate header on the answer first: it says what kind of token the API wants, and what was wrong with this one, if there was one. A new token of the same kind only helps if this one ran out.'
				},
				{ text: 'What it answers is up to whoever built that API, which may be you.' }
			],
			fields: [
				{
					name: 'WWW-Authenticate',
					place: 'header',
					note: 'What kind of token it wants, and what was wrong with this one',
					when: apiRefuses
				}
			]
		},
		{
			id: 'page-gets-answer',
			when: behindThePage,
			from: 'app',
			to: 'browser',
			kind: 'response',
			plain: 'The server hands the answer to the page',
			label: '200, what the API said',
			concept:
				'The page has the data and still no token. Every call it makes goes this way, so this server now has to be up and in reach for all of them.',
			fields: [{ name: 'resource', place: 'body', note: 'What the API said, passed on' }]
		},
		{
			id: 'company-turns-off',
			when: leaves,
			from: 'upstream',
			to: 'upstream',
			kind: 'internal',
			plain: 'Their company turns their account off',
			label: 'Account disabled',
			concept:
				"They have left, and their company's admins turn their account off at their own provider. On the server recorded, nothing told the identity provider, and nothing told the app."
		},
		{
			id: 'left-api-request',
			when: leaves,
			from: 'app',
			to: 'api',
			kind: 'request',
			plain: 'The app calls the API, with the same token',
			label: 'GET /resource',
			concept: 'The app still has the token it got before they left, and uses it.',
			fields: [{ name: 'Authorization: Bearer', place: 'header', artifact: 'access-token' }]
		},
		{
			id: 'left-api-response',
			when: leaves,
			from: 'api',
			to: 'app',
			kind: 'response',
			plain: 'It still answers',
			label: '200 with the resource',
			concept:
				'Nothing in the token changed, and it has not run out, so an API that checks the token alone answers as before.',
			fields: [{ name: 'resource', place: 'body', note: 'What the API answers' }]
		},
		{
			id: 'left-refresh',
			when: leaves,
			from: 'app',
			to: 'idp',
			kind: 'request',
			plain: 'The app asks for new tokens',
			label: 'POST /token',
			concept: 'The app uses its refresh token, as it would any time the access token runs out.',
			fields: [
				...refreshFields,
				{ name: 'refresh_token', place: 'body', artifact: 'refresh-token' }
			]
		},
		{
			id: 'left-refresh-response',
			when: leaves,
			from: 'idp',
			to: 'app',
			kind: 'response',
			plain: 'New tokens, without asking their company',
			label: '200, new tokens',
			concept:
				'The identity provider does not ask their company for a refresh. The session it keeps for them is still good, so it gives new tokens.',
			fields: [
				{ name: 'access_token', place: 'body', artifact: 'access-token' },
				{ name: 'token_type=Bearer', place: 'body' },
				{ name: 'expires_in', place: 'body' },
				{ name: 'refresh_token', place: 'body', artifact: 'refresh-token' },
				{ name: 'scope', place: 'body' }
			]
		},
		{
			id: 'login-again',
			when: leaves,
			from: 'browser',
			to: 'idp',
			kind: 'request',
			plain: 'The same browser logs in again',
			label: 'GET /authorize',
			concept: 'Later, the same browser comes back to log in to the app.',
			fields: [
				{ name: 'response_type=code', place: 'query' },
				{ name: 'client_id', place: 'query' },
				{ name: 'redirect_uri', place: 'query' },
				{ name: 'state', place: 'query' },
				{ name: 'scope=organization', place: 'query' },
				{
					name: 'Cookie',
					place: 'header',
					artifact: 'session',
					note: 'The session from before, which is why nobody is asked'
				}
			]
		},
		{
			id: 'code-again',
			when: leaves,
			last: true,
			from: 'idp',
			to: 'browser',
			kind: 'response',
			plain: 'A code, without asking their company',
			label: '302 back with a code',
			concept:
				'The identity provider still has a session for this browser, so it does not ask their company at all, and sends a code straight back.',
			pitfall: {
				title: 'When does it stop?',
				text: [
					{
						text: 'When the session in the middle ends, or its admins end it. The server recorded, as it comes, ends a session after 30 minutes unused, or 10 hours in all, and its guide says a refresh counts as using it, so an app that keeps refreshing keeps it going. A browser with no session went to their company, whose page said "Account is disabled, contact your administrator.", and the identity provider never heard back. The account it kept for them stayed enabled.'
					}
				]
			},
			fields: [
				{ name: 'code', place: 'query' },
				{ name: 'state', place: 'query' },
				{ name: 'iss', place: 'query' }
			]
		},
		{
			id: 'token-runs-out',
			when: refreshes,
			from: 'app',
			to: 'app',
			kind: 'time',
			plain: 'Later, the access token runs out',
			label: 'Later: the access token expires',
			concept:
				'Nothing is sent here, because time is what happens. An access token is short-lived on purpose: anyone holding one can use it, so a stolen one should not be good for long.',
			inPractice:
				'The token response said how long it has, in expires_in. How long that is depends on the server. In this recording it was set to 3 seconds, so that a real run could get here.',
			fields: []
		},
		{
			id: 'api-request-again',
			when: refreshes,
			from: 'app',
			to: 'api',
			kind: 'request',
			plain: 'The app calls the API with the same token',
			label: 'GET /resource',
			concept: 'The app has no reason to think anything changed, and sends the token it has.',
			inPractice:
				'Some libraries go by expires_in and get a new token before this happens. You still want to handle the refusal, because an API can refuse a token for other reasons.',
			practice: [
				example('springSecurity', true, 'gets a new one ahead of time, 60 seconds by default'),
				example('openidClient', false, 'has a function for it, which you call')
			],
			fields: [{ name: 'Authorization: Bearer', place: 'header', artifact: 'access-token' }]
		},
		{
			id: 'api-refused',
			when: refreshes,
			from: 'api',
			to: 'app',
			kind: 'response',
			plain: 'The API refuses: the token has expired',
			label: '401 invalid_token',
			concept:
				'A 401 with invalid_token. For an app this is the refusal with a simple answer: get a new access token, and try again.',
			fields: [{ name: 'WWW-Authenticate', place: 'header', note: 'What was wrong with this one' }]
		},
		{
			id: 'refresh-request',
			when: refreshes,
			from: 'app',
			to: 'idp',
			kind: 'request',
			plain: 'The app sends its refresh token',
			label: 'POST /token',
			concept: [
				{
					when: confidential,
					text: 'The app sends the refresh token and its secret straight to the identity provider. Nothing goes through the browser, so the user sees nothing: no redirect, and no page.'
				},
				{
					text: 'The app sends the refresh token straight to the identity provider. There is no redirect, so the user sees nothing. If the app runs in the browser, this call comes from the page, and so could anything else running there.'
				}
			],
			execute: { answer: 'refresh-response' },
			fields: [
				...refreshFields,
				{ name: 'refresh_token', place: 'body', artifact: 'refresh-token' }
			]
		},
		{
			id: 'refresh-response',
			when: refreshes,
			from: 'idp',
			to: 'app',
			kind: 'response',
			plain: 'A new access token and a new refresh token',
			label: '200 with new tokens',
			concept: [
				{
					when: oidc,
					text: 'A new access token, so the app can carry on, and here a new ID token and a new refresh token to keep in place of the old one. A server does not have to send those two. The user never noticed.'
				},
				{
					text: 'A new access token, so the app can carry on, and here a new refresh token to keep in place of the old one. A server does not have to send one. The user never noticed.'
				}
			],
			fields: [
				{ name: 'access_token', place: 'body', artifact: 'access-token' },
				{ name: 'token_type=Bearer', place: 'body' },
				{ name: 'id_token', place: 'body', artifact: 'id-token', when: oidc },
				{ name: 'expires_in', place: 'body' },
				{ name: 'refresh_token', place: 'body', artifact: 'refresh-token' },
				{ name: 'scope', place: 'body' }
			]
		},
		{
			id: 'api-request-new',
			when: refreshes,
			from: 'app',
			to: 'api',
			kind: 'request',
			plain: 'The app calls the API with the new token',
			label: 'GET /resource',
			concept: 'The same call again, which is all the app wanted.',
			fields: [{ name: 'Authorization: Bearer', place: 'header', artifact: 'access-token' }]
		},
		{
			id: 'api-response-new',
			when: refreshes,
			from: 'api',
			to: 'app',
			kind: 'response',
			plain: 'The API answers',
			label: '200 with the resource',
			concept: 'It works, and the user was not part of any of it, which is the point.',
			fields: []
		},
		{
			id: 'refresh-again',
			when: refreshes,
			from: 'app',
			to: 'idp',
			kind: 'request',
			plain: 'The old refresh token is sent again',
			label: 'POST /token',
			concept: [
				{
					when: confidential,
					text: 'The app would not normally do this. It is what someone with a copy of the old refresh token would try. From an app with a secret they would need the secret as well, because the request has to carry it.'
				},
				{
					text: 'The app would not normally do this. It is what someone with a copy of the old refresh token would try. An app with no secret has nothing else to show, so this request is all they need.'
				}
			],
			fields: [
				...refreshFields,
				{
					name: 'refresh_token',
					place: 'body',
					note: 'The one from before, already used',
					artifact: 'refresh-token'
				}
			]
		},
		{
			id: 'refresh-again-response',
			cites: [
				{
					source: 'rfc9700',
					section: '2.2.2',
					why: 'Section 2.2.2 says refresh tokens for public clients must be sender-constrained or use rotation, which is what this step is about.'
				}
			],
			when: refreshes,
			from: 'idp',
			to: 'app',
			kind: 'response',
			plain: [
				{ when: reuseEnds, text: 'Refused: this one has been used' },
				{ text: 'It still works' }
			],
			label: [{ when: reuseEnds, text: '400 invalid_grant' }, { text: '200 with new tokens' }],
			concept: [
				{
					when: reuseEnds,
					text: 'Refused, because here each refresh token works once. A second use means a copy exists, or the app sent it twice, and the server cannot tell which, so this also ends things for the newest one.'
				},
				{
					when: not(confidential),
					text: 'It still works, though a new one came back last time, which looks as if this one was finished with. So someone who copied a refresh token from an app with no secret gets new access tokens without the user, and nothing has told the user.'
				},
				{
					text: 'It still works, though a new one came back last time, which looks as if this one was finished with. So a copy stays useful to anyone who also has the secret.'
				}
			],
			inPractice:
				"Whether it works is up to the server. RFC 9700 says a public client's refresh tokens have to work only once or be tied to the sender, so check what yours does.",
			fields: [
				{ name: 'access_token', place: 'body', artifact: 'access-token', when: not(reuseEnds) },
				{ name: 'token_type=Bearer', place: 'body', when: not(reuseEnds) },
				{ name: 'expires_in', place: 'body', when: not(reuseEnds) },
				{ name: 'refresh_token', place: 'body', artifact: 'refresh-token', when: not(reuseEnds) },
				{ name: 'scope', place: 'body', when: not(reuseEnds) },
				{
					name: 'error=invalid_grant',
					place: 'body',
					note: 'This refresh token cannot be used',
					when: reuseEnds
				},
				{ name: 'error_description', place: 'body', when: reuseEnds }
			]
		},
		{
			id: 'refresh-newest',
			when: reuseEnds,
			from: 'app',
			to: 'idp',
			kind: 'request',
			plain: 'The app sends its newest refresh token',
			label: 'POST /token',
			concept:
				'Now the real app carries on, with the refresh token it was given last, which has never been used.',
			fields: [
				...refreshFields,
				{ name: 'refresh_token', place: 'body', artifact: 'refresh-token' }
			]
		},
		{
			id: 'refresh-newest-response',
			when: reuseEnds,
			from: 'idp',
			to: 'app',
			kind: 'response',
			plain: 'Refused too: the app has to start a new login',
			label: '400 invalid_grant',
			concept:
				'Refused as well, though nothing is wrong with this one. The identity provider cannot tell which of the two is the thief, so it stops them both. The app has to start a new login. With a session still in the browser, the user may not even be asked for a password, so this ends the app’s session and not theirs at the identity provider.',
			fields: [
				{ name: 'error=invalid_grant', place: 'body', note: 'This refresh token cannot be used' },
				{ name: 'error_description', place: 'body' }
			]
		},
		{
			id: 'second-open-app',
			when: secondApp,
			from: 'browser',
			to: 'second-app',
			kind: 'request',
			plain: [
				{ when: secondIsFresh, text: 'The user opens a second app, in another browser' },
				{ text: 'The user opens a second app' }
			],
			label: 'Open the second app',
			concept: [
				{
					when: secondIsFresh,
					text: 'The same user, but in a browser that has never been to the identity provider, so it has no session to send.'
				},
				{
					text: 'Later, in the same browser, the user opens another app that uses the same identity provider.'
				}
			],
			inPractice:
				'Each app is registered on its own, with a client ID of its own. Nothing else connects them.'
		},
		{
			id: 'second-redirect-to-idp',
			when: secondApp,
			from: 'second-app',
			to: 'browser',
			kind: 'response',
			plain: 'It sends them to log in',
			label: '302 to the identity provider',
			concept:
				'It knows nothing about the first app or any login, so it starts exactly as the first one did.'
		},
		{
			id: 'second-authorize',
			when: secondApp,
			from: 'browser',
			to: 'idp',
			kind: 'request',
			plain: [
				{ when: secondIsFresh, text: 'The browser asks, and has nothing to send along' },
				{ text: 'The browser asks to log in, and its session goes along' }
			],
			label: 'GET /authorize',
			concept: [
				{
					when: secondIsFresh,
					text: 'An ordinary login request, from a browser with no cookie. With prompt=none the app says not to show a form, whatever happens.'
				},
				{
					when: secondInsists,
					text: 'An ordinary login request, and the cookie goes along. With prompt=login the app says that a session is not good enough this time.'
				},
				{
					text: 'An ordinary login request, with its own client ID. The browser adds the cookie, because this is the address that set it. The app does not see that happen.'
				}
			],
			inPractice: [
				{
					when: secondInsists,
					text: 'This request crosses the browser, which can change it. So for anything that matters, also check auth_time in the ID token.'
				},
				{ when: secondIsFresh, text: 'An app asks for this itself, by adding prompt=none.' },
				{ text: 'Your app does nothing different here.' }
			],
			fields: [
				{ name: 'response_type=code', place: 'query' },
				{ name: 'client_id', place: 'query' },
				{ name: 'redirect_uri', place: 'query' },
				{ name: 'state', place: 'query' },
				{ name: 'scope=openid', place: 'query', when: oidc },
				{ name: 'nonce', place: 'query', when: oidc },
				{ name: 'prompt=login', place: 'query', when: secondInsists },
				{ name: 'prompt=none', place: 'query', when: secondIsFresh },
				{
					name: 'Cookie',
					place: 'header',
					note: 'Sent to the identity provider, and nowhere else',
					artifact: 'session',
					when: secondGetsACode
				}
			]
		},
		{
			id: 'idp-recognises',
			when: secondApp,
			from: 'idp',
			to: 'idp',
			kind: 'internal',
			plain: [
				{ when: secondIsFresh, text: 'It does not know this browser' },
				{ when: secondInsists, text: 'It knows this browser, but asks' },
				{ text: 'It knows this browser, so no form' }
			],
			label: [
				{ when: secondIsFresh, text: 'No session' },
				{ when: secondInsists, text: 'Session, but the app insists' },
				{ text: 'Session found' }
			],
			concept: [
				{
					when: secondIsFresh,
					text: 'There is no session, and it was told not to ask, so it cannot log anyone in.'
				},
				{
					when: secondInsists,
					text: 'It finds the session, and because the app insisted it asks for the password all the same. An app does this before something important, such as changing a password.'
				},
				{
					text: 'This is single sign-on. It finds the session, so the user has logged in already, and there is nothing to ask. Your app does nothing for this: it starts a login as it always does, and the answer simply comes sooner.'
				}
			],
			fields: []
		},
		{
			id: 'second-login-page',
			when: secondInsists,
			from: 'idp',
			to: 'browser',
			kind: 'response',
			plain: 'The login page, again',
			label: 'Login page',
			concept: 'The form the session would have saved them from.',
			page: {
				address: 'second-authorize',
				shows:
					"The identity provider's own page again, asking for the password though it knows who this is.",
				shot: 'login-again',
				marks: ['prompt']
			}
		},
		{
			id: 'second-submit-credentials',
			when: secondInsists,
			from: 'browser',
			to: 'idp',
			kind: 'request',
			plain: 'The user enters their password again',
			label: 'Submit credentials',
			concept:
				'Here only the password, because it knows who they are. It still goes to the identity provider and nowhere else.',
			fields: [
				{ name: 'password', place: 'body', artifact: 'password' },
				{
					name: 'Cookie',
					place: 'header',
					note: 'Sent to the identity provider, and nowhere else',
					artifact: 'session'
				}
			]
		},
		{
			id: 'second-redirect-with-code',
			when: secondApp,
			from: 'idp',
			to: 'browser',
			kind: 'response',
			plain: [
				{ when: secondIsFresh, text: 'Sent back with login_required, and no code' },
				{ when: remembered, text: 'Sent back with a code, and no password' },
				{ text: 'Sent back with a code' }
			],
			label: [
				{ when: secondIsFresh, text: '302 error=login_required' },
				{ text: '302 back with a code' }
			],
			concept: [
				{
					when: secondIsFresh,
					text: 'The app is told that someone would have to log in, which here is because this browser has no session. This is how an app can check quietly, without showing anyone a form.'
				},
				{
					when: remembered,
					text: 'A code of its own, for this app. The user saw a redirect or two, and nothing to fill in. Everything that was the login is not on this part of the diagram.'
				},
				{ text: 'A code of its own, for this app.' }
			],
			fields: [
				{ name: 'code', place: 'query', artifact: 'code', when: secondGetsACode },
				{
					name: 'error=login_required',
					place: 'query',
					note: 'Someone would have to log in, and it was told not to ask',
					when: secondIsFresh
				},
				{ name: 'state', place: 'query' },
				{
					name: 'iss',
					place: 'query',
					note: 'Names the server this came from, so an app that uses more than one can tell which answered'
				},
				{
					name: 'Set-Cookie',
					place: 'header',
					note: 'The session again, with a new value',
					artifact: 'session',
					when: secondGetsACode
				}
			]
		},
		{
			id: 'second-callback',
			when: secondApp,
			from: 'browser',
			to: 'second-app',
			kind: 'request',
			page: {
				address: 'second-callback',
				shows: "The second app's own page, whatever it shows. What matters is the address.",
				marks: ['code', 'error']
			},
			plain: [
				{ when: secondIsFresh, text: 'The answer reaches the app' },
				{ text: 'The code reaches the app' }
			],
			label: [{ when: secondIsFresh, text: 'Deliver the answer' }, { text: 'Deliver the code' }],
			concept: [
				{
					when: secondIsFresh,
					text: 'The app learns that someone would have to log in, and can decide what to do about it, such as showing a login button.'
				},
				{ text: 'The app gets the code, and no session. It never sees the cookie.' }
			],
			fields: [
				{ name: 'code', place: 'query', artifact: 'code', when: secondGetsACode },
				{ name: 'error=login_required', place: 'query', note: 'Passed on', when: secondIsFresh },
				{ name: 'state', place: 'query' },
				{
					name: 'iss',
					place: 'query',
					note: 'Names the server this came from, so an app that uses more than one can tell which answered'
				}
			]
		},
		{
			id: 'second-token-request',
			when: secondGetsACode,
			from: 'second-app',
			to: 'idp',
			kind: 'request',
			plain: 'The app trades the code for tokens',
			label: 'POST /token',
			concept: 'With its own client ID and secret.',
			fields: [
				{ name: 'grant_type=authorization_code', place: 'body' },
				{ name: 'code', place: 'body', artifact: 'code' },
				{ name: 'redirect_uri', place: 'body' },
				{
					name: 'Authorization: Basic',
					place: 'header',
					note: 'The client ID and secret',
					artifact: 'secret'
				}
			]
		},
		{
			id: 'second-token-response',
			when: secondGetsACode,
			from: 'idp',
			to: 'second-app',
			kind: 'response',
			plain: [
				{ when: oidc, text: 'Its own tokens, from the same login' },
				{ text: 'Its own tokens' }
			],
			label: [{ when: oidc, text: 'Access token and ID token' }, { text: 'Access token' }],
			concept: [
				{
					when: all(oidc, remembered),
					text: 'Tokens of its own, and not the ones the first app got. Here the two ID tokens name the same session and the same login time, and each names its own app.'
				},
				{ text: 'Tokens of its own, and not the ones the first app got.' }
			],
			fields: [
				{ name: 'access_token', place: 'body', artifact: 'access-token' },
				{ name: 'token_type=Bearer', place: 'body' },
				{
					name: 'id_token',
					place: 'body',
					note: 'Here its sid and auth_time match the first app, and its aud is this app',
					artifact: 'id-token',
					when: all(oidc, remembered)
				},
				{
					name: 'id_token',
					place: 'body',
					note: 'Its aud is this app',
					artifact: 'id-token',
					when: all(oidc, not(remembered))
				},
				{ name: 'expires_in', place: 'body' },
				{ name: 'refresh_token', place: 'body', artifact: 'refresh-token' },
				{ name: 'scope', place: 'body' }
			]
		},
		{
			id: 'logout-start',
			when: logsOut,
			from: 'browser',
			to: 'app',
			kind: 'request',
			plain: 'The user presses log out',
			label: 'GET /logout',
			concept:
				'The user wants to be logged out. There are two sessions to end: the one the app keeps for itself, and the one on the identity provider. Ending one does not by itself end the other.',
			inPractice: 'This is your own route, and what it does is up to you.'
		},
		{
			id: 'app-forgets',
			when: logsOut,
			from: 'app',
			to: 'app',
			kind: 'internal',
			plain: 'The app forgets the user',
			label: 'End its own session',
			concept:
				'The app clears what it keeps for this user, such as its own cookie and the tokens. That says nothing to the identity provider, and forgetting a token does not cancel it.',
			pitfall: {
				title: 'What if it stops here?',
				text: 'The user looks logged out of this app, but the identity provider still knows the browser. So the next login asks nothing, and they are straight back in.'
			},
			fields: []
		},
		{
			id: 'logout-redirect',
			when: logsOut,
			from: 'app',
			to: 'browser',
			kind: 'response',
			plain: 'It sends the browser to log out',
			label: '302 to the end session address',
			concept:
				'To end the other session, the app sends the browser to the identity provider, because that is where its cookie goes. The ID token goes along to say who this is, so here it does cross the browser.',
			pitfall: {
				title: 'What if the app sends no ID token?',
				shot: 'logout-question',
				shows: "The identity provider's own page, asking whether the user meant to log out.",
				text: 'The identity provider cannot be sure who is asking, so it has to ask the user whether to log out. Without it, it will not send the browser back either, unless it has some other way to trust the address.'
			},
			fields: [
				{
					name: 'id_token_hint',
					place: 'query',
					note: 'Says who is logging out, and from which app',
					artifact: 'id-token'
				},
				{
					name: 'post_logout_redirect_uri',
					place: 'query',
					note: 'Where to come back to, which has to be registered'
				},
				{
					name: 'state',
					place: 'query',
					note: 'The app’s own value, which comes back with the user so it can pick up where it left off'
				}
			]
		},
		{
			id: 'end-session',
			when: logsOut,
			from: 'browser',
			to: 'idp',
			kind: 'request',
			plain: 'The browser asks to log out, and its session goes along',
			label: 'GET end_session_endpoint',
			concept: 'The cookie goes along, as it does with any request to this address.',
			fields: [
				{
					name: 'id_token_hint',
					place: 'query',
					note: 'Says who is logging out, and from which app',
					artifact: 'id-token'
				},
				{
					name: 'post_logout_redirect_uri',
					place: 'query',
					note: 'Where to come back to, which has to be registered'
				},
				{
					name: 'state',
					place: 'query',
					note: 'The app’s own value, which comes back with the user so it can pick up where it left off'
				},
				{
					name: 'Cookie',
					place: 'header',
					note: 'Sent to the identity provider, and nowhere else',
					artifact: 'session'
				}
			]
		},
		{
			id: 'session-ended',
			when: logsOut,
			from: 'idp',
			to: 'idp',
			kind: 'internal',
			plain: 'It ends the session',
			label: 'End the session',
			concept:
				'The session is over, so it has gone from under the browser and the identity provider. The tokens are still there. An access token does not know the session ended, and the logout specifications say nothing about access tokens.',
			ends: ['session'],
			fields: []
		},
		{
			id: 'backchannel-logout',
			when: all(logsOut, secondApp),
			from: 'idp',
			to: 'second-app',
			kind: 'request',
			plain: 'It tells the second app',
			label: 'POST logout_token',
			concept:
				'An app that registered an address is told right away and directly, with a signed token saying who logged out, and clears what it holds for them. Its next login asks again, because the session it relied on has gone. An app that registered no address keeps them logged in until it next asks, which may be a while. There is also a front-channel way, through hidden pages in the browser, which was not tried here.',
			fields: [{ name: 'logout_token', place: 'body', note: 'Signed, and says who logged out' }]
		},
		{
			id: 'backchannel-response',
			when: all(logsOut, secondApp),
			from: 'second-app',
			to: 'idp',
			kind: 'response',
			plain: 'It says it has logged them out',
			label: '200',
			concept: 'That is all the identity provider needs to hear.',
			fields: []
		},
		{
			id: 'logout-redirect-back',
			when: logsOut,
			from: 'idp',
			to: 'browser',
			kind: 'response',
			plain: 'Sent back to the app',
			label: '302 back to the app',
			concept: 'The cookie is emptied, and the browser goes back to the address the app gave.',
			fields: [
				{
					name: 'state',
					place: 'query',
					note: 'The app’s own value, which comes back with the user so it can pick up where it left off'
				},
				{ name: 'Set-Cookie', place: 'header', note: 'Empties the session cookie' }
			]
		},
		{
			id: 'logged-out',
			when: logsOut,
			from: 'browser',
			to: 'app',
			kind: 'request',
			plain: 'The user is back, and logged out',
			label: 'Back at the app',
			concept: 'As far as the user can tell, that is the end of it.',
			fields: [
				{
					name: 'state',
					place: 'query',
					note: 'The app’s own value, which comes back with the user so it can pick up where it left off'
				}
			]
		},
		{
			id: 'token-after-logout',
			when: logsOut,
			from: 'app',
			to: 'api',
			kind: 'request',
			plain: 'The same token, at an API that only looks at it',
			label: 'GET /resource',
			concept:
				'The app has forgotten this token, but suppose someone has a copy. An API can check a token like this by looking at it, as the first call here did.',
			fields: [{ name: 'Authorization: Bearer', place: 'header', artifact: 'access-token' }]
		},
		{
			id: 'token-after-logout-response',
			when: logsOut,
			from: 'api',
			to: 'app',
			kind: 'response',
			plain: 'It still works',
			label: '200 with the resource',
			concept:
				'Its signature is good and it has not expired, so this API has no reason to refuse it, and will not until it expires. That is one reason to keep access tokens short-lived.',
			fields: []
		},
		{
			id: 'asks-after-logout',
			when: logsOut,
			from: 'app',
			to: 'api',
			kind: 'request',
			plain: 'The same token, at an API that asks the server',
			label: 'GET /asks/resource',
			concept: 'The same token again, at an API that does not go by the token alone.',
			fields: [{ name: 'Authorization: Bearer', place: 'header', artifact: 'access-token' }]
		},
		{
			id: 'introspect',
			when: logsOut,
			from: 'api',
			to: 'idp',
			kind: 'request',
			plain: 'The API asks the identity provider about it',
			label: 'POST /introspect',
			concept:
				'The API sends the token to the identity provider and asks whether it is still good. That is a call for every request it wants to be sure about, which is why many APIs do not.',
			fields: [
				{
					name: 'token',
					place: 'body',
					note: 'The token being asked about',
					artifact: 'access-token'
				},
				{
					name: 'Authorization: Basic',
					place: 'header',
					note: 'The client ID and secret of the API'
				}
			]
		},
		{
			id: 'introspect-response',
			when: logsOut,
			from: 'idp',
			to: 'api',
			kind: 'response',
			plain: 'It is no longer good',
			label: 'active: false',
			concept:
				'This identity provider knows the session has ended, and says so, which the token could not. What it answers is up to the server.',
			fields: [{ name: 'active', place: 'body', note: 'Whether the token is still good' }]
		},
		{
			id: 'asks-after-logout-response',
			when: logsOut,
			from: 'api',
			to: 'app',
			kind: 'response',
			plain: 'The API refuses',
			label: '401 invalid_token',
			concept:
				'The same token, and another answer. So whether a token still works after a logout depends on who checks it, and what they are told.',
			fields: [{ name: 'WWW-Authenticate', place: 'header', note: 'What was wrong with this one' }]
		},
		{
			id: 'refresh-after-logout',
			when: logsOut,
			from: 'app',
			to: 'idp',
			kind: 'request',
			plain: 'The refresh token is tried',
			label: 'POST /token',
			concept: 'The one that could have got new access tokens for a long time.',
			fields: [
				...refreshFields,
				{ name: 'refresh_token', place: 'body', artifact: 'refresh-token' }
			]
		},
		{
			id: 'refresh-after-logout-response',
			when: logsOut,
			from: 'idp',
			to: 'app',
			kind: 'response',
			plain: 'Refused: the session is over',
			label: '400 invalid_grant',
			concept:
				'A refresh token belongs to the session here, so it went with it, which is what the back-channel logout specification recommends. One issued for offline access is meant to outlive the session. Otherwise a stolen access token runs out soon, and nobody gets a new one with this.',
			fields: [
				{ name: 'error=invalid_grant', place: 'body', note: 'The session it belonged to is over' },
				{ name: 'error_description', place: 'body' }
			]
		},
		{
			id: 'retrieve-upstream-token',
			from: 'app',
			to: 'idp',
			kind: 'request',
			execute: { answer: 'upstream-token' },
			inPractice: "Your code asks for this, when it needs the other provider's API.",
			plain: "The app asks for the other provider's token",
			label: [
				{ when: apiV2, text: 'POST /broker/{alias}/token' },
				{ text: 'GET /broker/{alias}/token' }
			],
			concept: [
				{
					when: apiV2,
					text: 'The app asks for the stored upstream token, and authenticates. Its settings at the identity provider allow it.'
				},
				{
					text: "The app asks for the stored upstream token with the user's access token. A role on the user allows it."
				}
			],
			when: all(storedTokens, stillGoing),
			fields: [
				{
					name: 'Authorization: Bearer',
					place: 'header',
					artifact: 'access-token',
					when: all(apiV1, bearer)
				},
				{
					name: 'Authorization: DPoP',
					place: 'header',
					artifact: 'access-token',
					when: all(apiV1, dpop)
				},
				{
					name: 'DPoP',
					place: 'header',
					note: 'A proof tied to this access token',
					artifact: 'proof',
					when: all(apiV1, dpop)
				},
				{ name: 'client_id', place: 'body', when: apiV2 },
				{ name: 'client_secret', place: 'body', artifact: 'secret', when: apiV2 },
				{
					name: 'token',
					place: 'body',
					note: "The user's access token",
					artifact: 'access-token',
					when: apiV2
				}
			]
		},
		{
			id: 'upstream-token',
			from: 'idp',
			to: 'app',
			kind: 'response',
			plain: 'The identity provider hands it over',
			label: 'Upstream access token',
			concept: [
				{
					when: apiV2,
					text: 'Only the access token the other provider issued, handed over by the identity provider.'
				},
				{
					text: 'Everything the other provider issued, handed over by the identity provider: the access token, and its ID and refresh tokens too.'
				}
			],
			when: all(storedTokens, stillGoing),
			fields: [
				{ name: 'access_token', place: 'body', artifact: 'upstream-token' },
				{ name: 'expires_in', place: 'body' },
				{ name: 'id_token', place: 'body', when: apiV1 },
				{ name: 'token_type=Bearer', place: 'body', when: apiV1 },
				{ name: 'refresh_token', place: 'body', when: apiV1 },
				{ name: 'scope', place: 'body', when: apiV1 },
				{ name: 'issued_token_type', place: 'body', when: apiV2 }
			]
		},
		{
			id: 'call-upstream',
			from: 'app',
			to: 'upstream',
			kind: 'request',
			plain: 'The app calls the other provider',
			label: "Call the upstream's API",
			concept: "With that token, the app can call the upstream provider's APIs directly.",
			inPractice: 'This part is your code, using the token as that API asks.',
			when: all(storedTokens, stillGoing),
			fields: [{ name: 'Authorization: Bearer', place: 'header', artifact: 'upstream-token' }]
		}
	]
});
