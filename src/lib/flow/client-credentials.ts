import type { DiagramDef } from '#lib/flow/model.ts';
import { example } from '#lib/flow/libraries.ts';
import { apiWords, appWords, idpWords } from '#lib/flow/parties.ts';
import { is } from '#lib/flow/settings.ts';

const dpop = is('binding', 'dpop');
const bearer = is('binding', 'bearer');

/**
 * Every field here is held to the recordings of a real Keycloak, as they are for the other flow. It
 * has no browser and no user, so it is what shows whether the model was only ever about a login.
 */
export const clientCredentials: DiagramDef = {
	id: 'client-credentials',
	title: 'Client credentials flow',
	named: 'The flow',
	caption: 'What happens with no user.',
	summary: 'An app gets access for itself, with no user and no browser.',
	intro:
		'Some apps act for nobody: a nightly job, or one service calling another. There is no user to log in and no browser to go through, so the app asks for a token with its own secret. Press Next to follow it, one message at a time.',
	specs: ['rfc6749', 'rfc6750'],
	lifelines: [
		{
			id: 'app',
			plainName: 'App',
			plainRole: 'Acts for itself',
			...appWords,
			icon: 'app',
			startsWith: [{ artifact: 'secret' }],
			concept:
				'An application acting for itself, such as a job or a service. In OAuth’s terms it is the client. There is nobody behind it, and it has nobody’s permission but its own.'
		},
		{
			id: 'idp',
			plainName: 'Identity provider',
			plainRole: 'Hands out tokens',
			...idpWords,
			icon: 'idp',
			startsWith: [{ artifact: 'secret' }],
			concept:
				'The identity provider usually logs users in. Here nobody does, so all it does is check who the app is and hand out a token. Its issuer is the address that names it, and a token it signs says who issued it.'
		},
		{
			id: 'api',
			plainName: 'API',
			plainRole: 'Has the data',
			...apiWords,
			icon: 'api',
			concept: 'What the app wants to call. It decides from the token whether to answer.'
		}
	],
	groups: [],
	parts: [
		{
			label: 'Ask',
			why: 'With no user to ask, the app asks for itself.',
			from: 'service-make-key'
		},
		{
			label: 'Use',
			why: 'This is what the token was for, and whatever gets the call decides what to do with it.',
			from: 'service-api-request'
		}
	],
	steps: [
		{
			id: 'service-make-key',
			from: 'app',
			to: 'app',
			kind: 'internal',
			plain: 'The app makes a key pair',
			label: 'Generate a key pair',
			concept:
				'DPoP ties the token to a key only this app holds, so at an API that checks the proof a stolen token is useless without the key.',
			inPractice: 'A library does this, if it supports DPoP. Not all of them do yet.',
			practice: [example('oauth4webapi', true, 'has DPoP, and you give it the key')],
			when: dpop
		},
		{
			id: 'service-token-request',
			cites: [
				{
					source: 'rfc9700',
					section: '2.5',
					why: 'Section 2.5 recommends proving who a client is with a key, such as mutual TLS or a signed JWT, over a shared secret.'
				}
			],
			from: 'app',
			to: 'idp',
			kind: 'request',
			plain: 'The app asks for a token, as itself',
			label: 'POST /token',
			execute: { answer: 'service-token-response' },
			concept:
				'With no user and no browser, the app asks directly, and proves who it is with its secret. There is no redirect and no code, because nobody has to be sent anywhere to agree to anything.',
			inPractice:
				'A library does this. Keep the secret in your configuration, and out of your code.',
			practice: [example('openidClient', true, 'with its client credentials grant')],
			pitfall: {
				title: 'What if this secret gets out?',
				text: 'Whoever has it can get tokens as this app, and there is no user who would notice. So it is kept out of the code, and changed now and then. A key the server never sees is stronger than a shared secret, and current advice recommends one, though not every provider offers it.'
			},
			fields: [
				{ name: 'grant_type=client_credentials', place: 'body' },
				{
					name: 'Authorization: Basic',
					place: 'header',
					note: 'The client ID and secret, joined with a colon and Base64-encoded',
					artifact: 'secret'
				},
				{
					name: 'DPoP',
					place: 'header',
					note: 'A proof signed with that key',
					artifact: 'proof',
					when: dpop
				}
			]
		},
		{
			id: 'service-token-response',
			cites: [
				{
					source: 'rfc6749',
					section: '4.4.3',
					why: 'Section 4.4.3 is the answer in this flow, and says a refresh token should not be included.'
				}
			],
			from: 'idp',
			to: 'app',
			kind: 'response',
			plain: 'An access token',
			label: 'Access token',
			concept:
				'An access token is all there is. There is no ID token, because nothing asked for one and nobody logged in for it to be about, and no refresh token, because it would add nothing: when this one runs out, the app asks again with its secret.',
			inPractice:
				'A library takes this. Keep it and use it until it runs out, because asking for a new one for each call makes every call slower.',
			fields: [
				{ name: 'access_token', place: 'body', artifact: 'access-token' },
				{ name: 'token_type=Bearer', place: 'body', when: bearer },
				{ name: 'token_type=DPoP', place: 'body', when: dpop },
				{ name: 'expires_in', place: 'body' },
				{ name: 'scope', place: 'body' }
			]
		},
		{
			id: 'service-api-request',
			from: 'app',
			to: 'api',
			kind: 'request',
			plain: 'The app calls the API with the token',
			label: 'GET /resource',
			concept: [
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
			id: 'service-check-token',
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
					text: 'The API checks the signature, who issued the token, that it has not expired, and who it is for, the same as for a token with a user behind it. Where the claims of that one name the user, these name the app.'
				}
			],
			inPractice: [
				{
					when: dpop,
					text: 'An ordinary JWT library or gateway checks the token and ignores the proof, so it takes a stolen DPoP token sent as Bearer. Checking the proof takes a library that does DPoP.'
				},
				{
					text: 'A library or a gateway does this, once you tell it the issuer and who tokens have to be for. Which scopes a request needs is yours to set, in code or on the gateway.'
				}
			],
			practice: [
				example('springSecurity', true, 'can check the proof', dpop),
				example('jose', true, 'when you pass it the issuer and audience', bearer)
			],
			pitfall: {
				title: 'What if the API wants its own name in the token?',
				text: 'Then this app’s tokens have to carry it, or an API that checks the audience refuses them. How depends on the provider: some take it in the request for the token, and some set it up on their side, so ask whoever runs it.'
			},
			links: [
				{
					diagram: 'setup',
					step: 'service-configure-api',
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
				},
				{ name: 'cnf.jkt', place: 'token', note: 'The key the token is tied to', when: dpop }
			]
		},
		{
			id: 'service-api-response',
			from: 'api',
			to: 'app',
			kind: 'response',
			plain: 'The API answers',
			label: '200 with the resource',
			concept: 'The app has what it came for, and no person was involved at any point.',
			fields: []
		}
	]
};
