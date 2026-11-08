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
/** A question, with the defaults most have. */
export const node = (
	fields: Omit<MapNode, 'flow' | 'diagram' | 'mode'> & Partial<MapNode>
): MapNode => ({
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
				// The headline of #148, on a company network with the same directory (2026-11-08).
				node({
					id: 'no-password-on-the-network',
					alsoAskedAs: [
						'kerberos',
						'spnego',
						'negotiate',
						'windows login',
						'windows authentication',
						'active directory',
						'ticket',
						'single sign-on on the company network',
						'why did I not have to log in',
						'windows login no password',
						'integrated windows authentication',
						'login page instead of single sign-on',
						'kerberos not working'
					],
					answer:
						'Logging in to your computer got it a Kerberos ticket, and with that a ticket for the identity provider, which the browser sent in place of a password. A browser that was not told it may send one there gets the login page instead.',
					title: 'Why did I not have to log in?',
					summary: 'A ticket from logging in to the computer, sent in place of a password.',
					mode: 'advanced',
					preset: 'kerberos',
					step: 'send-ticket'
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
				})
			]
		]
	}
];

export const mapNodes: readonly MapNode[] = mapTracks.flatMap((track) => track.chains.flat());
