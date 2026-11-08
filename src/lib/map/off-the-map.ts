// Questions with an address and no place on the map, kept apart from it so that the home page, which
// shows the map, does not load them. Each new recording off the map would otherwise add to its first
// load, which has a budget (home.spec.ts).
import { mapNodes, node, type MapNode } from './tracks.ts';

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
	// Asked for on 2026-11-08, so the pictures of second factors rest on a real server too.
	node({
		id: 'second-factor',
		alsoAskedAs: ['2fa', 'mfa', 'totp', 'authenticator app', 'one-time code'],
		answer:
			'After the password, the identity provider asks for a code from the user’s authenticator app, and only then sends them back. On the server recorded, the token was the same either way: nothing in it said a second factor was used.',
		title: 'What does a second factor change in the login?',
		summary: 'One more page and one more form, and the same token after.',
		mode: 'advanced',
		preset: 'one-time-code',
		step: 'otp-page'
	}),
	node({
		id: 'new-signing-key',
		alsoAskedAs: ['key rotation', 'rotate keys', 'kid', 'jwks', 'unknown kid'],
		answer:
			'A token names its key, as kid. When the identity provider signs with a new one, an API that fetched the keys before does not know it, and fetches them again. On the server recorded, the new set had the new key and the old one.',
		title: 'What happens when the identity provider changes its key?',
		summary: 'The API fetches the keys again, for a key it does not know.',
		mode: 'advanced',
		preset: 'new-key',
		step: 'api-fetch-keys'
	}),
	node({
		id: 'passkey-login',
		alsoAskedAs: ['passkey login', 'log in with a passkey', 'webauthn', 'passwordless'],
		answer:
			'The login page asks the browser for a passkey for this site, and the device signs the page’s challenge once the user unlocks it. On the server recorded, no password was sent, and the token was the same as after one.',
		title: 'What does logging in with a passkey look like?',
		summary: 'A signed challenge in place of a password, for this site only.',
		mode: 'advanced',
		preset: 'passkey',
		step: 'submit-passkey'
	}),
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
