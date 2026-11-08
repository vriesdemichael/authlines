import type { AppState } from '#lib/flow/state.ts';
import type { DiagramId } from '#lib/flow/model.ts';
import type { ArtifactId, Mode } from '#lib/flow/vocabulary.ts';

/**
 * A node is a question someone brings, and the exact state that answers it. It has an address of its
 * own so it can be found and prerendered, but a state on the one application screen is all it is
 * (ADR-003). Settings come from a named state, so every node in advanced mode has a recording.
 */
export interface MapNode {
	id: string;
	title: string;
	summary: string;
	/** What opens with it, because the question is what something is. */
	explains?: AppState['explained'];
	/** The words someone else might use for it, for search, which go nowhere on screen. */
	alsoAskedAs?: readonly string[];
	/** The answer, in a sentence or two, because someone with a question should not have to walk to it. */
	answer: string;
	flow: string;
	diagram: DiagramId;
	mode: Mode;
	preset: string;
	/** The step where the answer can be seen. */
	step?: string;
	/** The one party whose view answers it. */
	eyes?: string;
	/** What to follow through the flow, when its path is the answer. */
	follows?: ArtifactId;
	/** All that is left to someone is the answer, so it offers that list. */
	offersList?: boolean;
	/** Why there is no such step, because a question should not open a walk away from its answer. */
	startsAtTheBeginning?: string;
}

export interface MapTrack {
	id: string;
	title: string;
	lead: string;
	/** Each chain builds from left to right. */
	chains: readonly (readonly MapNode[])[];
}

const FLOW = 'authorization-code';
const node = (fields: Omit<MapNode, 'flow' | 'diagram' | 'mode'> & Partial<MapNode>): MapNode => ({
	flow: FLOW,
	diagram: 'flow',
	mode: 'simple',
	...fields
});

export const mapTracks: readonly MapTrack[] = [
	{
		id: 'start',
		title: 'Start here',
		lead: 'What everything else builds on, in plain words.',
		chains: [
			[
				node({
					id: 'the-old-way',
					answer:
						'That is how it used to work. The app kept your password and sent it with every call, so it could do anything you can with that account, and if it was broken into, your password went with it.',
					startsAtTheBeginning: 'It is only four steps, so its start is its answer.',
					title: 'Why not just give the app my password?',
					summary: 'What came before, and what most of this is for.',
					preset: 'the-old-way',
					alsoAskedAs: [
						'log in with google',
						'sign in with google',
						'log in with',
						'why oauth',
						'why does oauth exist',
						'basic auth',
						'http basic'
					]
				}),
				node({
					id: 'what-is-an-identity-provider',
					answer:
						'The service that logs users in, so the app never has to see the password. Its issuer is the address that names it, and a token it signs says who issued it.',
					startsAtTheBeginning: 'It is about who is on the diagram, so it starts at the beginning.',
					title: 'What is an identity provider, and an issuer?',
					summary: 'The place you log in, and how everything else knows which one it is.',
					preset: 'oauth',
					explains: { kind: 'lifeline', id: 'idp' }
				}),
				node({
					id: 'what-is-a-token',
					answer:
						'What an app gets instead of your password. It is good for certain things and it runs out. An ordinary one works for whoever holds it, which is why it matters who has seen it.',
					title: 'What is a token?',
					summary: 'What the app gets instead of your password.',
					preset: 'oauth',
					step: 'token-response',
					explains: { kind: 'artifact', id: 'access-token' }
				}),
				node({
					id: 'how-access-works',
					answer:
						'The user logs in at an identity provider, and never at the app. The app gets a token that lets it act for them, without ever seeing their password.',
					startsAtTheBeginning: 'It is the whole flow, so its start is its answer.',
					title: 'How does an app get access?',
					summary: 'An app acts for a user, without ever seeing their password.',
					preset: 'oauth'
				}),
				node({
					id: 'why-a-code',
					answer:
						'Anything in a redirect passes through the browser, where it can be seen. So the browser only carries a one-time code, and the app trades that for tokens on a direct call.',
					title: 'Why not just send the token back through the browser?',
					summary: 'Why the browser only gets a code, and what happened to the way that did not.',
					preset: 'oauth',
					step: 'redirect-with-code',
					follows: 'code'
				}),
				node({
					id: 'what-the-browser-sees',
					answer:
						"With an app on a server, three things that matter pass through it: the user's password, the one-time code and its session with the identity provider. The access token goes straight to the app, on a direct call the browser is not part of.",
					title: 'What can the browser see?',
					summary: 'The whole flow with everything the browser was not sent hidden.',
					preset: 'oauth',
					step: 'token-response',
					eyes: 'browser'
				}),
				node({
					id: 'who-logged-in',
					alsoAskedAs: ['log in with google', 'sign in with google', 'what is openid connect for'],
					answer:
						'OAuth alone gives the app access, and defines no way to tell it who logged in. A token may name them, but it is meant for the API. OpenID Connect adds an ID token, made for the app to read.',
					title: 'How does an app know who logged in?',
					summary:
						'Access is not identity, which is what OpenID Connect adds. OAuth alone is not login.',
					preset: 'oidc',
					step: 'token-response'
				})
			],
			[
				node({
					id: 'adding-login',
					offersList: true,
					answer:
						'Someone registers your app with the identity provider, and your configuration gets the issuer, the client ID and any secret. A library can do much of the rest, with PKCE turned on. Which pages need a login and your own session stay your code.',
					startsAtTheBeginning: 'What they have to do starts with the first step of setup.',
					title: 'I have to add login to an app. What do I do?',
					summary:
						'The part you do once, which part of your code is left, and what a library does. An app with no browser takes the device flow.',
					diagram: 'setup',
					preset: 'oidc'
				})
			]
		]
	},
	{
		id: 'when-it-goes-wrong',
		title: 'When something goes wrong',
		lead: 'An error on your screen, and what it means.',
		chains: [
			[
				node({
					id: 'redirect-uri-error',
					answer:
						'The address the app sent is not one registered for this client, so the server refuses before anyone logs in. It has to match what was registered, and current advice is an exact match.',
					title: 'Why do I get Invalid parameter: redirect_uri?',
					summary: 'Where the address is checked, and where it was registered.',
					preset: 'address-refused',
					step: 'address-refused'
				}),
				node({
					id: 'why-401',
					alsoAskedAs: ['no token', 'call with no token'],
					answer:
						'The API does not accept the token: it is missing, expired, changed, from another issuer, or for someone else. A new token can help, if the reason is that it ran out.',
					title: 'Why did my API say 401?',
					summary: 'It does not accept the token, for one of several reasons that look the same.',
					preset: 'api-expired',
					step: 'api-response'
				}),
				node({
					id: '401-or-403',
					answer:
						'A 401 means the API does not accept the token. A 403 means it does and still refuses, often because the token does not allow this, so a new token of the same kind usually will not help.',
					title: 'What is the difference between 401 and 403?',
					summary: 'One is about the token, and the other about what it allows.',
					preset: 'api-no-scope',
					step: 'api-response'
				}),
				node({
					id: 'api-changed',
					answer:
						'The API refuses it, because the signature no longer matches. Anyone can read a token like this and change it, but only the identity provider can sign one.',
					title: 'What if someone changes what a token says?',
					summary: 'Anyone can read one, and nobody else can sign it.',
					preset: 'api-changed',
					step: 'api-response'
				}),
				node({
					id: 'api-elsewhere',
					answer:
						'Because it does not name this API. Its signature is good and it has not expired, but a token meant for one API should not open every other one.',
					title: 'Why does my API refuse a token that is still good?',
					summary: 'It has to be for this API, which takes setting up at the identity provider.',
					preset: 'api-elsewhere',
					step: 'api-response'
				})
			],
			[
				node({
					id: 'login-required',
					answer:
						'The app sent prompt=none, which says not to show a form, and the user would have to log in, usually because this browser has no session. It is how an app checks quietly whether someone is logged in.',
					title: 'Why do I get login_required?',
					summary: 'Someone would have to log in, and the server was told not to ask.',
					preset: 'sso-fresh',
					step: 'second-redirect-with-code'
				}),
				node({
					id: 'refresh-token-reuse',
					answer:
						'A refresh token that had already been used was sent again, by someone with a copy or by the app itself, and the server here was set so that each one works only once. It also stopped the newest one, so the app has to start a new login.',
					title: 'Why do I get Maximum allowed refresh token reuse exceeded?',
					summary: 'A refresh token was used twice, and that ended things for this app.',
					preset: 'refresh-ends',
					step: 'refresh-again-response'
				})
			]
		]
	},
	{
		id: 'safe',
		title: 'Keeping it safe',
		lead: 'What can go wrong, and what stops it.',
		chains: [
			[
				node({
					id: 'what-state-does',
					preset: 'oauth',
					step: 'callback',
					title: 'What does state protect against?',
					summary:
						'Cross-site request forgery, or CSRF: someone slipping their own answer into your login.',
					answer:
						'The specs say it stops someone slipping their own answer into your login. The app ties a value to this browser and checks the same one comes back. PKCE or a nonce can also do this. It is not drawn, and state does not stop a stolen code.'
				}),
				node({
					id: 'what-iss-does',
					preset: 'oauth',
					step: 'redirect-with-code',
					mode: 'advanced',
					title: 'What is iss doing in the address?',
					summary: 'It says which server answered.',
					answer:
						'It says which server the answer came from. An app that uses more than one provider has to guard against sending a code from one to another, the mix-up attack, and RFC 9700 says it should check this against the server it asked. That attack is not drawn here.'
				})
			],
			[
				node({
					id: 'no-secret',
					answer:
						'An app in a browser or on a phone cannot keep a secret, because what is on someone’s device can be read there. So nothing in its token request proves which app sent it. PKCE only proves it comes from whoever started this login.',
					title: 'What is different about an app with no secret?',
					summary: 'An app in a browser or on a phone cannot keep one, so what proves who it is?',
					preset: 'public',
					step: 'token-request'
				}),
				// The maintainer, 2026-11-08: "a good one because the name is vague", so people bring it. It is what an
				// app with no secret used to do, and here rather than in Start here, which has to fit the first screen.
				node({
					id: 'the-implicit-flow',
					answer:
						'The token comes back after the # of the address, with no code and no trade. The page and anything else running in it can read it, it stays in the browser’s history, and nothing ties it to the app that asked, so current advice is the code with PKCE instead.',
					title: 'What is the implicit flow?',
					summary: 'The token sent back in the address, and why current advice says not to.',
					preset: 'implicit',
					step: 'redirect-with-token'
				}),
				node({
					id: 'stolen-code',
					answer:
						'This app has no secret and no PKCE, so whoever has the code gets the tokens. Nothing in the request shows it is not the real app.',
					title: 'What if someone steals the code?',
					summary:
						'From an app with no secret: watch them take it as it crosses the browser, and get the tokens.',
					preset: 'attack-public',
					step: 'attacker-steals-code'
				}),
				node({
					id: 'pkce',
					answer:
						'The app makes up a random value for each login, and only its fingerprint goes in the redirect. The value itself goes with the code when the app trades it, never in a redirect, so someone who only saw the code does not have it.',
					title: 'How does PKCE work?',
					summary:
						'The app proves it started this login, with a value that was never in a redirect.',
					preset: 'public-pkce',
					step: 'make-verifier',
					follows: 'verifier'
				}),
				node({
					id: 'wildcard-redirect',
					alsoAskedAs: ['wildcard', 'redirect uri wildcard', 'valid redirect uris *'],
					answer:
						'Then anyone can have the code sent to them: they make a login link for your app with an address of their own, and the user logs in as usual. PKCE does not help, because they made the challenge. An exact address stops it.',
					title: 'Why not just put * in the redirect URIs?',
					summary: 'A login link someone else made, and the code going where it says.',
					mode: 'advanced',
					preset: 'their-link-any-public-pkce',
					step: 'attacker-token-response'
				})
			],
			[
				node({
					id: 'pkce-with-a-secret',
					alsoAskedAs: ['stolen from an app with a secret', 'both protections'],
					answer:
						'Current advice recommends it. A secret stops someone trading a stolen code themselves, but they can hand it to the real app from a login of their own, and it logs them in. PKCE stops that at the server, and a nonce the app checks can too.',
					title: 'Does an app with a secret need PKCE too?',
					summary: 'Why current advice recommends it, even when a stolen code is not enough alone.',
					preset: 'attack-at-the-app',
					step: 'attacker-handed-answer'
				})
			],
			[
				node({
					id: 'pkce-at-the-app',
					preset: 'attack-at-the-app-pkce',
					step: 'handed-token-response',
					title: 'What stops them handing it to the real app?',
					summary: 'The code is tied to the login it came from.',
					answer:
						'PKCE. The code is tied to the real user’s challenge, and the app sends the verifier from the login they started, so the server refuses it. That is what PKCE adds to an app with a secret.'
				})
			],
			[
				node({
					id: 'stolen-refresh-token',
					answer:
						'New access tokens without the user, for as long as it lasts. From an app with a secret they need the secret too. A new refresh token coming back does not mean the old one stopped working, which depends on the server.',
					title: 'What is a stolen refresh token worth?',
					summary: 'More than the access token, and a new one coming back may not stop it.',
					preset: 'refresh-public',
					step: 'refresh-again'
				}),
				node({
					id: 'refresh-rotate',
					answer:
						'A new one coming back is not enough, because the old one may still work. The server has to refuse it, which here is a setting, and a second use then ends the app’s session. A retry after a lost answer, or two tabs at once, can look like a second use.',
					title: 'How do I make refresh tokens rotate?',
					summary: 'A new one coming back is not enough: the old one has to stop working.',
					mode: 'advanced',
					preset: 'refresh-public-ends',
					step: 'refresh-again-response'
				}),
				node({
					id: 'stolen-token',
					answer:
						'It ties the token to a key that stays in the app, and each call has to carry a proof signed with that key. At an API that checks the proof, the token alone gets nobody in. One that knows only Bearer may never look, and the one recorded took it.',
					title: 'How does DPoP stop a stolen token being used?',
					summary: 'Only where the API checks the proof. The theft itself is not drawn.',
					mode: 'advanced',
					preset: 'dpop-thief',
					step: 'thief-api-response'
				})
			]
		]
	},
	{
		id: 'elsewhere',
		title: 'Logging in somewhere else',
		lead: 'When the identity provider hands the login to another one.',
		chains: [
			[
				node({
					id: 'users-in-a-directory',
					alsoAskedAs: ['user federation', 'federation', 'active directory'],
					answer:
						'The identity provider keeps the login. It looks the user up in the directory and tries the password there, and no browser goes anywhere else. The token has the same claims, with one value different. Recorded with OpenLDAP, not Active Directory.',
					title: 'What if our users are already in LDAP or Active Directory?',
					summary: 'Same app, same token, a different middle.',
					preset: 'in-a-directory',
					mode: 'advanced',
					step: 'directory-bind'
				}),
				node({
					id: 'another-provider',
					alsoAskedAs: [
						'brokering',
						'identity brokering',
						'external idp',
						'external identity provider'
					],
					answer:
						'The identity provider sends the user on to the other provider, and then gives the app its usual code. The app does not notice.',
					title: 'How do you log in with another provider?',
					summary:
						'The app does not notice, and that is the point. It is one way "log in with your company account" works.',
					preset: 'broker',
					step: 'redirect-to-upstream'
				}),
				node({
					id: 'company-accounts',
					alsoAskedAs: [
						'company account',
						'enterprise login',
						'sso for customers',
						'multi-tenant',
						'multi tenant',
						'organizations',
						'home realm discovery',
						'b2b'
					],
					answer:
						"Each customer's provider sits behind yours. Yours asks for the email, finds the company from the part after the @, and sends them to their provider. The app still talks to one provider, and the token can say which customer.",
					title: 'How do we offer log in with your company account?',
					summary:
						'Your provider finds their company from the email, and the app still knows only one.',
					preset: 'companies',
					step: 'find-company'
				}),
				node({
					id: 'customer-on-saml',
					alsoAskedAs: ['saml 2.0', 'saml assertion', 'acs url', 'entity id', 'idp metadata'],
					answer:
						'Only the middle changes. Their provider answers with an assertion in a signed response, which here comes back through the browser in a form, where OpenID Connect sends a code. Your provider checks it, and the app gets its usual tokens.',
					title: "What if a customer's provider speaks SAML?",
					summary: 'Only the part between the two providers changes.',
					mode: 'advanced',
					preset: 'companies-saml',
					step: 'upstream-callback'
				}),
				node({
					id: 'someone-leaves',
					alsoAskedAs: [
						'offboarding',
						'leaves the company',
						'deprovisioning',
						'account disabled',
						'leaver'
					],
					answer:
						'Their company turns their account off. On the server recorded, nothing told your provider: the old token still worked, a refresh gave new ones, and the same browser logged in again unasked. A refresh or a login works while the session in the middle lasts.',
					title: "What happens when someone leaves the customer's company?",
					summary:
						'The token, a refresh and a login still work, while the session in the middle lasts.',
					mode: 'advanced',
					preset: 'companies-leaves',
					step: 'code-again'
				}),
				node({
					id: 'calling-the-other-provider',
					alsoAskedAs: ['token brokering', 'upstream token', 'upstream tokens', 'stored tokens'],
					answer:
						'The identity provider can keep the tokens the other provider issued, and hand them over when the app asks. Whether it keeps them, and who may ask, are settings.',
					title: "How does the app call the other provider's API?",
					summary: 'The identity provider kept its tokens, and hands them over.',
					mode: 'advanced',
					preset: 'upstream-v1',
					step: 'retrieve-upstream-token'
				})
			]
		]
	},
	{
		id: 'real',
		title: 'Setting up a real app',
		lead: 'The combinations people use, with what is really sent.',
		chains: [
			[
				node({
					id: 'registers-itself',
					alsoAskedAs: ['dcr', 'dynamic client registration', 'register a client automatically'],
					answer:
						'It sends what someone would otherwise have told an admin, and gets a client ID and a secret back. On the server recorded it still takes one hand-off: an admin creates a token that lets it do that.',
					title: 'Can an app register itself?',
					summary: 'An admin still hands over a token, and one request does the rest.',
					preset: 'registers-itself',
					diagram: 'setup',
					mode: 'advanced',
					step: 'dcr-request'
				}),
				node({
					id: 'points-at-a-document',
					alsoAskedAs: ['cimd', 'client id metadata document', 'mcp client registration'],
					answer:
						'Its client ID is the address of a document about it, which the identity provider fetches when it first sees the app. So nobody has to register it first. On the server recorded, an admin names domains and sets the audience, and the user gets asked.',
					title: 'What if nobody registers the app at all?',
					summary: 'A document at an address the app controls, fetched when it first asks.',
					preset: 'points-at-a-document',
					mode: 'advanced',
					step: 'cimd-document'
				}),
				node({
					id: 'when-do-i-get-asked',
					answer:
						'When the identity provider is set up to ask for this app, and it then lists what the app wants. Many are set up not to, which is why you may never have seen it.',
					title: 'When does the user get asked?',
					summary: 'What a scope is, and why you may never have seen the question.',
					preset: 'consent',
					step: 'consent-page'
				}),
				node({
					id: 'single-sign-on',
					answer:
						'The identity provider remembers the browser, in a cookie on its own address. A second app sends the browser there, the cookie goes along, and it answers without asking. Neither app ever sees that cookie.',
					title: "What is single sign-on? Why don't I log in twice?",
					summary: 'A second app, the same login, and no password.',
					preset: 'sso',
					step: 'idp-recognises'
				}),
				node({
					id: 'getting-to-know-each-other',
					answer:
						'Before anyone logs in, the identity provider is told about the app, including where users may be sent back to. The app is told the issuer, and can look up the rest from that.',
					startsAtTheBeginning: 'Setup is the answer, from its first step.',
					title: 'How do an app and a provider get to know each other?',
					summary: 'What people have to do before anyone can log in.',
					diagram: 'setup',
					preset: 'oauth'
				}),
				node({
					id: 'what-api-checks',
					answer:
						'The signature, who issued the token, that it has not expired, and that it is for this API. Which scopes a request needs is yours to set, and whether this user may see this thing is your own code.',
					title: 'What does my API have to check?',
					summary: 'A token says nothing until someone has looked.',
					preset: 'oauth',
					step: 'api-check-token'
				}),
				node({
					id: 'token-runs-out',
					answer:
						'The API refuses it, the app sends its refresh token to the identity provider, and it gets a new access token. The user is not involved, and sees nothing.',
					title: 'What happens when the token runs out?',
					summary: 'The app gets a new one, and the user never knows.',
					preset: 'refresh',
					step: 'token-runs-out'
				})
			],
			[
				node({
					id: 'token-after-logout',
					alsoAskedAs: ['what does log out do', 'what does logging out do', 'log out'],
					answer:
						'It depends who checks. An API that only looks at the token takes it until it expires. One that asks the identity provider gets whatever it says, which on the server tried here was no, and a refresh was refused too.',
					title: 'I logged out. Does the token still work?',
					summary: 'The same token, and two answers.',
					preset: 'logout',
					step: 'token-after-logout-response'
				}),
				node({
					id: 'logged-out-of-other-apps',
					answer:
						'Of the identity provider, yes, so their next login asks again and their refresh tokens usually stop working. An app that registered an address is told right away. Any other that is told no other way keeps them logged in until it next asks.',
					title: 'Am I logged out of my other apps too?',
					summary: 'They lose the session they relied on, and may not know yet.',
					preset: 'logout-two-apps',
					step: 'backchannel-logout'
				})
			],
			[
				node({
					id: 'tokens-in-the-browser',
					answer:
						'A script in the page can read any storage there. A worker can keep tokens from that script, but the script can often start a login of its own for new ones. So for business apps, or anything personal, current advice is a server behind the app that keeps them.',
					title: 'Where should an app in the browser keep its tokens?',
					summary:
						'localStorage, sessionStorage or memory: none of them fully stops a script in the page. A backend for frontend keeps tokens out of it, though a script can still send requests through it.',
					preset: 'in-the-page',
					step: 'token-response'
				}),
				node({
					id: 'server-behind-the-page',
					alsoAskedAs: [
						'backend for frontend',
						'httponly cookie',
						'session cookie',
						'localStorage',
						'store tokens in the browser'
					],
					answer:
						'That server is the client. It does the login, so the page never has a token, and the browser gets a cookie no script can read. A script in the page can still send requests through it, but finds no token to take.',
					title: 'What does a server behind the page change?',
					summary: 'The page never has a token, and the browser gets a cookie.',
					preset: 'behind-the-page',
					step: 'set-session'
				}),
				node({
					id: 'secret-in-the-page',
					answer:
						'Then it is not a secret: anyone who can load the page can read it, so it should not count as proof of which app this is. Make it a client with no secret, and turn on PKCE. If it may also act for itself, that secret gets tokens with no user.',
					title: 'What if our client secret is in the JavaScript?',
					summary: 'Then it is not a secret, and anyone can read it.',
					preset: 'browser-app',
					step: 'token-request'
				})
			]
		]
	},
	{
		id: 'under-the-hood',
		title: 'Under the hood',
		lead: 'What really happens, for when you want to see it.',
		chains: [
			[
				node({
					id: 'on-the-wire',
					answer:
						'Each message here is from one real run against a real server. Step through it to read the raw request and answer.',
					title: 'What really goes over the wire?',
					summary: 'The raw request and answer, from one real run.',
					mode: 'advanced',
					preset: 'oauth',
					step: 'token-request'
				}),
				node({
					id: 'what-is-in-my-token',
					answer:
						'Mostly the scopes and mappers of the client it was issued to, on the server that issued it. Open the token to see which setting put each thing there.',
					title: 'Why does my access token say that?',
					summary: 'Open it, and see which setting put each thing there.',
					mode: 'advanced',
					preset: 'oauth',
					step: 'token-response'
				}),
				node({
					id: 'everything',
					answer: 'Still one diagram. This is as many settings as fit together, on the same flow.',
					startsAtTheBeginning: 'It is about how far the whole diagram stretches.',
					title: 'What does it all look like at once?',
					summary: 'As much as fits together, to see how far one diagram stretches.',
					mode: 'advanced',
					preset: 'everything'
				})
			]
		]
	},
	{
		id: 'no-user',
		title: 'When there is no user',
		lead: 'Client credentials: one service calling another, with nobody logging in.',
		chains: [
			[
				node({
					id: 'no-user',
					flow: 'client-credentials',
					preset: 'as-itself',
					title: 'What if no user is involved?',
					summary:
						'A nightly job, or one service calling another: machine to machine, with no browser and no login.',
					answer:
						'Then the app asks for a token with its own secret, with no browser and nobody logging in. It gets an access token, and calls the API with that.',
					startsAtTheBeginning: 'It is the whole flow, so its start is its answer.'
				})
			]
		]
	},
	{
		id: 'on-a-device',
		title: 'On a TV, or a server with no browser',
		lead: 'Device flow: when the app cannot log anyone in, and the user does that on another device.',
		chains: [
			[
				node({
					id: 'device-flow',
					flow: 'device',
					preset: 'on-a-device',
					step: 'device-show-code',
					title: 'How do you log in on a TV, or on a server with no browser?',
					summary:
						'On another device, with a code the app shows. That includes a command-line tool over SSH on a headless server.',
					answer:
						'The app gets a short code from the identity provider and shows it. The user types that into a browser on their phone and logs in there, while the app keeps asking whether they are done. The app never sees the password.'
				}),
				node({
					id: 'device-two-codes',
					flow: 'device',
					preset: 'on-a-device',
					step: 'device-response',
					title: 'Why are there two codes?',
					summary: 'One for a person, and one that gets the tokens.',
					answer:
						'The short one is for a person to type, and says which login this is. The long one stays with the app, and the tokens go to it. So seeing the short one gets nobody a token of their own, though typing it in first leaves the device logged in as them.'
				}),
				node({
					id: 'device-waiting',
					alsoAskedAs: ['authorization_pending'],
					flow: 'device',
					preset: 'on-a-device',
					step: 'device-pending',
					title: 'What is the app doing while the user types?',
					summary: 'Asking, again and again, which is called polling.',
					answer:
						'Asking the identity provider whether the user is done, every few seconds, and being told not yet. The flow does not count on anything calling the app back, so the answer to one of its own questions is how it finds out.'
				}),
				node({
					id: 'device-phishing',
					flow: 'device',
					preset: 'on-a-device-sent',
					step: 'sent-token-response',
					title: 'Can someone trick me into approving their device?',
					summary: 'Yes, by sending you their code. It is called device code phishing.',
					answer:
						'Yes. They start this flow on a device of their own and send you the address and the user code. If you log in and agree, the tokens go to them. The page asking you to agree can name an app you know, so ask whether you started this.'
				}),
				node({
					id: 'device-someone-reads-it',
					flow: 'device',
					preset: 'on-a-device-read',
					step: 'read-code-refused',
					title: 'What if someone else can see the user code on the screen?',
					summary: 'They can get there first, and the device ends up logged in as them.',
					answer:
						'They can enter it first, with an account of their own. They get no token for themselves, but the device ends up logged in as them, and the user is told the user code is not valid. So it matters who can see the screen.'
				})
			]
		]
	}
];

export const mapNodes: readonly MapNode[] = mapTracks.flatMap((track) => track.chains.flat());

/**
 * Questions that no longer have a place on the map, because it had too many and each of these says what
 * another does, or few would ask it (#142). Their addresses go on working (ADR-003), and search finds what
 * they were about through the question that took them over.
 */
export const offTheMap: readonly MapNode[] = [
	node({
		id: 'pkce-stops-it',
		answer:
			'They are refused, because they do not have the verifier. On this server that try also uses up the code, so the real user has to log in again.',
		title: 'What does PKCE do to the attacker?',
		summary: 'The same attempt, a different answer, and a cost that remains.',
		preset: 'attack-public-pkce',
		step: 'attacker-token-response'
	}),
	node({
		id: 'their-link-refused',
		answer:
			'The identity provider refuses it before anyone logs in, because the address in it is not the one registered for the app. That is what an exact address is for, and the identity provider checks it, not the app.',
		title: 'What if someone sends a login link of their own?',
		summary: 'Refused at the start, by the identity provider.',
		mode: 'advanced',
		preset: 'their-link',
		step: 'address-refused'
	}),
	node({
		id: 'their-link-with-a-secret',
		answer:
			'It stops them trading the code, which still went to them, from a real login by the real user. An exact address keeps the code from them in the first place.',
		title: 'Does a secret stop a login link of theirs?',
		summary: 'It stops the trade, and the code still goes to them.',
		mode: 'advanced',
		preset: 'their-link-any',
		step: 'attacker-token-response'
	}),
	node({
		id: 'their-link-no-pkce',
		answer:
			'The tokens. They trade the code as the real app would, and nothing in the request says it is not the app. Then they call the API as the user.',
		title: 'What does a * get them from an app with no secret?',
		summary: 'The tokens, and the API answering them as the user.',
		mode: 'advanced',
		preset: 'their-link-any-public',
		step: 'attacker-api-response'
	}),
	node({
		id: 'pushed-first',
		alsoAskedAs: ['par', 'pushed authorization request', 'request_uri', 'request uri'],
		answer:
			'So that what it asks for stays out of the browser, where it could be read or changed. It sends it straight to the identity provider, with its secret, and the browser carries only its client ID and a reference for one login.',
		title: 'Why would an app send its login request ahead?',
		summary: 'Only a reference to it goes through the browser.',
		mode: 'advanced',
		preset: 'par',
		step: 'authorize'
	}),
	node({
		id: 'pushed-first-no-secret',
		alsoAskedAs: ['par public client', 'par without a secret'],
		answer:
			'Less. The request still stays out of the browser, but with nothing to show who it is, anyone who knows its client ID can push one as well. PKCE is still what makes a stolen code no use.',
		title: 'Does pushing the request first help an app with no secret?',
		summary: 'It keeps the request out of the browser, and PKCE still does the protecting.',
		mode: 'advanced',
		preset: 'par-public-pkce',
		step: 'push-request'
	}),
	node({
		id: 'passed-on',
		alsoAskedAs: [
			'token exchange',
			'rfc 8693',
			'on behalf of',
			'downstream api',
			'subject_token',
			'call another api'
		],
		answer:
			'Not as it is, because it names the first API, and the next one should refuse it. One way, the one drawn here, is for the first API to trade it at the identity provider, with its own secret, for a token for the same user that names the next API, and send that.',
		title: 'Can an API pass the user’s token on to another API?',
		summary: 'It trades it for one meant for the next API.',
		mode: 'advanced',
		preset: 'exchange',
		step: 'exchange-request'
	}),
	node({
		id: 'who-asked',
		alsoAskedAs: ['act claim', 'impersonation', 'delegation', 'azp'],
		answer:
			'On the server recorded, from its azp, which names the first API as the client the token was issued to. There is no act claim, which is how RFC 8693 has a token say who is acting for the user, so the token is about the user alone.',
		title: 'Can the second API tell another API asked?',
		summary: 'From azp, and nothing says it acts for the user.',
		mode: 'advanced',
		preset: 'exchange-oidc',
		step: 'exchange-response'
	}),
	node({
		id: 'keeps-going',
		alsoAskedAs: [
			'requested_token_type',
			'refresh token from token exchange',
			'long running job',
			'background job for the user'
		],
		answer:
			'With a refresh token from the trade, which the server recorded gives only when it is set to. The API gets a new token for the next API with it, with its own secret and no user there. On the server recorded, it works only while the user’s session lasts.',
		title: 'Can an API keep calling the next API once its token runs out?',
		summary: 'With a refresh token from the trade, which here ends with the user’s session.',
		mode: 'advanced',
		preset: 'exchange-refresh',
		step: 'trade-refresh-request'
	}),
	node({
		id: 'trade-outlasts',
		alsoAskedAs: ['session not active'],
		answer:
			'Not on the server recorded. It is tied to the session the user logged in with, and once that has ended, a refresh gets a 400 with invalid_grant and: Session not active.',
		title: 'Does a refresh token from a trade outlast the user’s session?',
		summary: 'Not here: it ends with the session it came from.',
		mode: 'advanced',
		preset: 'exchange-refresh-oidc',
		step: 'exchange-response'
	}),
	node({
		id: 'link-account',
		alsoAskedAs: ['link account', 'connect account', 'account linking', 'kc_action', 'idp_link'],
		answer:
			'The app sends the user, still logged in, back to the identity provider with a request to link an account at the other provider. The server recorded asked them to confirm, sent them to log in there, kept that provider’s tokens, and sent them back to the app with how it went.',
		title: 'How does a user link an account at another provider, once logged in?',
		summary: 'They log in there, and the identity provider can keep its tokens.',
		mode: 'advanced',
		preset: 'link-account',
		step: 'link-ask'
	}),
	// The maintainer, 2026-11-08: roles and groups are in scope (#183).
	node({
		id: 'roles-from-groups',
		alsoAskedAs: ['roles', 'groups', 'claim to role'],
		answer:
			'The other provider’s ID token says which groups the user is in, and the identity provider gives a role of its own to whoever is in one. Recorded: sales became reads-orders, in the app’s token.',
		title: 'How does a group at another provider become a role in the token?',
		summary: 'Their ID token says the group, and the identity provider gives a role of its own.',
		mode: 'advanced',
		preset: 'broker-groups',
		step: 'match-user'
	}),
	node({
		id: 'only-roles-given',
		alsoAskedAs: ['full scope allowed', 'role scope mappings'],
		answer:
			'Every role the user had went into the token, until the app was given only reads-orders. Then the token had that alone, and named the API, because the account service had left its audience.',
		title: 'Why does my token have roles the app does not need?',
		summary: 'Some providers put every role in every token, unless the app is given only its own.',
		mode: 'advanced',
		preset: 'broker-groups-given',
		step: 'token-response'
	}),
	node({
		id: 'link-cancelled',
		alsoAskedAs: ['kc_action_status', 'cancelled'],
		answer:
			'On the server recorded, the browser went back to the app with kc_action_status=cancelled, and nothing was linked. The app can say so, and ask again later.',
		title: 'What does the app hear when the user does not link it?',
		summary: 'A status that says cancelled, and no link.',
		mode: 'advanced',
		preset: 'link-cancelled',
		step: 'link-done'
	}),
	node({
		id: 'api-reads-stored',
		alsoAskedAs: ['external token', 'allowed identity providers', 'broker token'],
		answer:
			'Yes, with API V2. On the server recorded, the API asked for it with a client ID and secret of its own, and the access token the app sent, which had to name the API. The other provider’s token stays with the API, and the app can be one with no secret.',
		title: 'Can an API read the user’s token at the other provider, and not the app?',
		summary: 'Yes, with a client of its own that is allowed that provider.',
		mode: 'advanced',
		preset: 'upstream-v2-api',
		step: 'api-retrieve-upstream-token'
	}),
	node({
		id: 'api-not-allowed',
		alsoAskedAs: ['client not allowed to retrieve token for the provider'],
		answer:
			'The identity provider refuses it: on the server recorded, a 403 with invalid_client. Which providers each client may read is set at the identity provider there, so the fix is there too.',
		title: 'What does an API get when it is not allowed that provider?',
		summary: 'A refusal, so it cannot give the app what it asked for.',
		mode: 'advanced',
		preset: 'upstream-v2-refused',
		step: 'api-upstream-refused'
	}),
	node({
		id: 'dpop-on-the-wire',
		alsoAskedAs: ['dpop proof', 'dpop header'],
		answer:
			'A proof with each call: a short note signed with a key that stays in the app, new each time and tied to the method and address of the call. The token says which key, so an API that checks can tell the sender has that key, or a proof made with it.',
		title: 'What does DPoP add to each call?',
		summary: 'A proof, signed with a key that stays in the app.',
		mode: 'advanced',
		preset: 'dpop',
		step: 'api-request'
	}),
	node({
		id: 'dpop-at-a-bearer-api',
		alsoAskedAs: ['dpop downgrade', 'dpop as bearer', 'bearer only api'],
		answer:
			'Not if it never looks at what the token is tied to: the one recorded took a stolen token sent as plain Bearer. Whether it looks is the library or gateway the API uses, and one that takes both kinds has to refuse a bound token sent as Bearer.',
		title: 'Does DPoP protect a token at an API that does not know it?',
		summary: 'Only if the API checks the proof.',
		mode: 'advanced',
		preset: 'dpop-thief-bearer-only',
		step: 'thief-api-response'
	}),
	node({
		id: 'someone-leaves-oidc',
		alsoAskedAs: ['leaves openid connect', 'offboarding openid connect'],
		answer:
			'No, as it was set up. With a customer on OpenID Connect too, the old token, a refresh and the same browser logging in again all still worked after their company turned them off, and the session in the middle stayed the same one throughout.',
		title: 'Does it matter what their provider speaks, when someone leaves?',
		summary: 'No, as it was set up: the session in the middle carried on either way.',
		mode: 'advanced',
		preset: 'companies-oidc-leaves',
		step: 'code-again'
	}),
	node({
		id: 'device-no-answer',
		flow: 'device',
		preset: 'on-a-device-says-no',
		mode: 'advanced',
		step: 'device-denied-response',
		title: 'What if the user says no?',
		summary: 'The app is told the next time it asks, and stops.',
		answer:
			'The app only finds out the next time it asks: a 400 with access_denied. It stops asking and tells the user. Trying again takes new codes, once the user asks to.'
	}),
	node({
		id: 'token-api-v2',
		answer:
			'The app also has to authenticate, and has to be allowed to ask. What comes back is only the access token.',
		title: 'What changes with API V2 for stored tokens?',
		summary: 'Only the access token, and the client has to be allowed to ask.',
		mode: 'advanced',
		preset: 'upstream-v2',
		step: 'retrieve-upstream-token'
	}),
	node({
		id: 'device-ran-out',
		flow: 'device',
		preset: 'on-a-device-runs-out',
		mode: 'advanced',
		step: 'device-expired-response',
		title: 'What if the user never comes?',
		summary: 'The codes run out, and the app is told when it next asks.',
		answer:
			'The codes only last so long. The next time the app asks after that, it gets a 400 with expired_token, stops asking, and tells the user. Trying again takes new codes, once the user asks to.'
	}),
	node({
		id: 'force-a-login',
		answer:
			'Send prompt=login with the request. The identity provider shows the form, though it knows the browser. To be sure it happened, check auth_time in the ID token, if it has one: a provider only has to send it when the app asks for it.',
		title: 'How do I make someone log in again?',
		summary: 'A session is usually good enough. One parameter says not this time.',
		mode: 'advanced',
		preset: 'sso-insists',
		step: 'second-authorize'
	}),
	node({
		id: 'no-user-no-refresh',
		flow: 'client-credentials',
		preset: 'as-itself',
		step: 'service-token-response',
		title: 'Why is there no refresh token for a service?',
		summary: 'It has its secret, so it can just ask again.',
		answer:
			'A refresh token is there to get a new token without asking the user again. Here there is no user, and the app still has its secret, so when the token runs out it asks again.'
	}),
	node({
		id: 'two-apps-one-login',
		answer:
			'They share the session on the identity provider, and nothing else. Each gets tokens of its own, and here the two ID tokens name the same session and login time, and a different app.',
		title: 'Do two apps share a token?',
		summary: 'They share a login, and each has tokens of its own.',
		mode: 'advanced',
		preset: 'sso-oidc',
		step: 'second-token-response'
	}),
	node({
		id: 'device-who-logged-in',
		flow: 'device',
		preset: 'on-a-device-oidc',
		step: 'device-check-id-token',
		title: 'Can a device know who logged in?',
		summary: 'Usually, with an ID token.',
		answer:
			'Usually. RFC 8628 does not cover it, so it is up to the server, and the one recorded here does it: the app adds openid at the start, and the last answer has an ID token. It says who agreed, which need not be who is at the device.'
	}),
	node({
		id: 'device-pending-error',
		flow: 'device',
		preset: 'on-a-device',
		mode: 'advanced',
		step: 'device-pending',
		title: 'Why do I get authorization_pending?',
		summary: 'It is not a failure, whatever it looks like.',
		answer:
			'It is the ordinary answer until the user has finished: a 400, with this in place of tokens. Ask again after waiting as long as the interval said. Asking sooner can get slow_down, and the app then has to wait longer.'
	}),
	node({
		id: 'both-protections',
		answer:
			'Nothing. Without the secret the identity provider refuses them, and handing it to the real app fails because the verifier does not match, though on this server that uses up the code.',
		title: 'What does an attacker get against both?',
		summary: 'A secret and PKCE together, against the same attempt.',
		preset: 'attack-confidential-pkce',
		step: 'attacker-token-response'
	}),
	node({
		id: 'stolen-from-a-secret',
		answer:
			'They cannot trade it themselves, because they do not have the secret. They could still hand it to the real app from their own browser, so that it trades the code for them.',
		title: 'Can a code be stolen from an app with a secret?',
		summary: 'They get the code, but cannot trade it. That is not the end of it.',
		preset: 'attack-confidential',
		step: 'attacker-token-response'
	}),
	node({
		id: 'nonce-at-the-app',
		preset: 'attack-at-the-app-oidc',
		step: 'handed-nonce-check',
		mode: 'advanced',
		title: 'Does a nonce stop it as well?',
		summary: 'Yes, if the app checks it, and later.',
		answer:
			'Yes, if the app checks it and uses no token until it has. The server still hands over the tokens, but the ID token has the nonce from the real user’s login, and the app made a different one for this login. PKCE stops it earlier, at the server.'
	}),
	node({
		id: 'pkce-on-the-wire',
		preset: 'pkce',
		step: 'token-request',
		mode: 'advanced',
		title: 'What does PKCE add to the requests?',
		summary: 'A verifier, and a fingerprint of it.',
		answer:
			'A random verifier made for each login. A fingerprint of it goes in the redirect as the challenge, and the verifier itself goes in this request, so the server can check that the two match.'
	}),
	node({
		id: 'what-log-out-does',
		answer:
			'The identity provider ends its session, so the next login asks again. The app has to forget the user too, as a session of its own. An access token keeps working at any API that does not ask, and a refresh token from that session usually stops.',
		title: 'What does log out actually do?',
		summary: 'Two sessions end, if you ask for both, and an access token keeps working.',
		preset: 'logout',
		step: 'session-ended'
	}),
	node({
		id: 'web-app',
		answer:
			'It can keep a secret, so that is how it proves which app it is. OpenID Connect tells it who logged in, and PKCE protects the code as well.',
		startsAtTheBeginning: 'It is about the whole flow, with these settings.',
		title: 'A web app on a server',
		summary: 'It can keep a secret. With OpenID Connect to know who logged in, and PKCE on top.',
		mode: 'advanced',
		preset: 'oidc-pkce'
	}),
	node({
		id: 'browser-app',
		answer:
			'It has no secret, so PKCE protects the code. The harder problem is what follows: the tokens live in the page, where any script running there can reach them.',
		title: 'An app that runs in the browser',
		summary:
			'A single-page app, in React, say. No secret to keep, so PKCE protects the code. The tokens then live in the page, which is the harder problem.',
		preset: 'browser-app',
		step: 'token-response'
	}),
	node({
		id: 'no-user-with-a-key',
		flow: 'client-credentials',
		preset: 'as-itself-dpop',
		mode: 'advanced',
		step: 'service-api-request',
		title: 'Can a token for a service be tied to a key?',
		summary: 'DPoP works the same with no user.',
		answer:
			'Yes. The app makes a key, and a proof signed with it goes along when it asks for the token and with every call. At an API that checks the proof, the token is no use to anyone without the key.'
	}),
	node({
		id: 'device-phished-says-no',
		flow: 'device',
		preset: 'on-a-device-sent-says-no',
		mode: 'advanced',
		step: 'sent-denied-response',
		title: 'What stops someone who sent me a code?',
		summary: 'You do, at the page that asks. Nothing else here can.',
		answer:
			'You do, at the page that asks you to agree. They get access_denied, and nothing else. Neither the app nor the API is part of this, so neither can stop it, and that page only helps if it gets read.'
	}),
	node({
		id: 'device-phished-runs-out',
		flow: 'device',
		preset: 'on-a-device-sent-runs-out',
		mode: 'advanced',
		step: 'sent-expired-response',
		title: 'What if I ignore a code someone sent me?',
		summary: 'It runs out, which is why these codes are short-lived.',
		answer:
			'Nothing happens. It runs out, and whoever started it gets expired_token the next time they ask. That is why these codes are short-lived, though someone talking to you right now can simply get a fresh one.'
	}),
	node({
		id: 'api-no-token',
		answer:
			'A 401, with WWW-Authenticate saying which kind of token it wants. There is no error in it, because there was no token to be wrong.',
		title: 'What does an API say to a call with no token?',
		summary: 'Which kind of token it wants, and no error.',
		preset: 'api-no-token',
		step: 'api-response'
	}),
	node({
		id: 'dpop-nonce',
		answer:
			'The server hands out a nonce that the next proof has to include, so a proof made earlier is refused. The spec allows this, and the server recorded here did not ask for one.',
		title: 'How can a proof be stopped from being used later?',
		summary:
			'A nonce from the server. The spec allows it, and the server recorded here did not ask.',
		preset: 'dpop-nonce',
		step: 'nonce-challenge'
	}),
	node({
		id: 'acts-for-the-user-later',
		alsoAskedAs: [
			'offline_access',
			'offline token',
			'offline session',
			'background service',
			'session idle',
			'session max'
		],
		answer:
			'With an offline token: the app asks for offline_access, and keeps a refresh token meant to outlive the session. On the server recorded it still got new tokens after the user logged out, and nobody was asked about it, though OpenID Connect says the user has to agree.',
		title: 'How can a service act for a user who has logged out?',
		summary: 'With an offline token, meant to outlive the session.',
		mode: 'advanced',
		preset: 'logout-offline',
		step: 'refresh-after-logout-response'
	}),
	// A program on the user's own computer (#178).
	node({
		id: 'program-logs-in',
		alsoAskedAs: [
			'command line tool login',
			'cli login',
			'desktop app login',
			'native app',
			'loopback redirect',
			'127.0.0.1 redirect'
		],
		answer:
			'It opens the user’s own browser to log in, and hears the answer on a port of 127.0.0.1 that it opened. On the server recorded, an address registered with no port let ports nobody registered through, as RFC 8252 asks of a server. With no secret to its name, PKCE is what shows the code is its own.',
		title: 'How does a command-line tool or a desktop app log someone in?',
		summary: 'Through the user’s browser, and back on a port of its own.',
		mode: 'advanced',
		preset: 'on-their-computer',
		step: 'callback'
	}),
	node({
		id: 'why-not-localhost',
		alsoAskedAs: ['localhost redirect', 'localhost vs 127.0.0.1'],
		answer:
			'RFC 8252 says to use 127.0.0.1, because a name like localhost can be looked up wrongly, or have the program listen on more than the computer itself. On the server recorded, an address registered as 127.0.0.1 refused localhost in its place, and one registered as localhost let a port nobody registered through as well.',
		title: 'Why 127.0.0.1, and not localhost?',
		summary: 'A name can be looked up wrongly, and 127.0.0.1 cannot.',
		mode: 'advanced',
		preset: 'on-their-computer',
		step: 'program-starts'
	}),
	node({
		id: 'program-needs-pkce',
		alsoAskedAs: ['pkce for native apps', 'pkce cli'],
		answer:
			'On some systems another program may be able to take a code sent to the port, so the port does not show which program got it. A secret shipped in every copy of the program would be no secret. Only whoever started this login has the verifier, which was never in a redirect, so a program that only took the code cannot trade it.',
		title: 'Why does a program on someone’s computer need PKCE?',
		summary: 'Because the port proves nothing, and it has no secret.',
		mode: 'advanced',
		preset: 'on-their-computer-oidc',
		step: 'token-request'
	}),
	// What a real setup has together, each from a run of its own (#186).
	node({
		id: 'document-with-openid',
		alsoAskedAs: ['cimd openid connect', 'cimd id token'],
		answer:
			'Yes. On the server recorded it asked for openid and got an ID token, made out to the address of its document, because that is its client ID.',
		title: 'Does an app that points at a document get an ID token?',
		summary: 'Yes, made out to the address of its document.',
		mode: 'advanced',
		preset: 'points-at-a-document-oidc',
		step: 'token-response'
	}),
	node({
		id: 'document-with-another-provider',
		alsoAskedAs: ['cimd broker', 'cimd external idp'],
		answer:
			'On the server recorded, yes. The identity provider fetched the document first, then sent the browser to the other provider, and asked the user about the app once they were back.',
		title: 'Can an app that points at a document have its users log in at another provider?',
		summary: 'Yes: the document first, then the other provider, then the question.',
		mode: 'advanced',
		preset: 'points-at-a-document-broker',
		step: 'consent-page'
	}),
	node({
		id: 'refresh-with-another-provider',
		alsoAskedAs: ['refresh token broker', 'refresh token external idp'],
		answer:
			'At its own identity provider, as without one. On the server recorded, the other provider was not asked again, and the app never talked to it.',
		title: 'With another provider doing the login, where does the app refresh its token?',
		summary: 'At its own identity provider, and here the other one was not asked.',
		mode: 'advanced',
		preset: 'refresh-broker-pkce',
		step: 'refresh-request'
	}),
	node({
		id: 'second-app-with-another-provider',
		alsoAskedAs: ['sso broker', 'single sign-on external idp'],
		answer:
			'On the server recorded, no. The identity provider remembered the browser and sent the second app a code at once, with no login and no trip to the other provider.',
		title: 'With another provider, is the user sent there again for a second app?',
		summary: 'No: on the server recorded, it remembered them.',
		mode: 'advanced',
		preset: 'sso-broker-pkce',
		step: 'second-redirect-with-code'
	}),
	node({
		id: 'exchange-with-another-provider',
		alsoAskedAs: ['token exchange broker', 'token exchange external idp'],
		answer:
			'On the server recorded, yes, like any other. The API traded it at its own identity provider for one meant for the second API, and the other provider was not asked.',
		title: 'Can an API trade a token from a login at another provider?',
		summary: 'Yes, at its own identity provider.',
		mode: 'advanced',
		preset: 'exchange-broker',
		step: 'exchange-response'
	})
];

/** Everything with an address of its own. */
export const allNodes: readonly MapNode[] = [...mapNodes, ...offTheMap];
