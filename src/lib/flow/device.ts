import type { DiagramDef, FieldDef } from '#lib/flow/model.ts';
import { example } from '#lib/flow/libraries.ts';
import { apiWords, appWords, browserWords, idpWords } from '#lib/flow/parties.ts';
import { is } from '#lib/flow/settings.ts';

const oidc = is('oidc', true);

const DEVICE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';

const asking: readonly FieldDef[] = [
	{ name: `grant_type=${DEVICE_GRANT}`, place: 'body' },
	{
		name: 'device_code',
		place: 'body',
		artifact: 'device-code',
		note: 'The same one every time, until the answer changes'
	},
	{ name: 'client_id', place: 'body' }
];

/**
 * RFC 8628, held to the recordings of a real Keycloak like the other flows. The app and the browser
 * have no way to reach each other, so what joins them is a person reading a code, and the app finds
 * out how it went by asking. A request stands for all of those it repeats, because one real run asks
 * as often as it takes, and how often is not what this is about.
 */
export const device: DiagramDef = {
	id: 'device',
	title: 'Device flow',
	named: 'The flow',
	caption: 'What happens on two devices.',
	summary: 'An app with no good way to log anyone in, and a user who does that on another device.',
	intro:
		'Some apps have no good way to log anyone in: on a TV there is no keyboard, and in a terminal on a server there is no browser. So the user does it somewhere else, on their phone or laptop, and the app waits. An app that can open a browser should use that instead. Press Next to follow it, one message at a time.',
	specs: ['rfc8628', 'rfc6749'],
	lifelines: [
		{
			id: 'browser',
			plainName: "User's browser",
			plainRole: 'On another device',
			...browserWords,
			icon: 'browser',
			front: true,
			concept:
				'A browser on another device, usually the user’s phone, or the laptop they are working from. It never talks to the app and the app never talks to it. All that goes between them is what the user carries.'
		},
		{
			id: 'app',
			plainName: 'App',
			plainRole: 'On a TV, say',
			...appWords,
			icon: 'app',
			concept:
				'An application on something that is no good for logging in: a TV, a printer, or a tool in a terminal with no browser to hand. In OAuth’s terms it is the client. It makes calls, and this flow does not need anything to be able to call it. It has no secret here, because software on someone’s own device generally cannot keep one.'
		},
		{
			id: 'idp',
			plainName: 'Identity provider',
			plainRole: 'Logs users in',
			...idpWords,
			icon: 'idp',
			concept:
				'The identity provider logs the user in, as it does anywhere. Here it is also the only one that talks to both the app and the browser, so it is what ties a login on one device to an app on another. Its issuer is the address that names it.'
		},
		{
			id: 'api',
			plainName: 'API',
			plainRole: 'Has the data',
			...apiWords,
			icon: 'api',
			concept:
				'What the app wants to call. It decides from the token whether to answer, and does not need to know which flow got it.'
		}
	],
	groups: [],
	parts: [
		{
			label: 'Ask',
			why: 'The app has no good way to send the user anywhere, so it asks for something to show them.',
			from: 'device-request'
		},
		{
			label: 'Wait',
			why: 'Nothing here tells the app when the user is done, so it keeps asking.',
			from: 'device-poll'
		},
		{
			label: 'Log in',
			why: 'The user does this on another device, and the app has no part in it.',
			from: 'device-open-page'
		},
		{
			label: 'Collect',
			why: 'The next time the app asks, the answer is different.',
			from: 'device-poll-again'
		},
		{
			label: 'Use',
			why: 'This is what the token was for, and whatever gets the call decides what to do with it.',
			from: 'device-api-request'
		}
	],
	steps: [
		{
			id: 'device-request',
			cites: [
				{
					source: 'rfc8628',
					section: '3.1',
					why: 'Section 3.1 is this request, and says a client should only start it when the user asks, not by itself when the app starts.'
				}
			],
			from: 'app',
			to: 'idp',
			kind: 'request',
			plain: 'The app asks for a code to show',
			label: 'POST /device_authorization',
			execute: { answer: 'device-response' },
			concept:
				'The app has no good way to send the user through a browser, and this flow does not count on anything calling it back. So it asks the identity provider directly to start a login that someone will finish elsewhere.',
			inPractice:
				'A library does this. Start it when the user asks to log in and not when the app starts, because it sets off all the asking that follows.',
			practice: [example('openidClient', true, 'with its device authorization grant')],
			fields: [
				{ name: 'client_id', place: 'body' },
				{ name: 'scope=openid', place: 'body', when: oidc }
			]
		},
		{
			id: 'device-response',
			cites: [
				{
					source: 'rfc8628',
					section: '3.2',
					why: 'Section 3.2 is this answer, with what each value is for, and that an app which is given no interval has to wait 5 seconds.'
				}
			],
			from: 'idp',
			to: 'app',
			kind: 'response',
			plain: 'Two codes, and where to go',
			label: '200 with two codes',
			concept:
				'The user code is short, for a person to read and type. The device code is long, and the app keeps it to itself. One says which login this is, and the other is what the tokens will go to. So someone who sees the first gets no token for themselves. They could still type it in before the user does, and then the device is logged in as them.',
			inPractice:
				'A library takes this. Show the user code and the address, and do not show the device code, which is not meant for the user.',
			fields: [
				{
					name: 'device_code',
					place: 'body',
					artifact: 'device-code',
					note: 'Stays with the app, and is what will get the tokens'
				},
				{ name: 'user_code', place: 'body', artifact: 'user-code', note: 'For the user to type' },
				{ name: 'verification_uri', place: 'body', note: 'Where the user goes' },
				{
					name: 'verification_uri_complete',
					place: 'body',
					note: 'The same address with the user code in it, for a QR code'
				},
				{ name: 'expires_in', place: 'body', note: 'How many seconds these two codes last' },
				{ name: 'interval', place: 'body', note: 'How many seconds to wait between asking' }
			]
		},
		{
			id: 'device-show-code',
			cites: [
				{
					source: 'rfc8628',
					section: '3.3',
					why: 'Section 3.3 is this step: the app shows the user code and the address, and the user goes there in a browser on another device.'
				},
				{
					source: 'rfc8628',
					section: '3.3.1',
					why: 'Section 3.3.1 allows a QR code of the full address, and says the app must still show the user code.'
				},
				{
					source: 'rfc8628',
					section: '5.5',
					why: 'Section 5.5 is someone who can see the screen finishing first, and says a device should take into account where it shows the user code.'
				}
			],
			from: 'app',
			to: 'browser',
			kind: 'human',
			plain: 'The app shows an address and a code',
			label: 'Show the address and user code',
			concept:
				'No HTTP message here. The app shows these, usually on its screen, and the user carries them to a browser on another device, by typing them or with a QR code. That is all this flow needs to join the two, and it goes one way.',
			inPractice:
				'This part is your code: how it looks on your screen. If the server sends a full address, a QR code of it saves the typing. The user code still has to be on screen, and the plain address should be too.',
			pitfall: {
				title: 'What if someone else can see the screen?',
				text: 'They could type the user code in before the user does. They get no token for themselves, but the device ends up logged in as them. So it matters who can see it, wherever it is shown.'
			},
			fields: [
				{ name: 'verification_uri', place: 'memory', note: 'On the screen, for the user to read' },
				{
					name: 'user_code',
					place: 'memory',
					artifact: 'user-code',
					note: 'On the screen, for the user to read'
				}
			]
		},
		{
			id: 'device-poll',
			cites: [
				{
					source: 'rfc8628',
					section: '3.4',
					why: 'Section 3.4 is this request, and says it is expected to be tried again and again, going by the answer.'
				}
			],
			from: 'app',
			to: 'idp',
			kind: 'request',
			plain: 'The app asks whether the user is done',
			label: 'POST /token',
			execute: { answer: 'device-pending' },
			concept:
				'While the user does their part, the app asks the identity provider again and again, with the device code. The flow does not count on anything being able to call the app back, so asking is how it finds out. This one stands for all of those.',
			inPractice:
				'A library does this, and waits between calls as long as it was told. If nothing has happened when the codes run out, it stops.',
			practice: [example('openidClient', true, 'keeps asking for you')],
			fields: asking
		},
		{
			id: 'device-pending',
			cites: [
				{
					source: 'rfc8628',
					section: '3.5',
					why: 'Section 3.5 defines this answer and slow_down, and says any other error means to stop asking.'
				}
			],
			from: 'idp',
			to: 'app',
			kind: 'response',
			plain: 'Not yet',
			label: '400 authorization_pending',
			concept:
				'On the wire this is an error, and here it is the ordinary answer. It means the user has not finished, so the app waits as long as the interval said, and asks again.',
			pitfall: {
				title: 'What other answers can there be?',
				text: 'If it asks too fast, the answer can be slow_down, and the app then has to wait 5 seconds longer from then on. That and this answer are the only two that mean carry on. Any other error means stop asking: access_denied if the user said no, and expired_token if the codes ran out. A connection timeout is not an answer, so the app asks less often and tries again.'
			},
			fields: [
				{ name: 'error=authorization_pending', place: 'body' },
				{ name: 'error_description', place: 'body' }
			]
		},
		{
			id: 'device-open-page',
			from: 'browser',
			to: 'idp',
			kind: 'request',
			plain: 'The user opens the address',
			label: 'GET /device',
			concept:
				'On another device, usually their phone, or the laptop they are working from. It takes this address from the app’s screen, and from here on the app is not involved.'
		},
		{
			id: 'device-code-page',
			from: 'idp',
			to: 'browser',
			kind: 'response',
			plain: 'It asks for the user code',
			label: 'Page asking for the user code',
			page: {
				address: 'device-open-page',
				shows: "The identity provider's own page, asking for the user code the device shows.",
				shot: 'device-code'
			},
			concept:
				'The user code says which waiting app this is about. Without it, the identity provider cannot tell which one of them this person is here for.'
		},
		{
			id: 'device-submit-code',
			cites: [
				{
					source: 'rfc8628',
					section: '5.1',
					why: 'Section 5.1 recommends limiting tries, and says that someone who guesses a code would approve it with their own account, leaving the device logged in as them.'
				}
			],
			from: 'browser',
			to: 'idp',
			kind: 'request',
			plain: 'The user types it in',
			label: 'POST /device',
			concept:
				'Now the identity provider knows which login this is. The address and this code are all that have crossed from one device to the other.',
			pitfall: {
				title: 'What if someone guesses a code?',
				text: 'A short code has few enough possibilities that a server should limit the tries. Someone who got one right could only approve it with their own account, so the device would end up logged in as them, and not the other way round. That can still matter: what is done on the device lands in their account, and on some devices that account gets to control it.'
			},
			fields: [
				{
					name: 'device_user_code',
					place: 'body',
					artifact: 'user-code',
					note: 'How this page sends the user code, which is up to the server'
				}
			]
		},
		{
			id: 'device-login-page',
			cites: [
				{
					source: 'rfc8628',
					section: '3.3',
					why: 'Section 3.3 says the user has to go to the address and give the user code at some stage, and leaves the rest of the order to the server.'
				}
			],
			from: 'idp',
			to: 'browser',
			kind: 'response',
			plain: 'The login page',
			label: '302 to the login page',
			page: {
				address: 'device-login-page',
				shows: "The identity provider's own page, asking for a username and a password.",
				shot: 'login',
				marks: ['client_id']
			},
			concept:
				'The same login as anywhere. The spec leaves the order to the server, and this one asks for the user code first.'
		},
		{
			id: 'device-submit-credentials',
			cites: [
				{
					source: 'rfc8628',
					section: '5.3',
					why: 'Section 5.3 says someone could end up on the login page of the wrong service, and that the address bar is their chance to notice.'
				}
			],
			from: 'browser',
			to: 'idp',
			kind: 'request',
			plain: 'The user enters their password',
			label: 'Submit credentials',
			concept:
				'The user signs in at the identity provider, on a device of their own. The app sees none of this. That does not make a device you distrust safe: the address came from the device, so the address bar is worth a look.',
			fields: [{ name: 'username and password', place: 'body', artifact: 'password' }]
		},
		{
			id: 'device-consent-page',
			cites: [
				{
					source: 'rfc8628',
					section: '3.3',
					why: 'Section 3.3 says the server should tell the user what they are doing, and ask them to approve or deny it.'
				},
				{
					source: 'rfc8628',
					section: '5.4',
					why: 'Section 5.4 is this attack, and recommends telling the user they are authorizing a device, and confirming it is theirs.'
				}
			],
			from: 'idp',
			to: 'browser',
			kind: 'response',
			plain: 'What the app is asking for',
			label: '302 to the page that asks',
			inPractice:
				'You cannot do much about this from your app, because it uses the app as it is meant to be used. Tell users only to enter a code they started themselves, keep the codes short-lived, and ask whoever runs the provider whether this page can say a device is being connected.',
			page: {
				address: 'device-consent-page',
				shows:
					"The identity provider's own page, naming the app and what it would get, and asking the user to agree.",
				shot: 'device-consent'
			},
			concept:
				'The identity provider says which app this is and what it would get, and asks the user to agree. It matters more here than anywhere, because it is the last place someone can notice that the user code they were given is not for a device of theirs.',
			pitfall: {
				title: 'What if someone sent them that code?',
				text: 'Anyone can start this flow on a device of their own, and send someone the address and the user code, in an email, say. If that person logs in and agrees, the tokens go to whoever started it, and no password was given away. This page is the last thing in the way, and it can name an app the user knows, because anyone can send that app’s client ID. So it should say a device is being connected, and ask whether it is theirs.'
			}
		},
		{
			id: 'device-consent-grant',
			from: 'browser',
			to: 'idp',
			kind: 'request',
			plain: 'The user agrees',
			label: 'Grant access',
			concept:
				'The user says yes, and the identity provider marks the waiting login as approved. The app is still asking, and does not know yet.',
			fields: [
				{
					name: 'accept',
					place: 'body',
					note: 'How this form says yes, which is up to the server'
				},
				{
					name: 'code',
					place: 'body',
					note: "The server's own login session, and neither of the two codes in this flow"
				}
			]
		},
		{
			id: 'device-done-page',
			from: 'idp',
			to: 'browser',
			kind: 'response',
			plain: 'Done, back to the device',
			label: '302 to a page saying so',
			page: {
				address: 'device-done-page',
				shows:
					"The identity provider's own page, saying this is done and to go back to the device.",
				shot: 'device-done'
			},
			concept:
				'The browser’s part is over, and the tokens never come here. It gets a cookie, so the identity provider knows it next time, and a page telling the user to go back to the device. Nothing on that page reaches the device.',
			fields: [
				{
					name: 'Set-Cookie',
					place: 'header',
					note: 'The session, on the address of the identity provider',
					artifact: 'session'
				}
			]
		},
		{
			id: 'device-poll-again',
			from: 'app',
			to: 'idp',
			kind: 'request',
			plain: 'The app asks again',
			label: 'POST /token',
			execute: { answer: 'device-token-response' },
			concept:
				'The same request as every other time, with the same device code. It never went near the browser or the user, and whoever sends it as this app gets what comes next.',
			fields: asking
		},
		{
			id: 'device-token-response',
			cites: [
				{
					source: 'rfc8628',
					section: '3.5',
					why: 'Section 3.5 says this is an ordinary token response once the user has approved, and lists access_denied and expired_token as the errors when they did not.'
				}
			],
			from: 'idp',
			to: 'app',
			kind: 'response',
			plain: [{ when: oidc, text: 'An access token and an ID token' }, { text: 'An access token' }],
			label: [{ when: oidc, text: 'Access token and ID token' }, { text: 'Access token' }],
			concept: [
				{
					when: oidc,
					text: 'The access token is for the API, and the ID token tells the app who logged in, which is whoever agreed on the other device. The app never saw the password, and the browser never saw a token.'
				},
				{
					text: 'The access token lets the app call the API, and a refresh token, where the server gives one, gets a new one later without the user. The app never saw the password, and the browser never saw a token.'
				}
			],
			inPractice:
				'A library takes these. Where they are kept is up to you, and on a device someone else owns, they may be able to get at what is stored on it. A refresh token is what saves the user doing all this again, so how long it lasts is worth asking about.',
			pitfall: {
				title: 'What if the user says no, or never finishes?',
				text: 'Then the answer is an error and not tokens: access_denied if they said no, and expired_token if the codes ran out. Either way the app stops asking, and trying again takes new codes, once the user asks to.'
			},
			fields: [
				{ name: 'access_token', place: 'body', artifact: 'access-token' },
				{ name: 'token_type=Bearer', place: 'body' },
				{ name: 'id_token', place: 'body', artifact: 'id-token', when: oidc },
				{ name: 'expires_in', place: 'body' },
				{
					name: 'refresh_token',
					place: 'body',
					artifact: 'refresh-token',
					note: 'Gets a new access token later, without the user'
				},
				{ name: 'scope', place: 'body' }
			]
		},
		{
			id: 'device-check-id-token',
			when: oidc,
			from: 'app',
			to: 'app',
			kind: 'internal',
			plain: 'The app checks the ID token',
			label: 'Check the ID token',
			concept:
				'The app checks who issued it, and that it is meant for this app. There is no nonce to compare here, because the request at the start did not send one. A nonce is for catching a code slipped in through a browser, and nothing reaches this app through a browser.',
			inPractice: 'A library does this, once you have given it the issuer and your client ID.',
			practice: [example('openidClient', true, 'checks it when it takes the answer')],
			fields: [
				{ name: 'iss', place: 'token' },
				{ name: 'aud', place: 'token' },
				{ name: 'exp', place: 'token' },
				{ name: 'sub', place: 'token' }
			]
		},
		{
			id: 'device-api-request',
			from: 'app',
			to: 'api',
			kind: 'request',
			plain: 'The app calls the API with the token',
			label: 'GET /resource',
			concept: 'The app sends the access token. Whoever holds a bearer token can use it.',
			inPractice:
				'This part is your code, though a library can add the token to each call for you.',
			practice: [example('oauth4webapi', true, 'with protectedResourceRequest')],
			fields: [{ name: 'Authorization: Bearer', place: 'header', artifact: 'access-token' }]
		},
		{
			id: 'device-check-token',
			from: 'api',
			to: 'api',
			kind: 'internal',
			plain: 'The API checks the token',
			label: 'Check the token',
			concept:
				'The API checks the signature, who issued the token, that it has not expired, and who it is for, the same as for a token from any other flow.',
			inPractice:
				'A library or a gateway does this, once you tell it the issuer and who tokens have to be for. Which scopes a request needs is yours to set, in code or on the gateway.',
			practice: [example('jose', true, 'when you pass it the issuer and audience')],
			pitfall: {
				title: 'What if the API wants its own name in the token?',
				text: 'Then this app’s tokens have to carry it, or an API that checks the audience refuses them. How depends on the provider: some take it in a request, and some set it up on their side, so ask whoever runs it.'
			},
			links: [
				{
					diagram: 'setup',
					step: 'device-configure-api',
					text: 'See how the API was told who to trust'
				}
			],
			fields: [
				{ name: 'iss', place: 'token' },
				{ name: 'aud', place: 'token' },
				{ name: 'exp', place: 'token' },
				{
					name: 'scope',
					place: 'token',
					note: 'What the token allows, to compare with what this request needs'
				}
			]
		},
		{
			id: 'device-api-response',
			from: 'api',
			to: 'app',
			kind: 'response',
			plain: 'The API answers',
			label: '200 with the resource',
			concept:
				'The app has what it came for, on behalf of a user who never typed a password into it.',
			fields: []
		}
	]
};
