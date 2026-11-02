import type { DiagramDef } from '#lib/flow/model.ts';
import { example } from '#lib/flow/libraries.ts';
import { apiWords, appWords, idpWords, upstreamWords } from '#lib/flow/parties.ts';
import { all, any, is, not } from '#lib/flow/settings.ts';

const oidc = is('oidc', true);
// Someone stole the code from an app with no secret, so the real app never gets as far as the API.
const reachesTheApi = not(
	any(all(is('attacker', true), is('clientType', 'public')), is('attackerUses', 'real-app'))
);
const confidential = is('clientType', 'confidential');
const broker = is('broker', true);
const storedTokens = any(is('upstreamTokens', 'v1'), is('upstreamTokens', 'v2'));
const apiV1 = is('upstreamTokens', 'v1');
const apiV2 = is('upstreamTokens', 'v2');

/**
 * What happens before any user arrives. It has a diagram of its own, because no user does this: the
 * people on it do. Each person sits next to the system they look after.
 */
export const authorizationCodeSetup: DiagramDef = {
	id: 'authorization-code-setup',
	title: 'Setting up the authorization code flow',
	caption: 'What people do first.',
	summary:
		'What people do before any user arrives, so the app and the identity provider know each other.',
	intro:
		'Before anyone can log in, two things have to happen. The identity provider has to learn about the app: what it is called, whether it can keep a secret, and where users may be sent back to. And the app has to learn about the identity provider: its address, where to send people, and how to check its tokens.',
	specs: ['rfc6749'],
	lifelines: [
		{
			id: 'app-team',
			plainName: 'You',
			plainRole: 'The app team',
			name: 'App team',
			role: 'People',
			icon: 'people',
			concept:
				'The people who build and run the app, which is probably you. They know where it runs, so they are the ones who know what to register.'
		},
		{
			id: 'app',
			plainName: 'App',
			plainRole: 'The one being set up',
			...appWords,
			icon: 'app',
			concept:
				'The application being set up. It has to learn about the identity provider before anyone logs in.'
		},
		{
			id: 'idp',
			plainName: 'Identity provider',
			plainRole: 'Will log users in',
			...idpWords,
			icon: 'idp',
			concept: 'The identity provider. It has to know about the app, and the issuer names it.'
		},
		{
			id: 'idp-admin',
			plainName: 'Admin',
			plainRole: 'Runs the provider',
			name: 'Provider admin',
			role: 'People',
			icon: 'people',
			concept:
				'The people who run the identity provider. They register apps in its admin console. On a small team, or a provider you pay for, this may be you as well.'
		},
		{
			id: 'upstream',
			plainName: 'Other provider',
			plainRole: 'Will do the login',
			...upstreamWords,
			icon: 'upstream',
			concept: 'Another identity provider, which the identity provider will trust to log users in.',
			when: broker
		},
		{
			id: 'api',
			plainName: 'API',
			plainRole: 'Will check tokens',
			...apiWords,
			icon: 'api',
			concept:
				'The API the app will call. It has a setup of its own, because it has to know which tokens to accept.'
		}
	],
	groups: [],
	parts: [
		{
			label: 'Register',
			why: 'An app registers with the identity provider before it can use it.',
			from: 'register-client'
		},
		{
			label: 'Set up the app',
			why: 'The app has to know which provider to trust, and where to find it.',
			from: 'configure-app'
		},
		{
			label: 'Set up the API',
			why: 'The API has to know who to trust, and how to check a token.',
			from: 'configure-api'
		}
	],
	steps: [
		{
			id: 'register-client',
			from: 'app-team',
			to: 'idp-admin',
			kind: 'human',
			plain: 'Ask to register the app',
			label: 'Ask to register the app',
			concept:
				'The app team, which is probably you, tells an admin where users may be sent back to, the redirect URIs, and whether the app can keep a secret, the client type. People do this, so there is no HTTP message.',
			inPractice:
				'You do this once, and again for each new address the app runs at, because each one has to be listed.',
			links: [{ diagram: 'flow', step: 'authorize', text: 'See where this address gets checked' }],
			fields: [
				{ name: 'redirect_uris', place: 'setting', note: 'Checked again during every login' },
				{ name: 'client type', place: 'setting' }
			]
		},
		{
			id: 'create-client',
			from: 'idp-admin',
			to: 'idp',
			kind: 'human',
			plain: 'Create the client',
			label: 'Create the client',
			concept:
				'The admin enters those values in the admin console. From here on, the identity provider knows this app.',
			fields: [
				{ name: 'client_id', place: 'setting' },
				{ name: 'client_secret', place: 'setting', artifact: 'secret', when: confidential }
			]
		},
		{
			id: 'hand-over-credentials',
			from: 'idp-admin',
			to: 'app-team',
			kind: 'human',
			plain: [
				{ when: confidential, text: 'Hand over the client ID and secret' },
				{ text: 'Hand over the client ID' }
			],
			label: [
				{ when: confidential, text: 'Hand over client ID and secret' },
				{ text: 'Hand over client ID' }
			],
			concept: [
				{
					when: confidential,
					text: 'The admin passes the client ID and secret back to the app team.'
				},
				{ text: 'The admin passes the client ID back. A public client has no secret to keep.' }
			],
			inPractice: [
				{
					when: confidential,
					text: 'Keep the secret out of your code and your repository, as you would a password.'
				},
				{ text: 'The client ID is not a secret, so it can go in your code.' }
			],
			fields: [
				{ name: 'client_id', place: 'setting' },
				{ name: 'client_secret', place: 'setting', artifact: 'secret', when: confidential }
			]
		},
		{
			id: 'register-with-upstream',
			from: 'idp-admin',
			to: 'upstream',
			kind: 'human',
			plain: 'Register with the other provider',
			label: 'Register as a client',
			concept:
				'The identity provider is itself a client of the other provider, so it has to be registered there the same way.',
			when: broker,
			fields: [
				{
					name: 'redirect_uris',
					place: 'setting',
					note: "The identity provider's broker endpoint"
				},
				{ name: 'client_id', place: 'setting' },
				{ name: 'client_secret', place: 'setting' }
			]
		},
		{
			id: 'enable-token-storage',
			from: 'idp-admin',
			to: 'idp',
			kind: 'human',
			plain: 'Allow keeping its tokens',
			label: 'Allow token storage',
			concept: [
				{
					when: apiV2,
					text: 'An admin turns on token storage for the other provider, and allows this client to retrieve the tokens.'
				},
				{
					text: 'An admin turns on token storage for the other provider, and gives the user a role to read them.'
				}
			],
			when: storedTokens,
			fields: [
				{ name: 'Store Tokens', place: 'setting' },
				{ name: 'read-token role', place: 'setting', when: apiV1 },
				{ name: 'Allow retrieve external tokens', place: 'setting', when: apiV2 }
			]
		},
		{
			id: 'configure-app',
			from: 'app-team',
			to: 'app',
			kind: 'human',
			plain: 'Configure the app',
			label: 'Configure the app',
			concept: [
				{
					when: confidential,
					text: 'The team gives the app the issuer URL, the client ID and the secret.'
				},
				{ text: 'The team gives the app the issuer URL and the client ID.' }
			],
			inPractice:
				'This is most of what you write for a login: these values in your configuration, and a library that takes them. What is left is where a step says so, and your own session for the user.',
			practice: [example('authjs', true, 'takes the issuer, client ID and secret')],
			fields: [
				{ name: 'issuer', place: 'setting' },
				{ name: 'client_id', place: 'setting' },
				{ name: 'client_secret', place: 'setting', artifact: 'secret', when: confidential }
			]
		},
		{
			id: 'discover',
			from: 'app',
			to: 'idp',
			kind: 'request',
			plain: "The app looks up the provider's addresses",
			label: 'GET /.well-known/…',
			execute: { answer: 'discovery-document' },
			inPractice:
				'Many libraries do this when they start. Others want the addresses in your configuration.',
			practice: [
				example('openidClient', true, 'with discovery'),
				example('passport', false, 'wants the addresses as options')
			],
			concept:
				'The app starts from the issuer URL and asks the identity provider where everything else is.',
			fields: [
				{ name: '/.well-known/openid-configuration', place: 'path', when: oidc },
				{ name: '/.well-known/oauth-authorization-server', place: 'path', when: not(oidc) }
			]
		},
		{
			id: 'discovery-document',
			from: 'idp',
			to: 'app',
			kind: 'response',
			plain: 'Where everything is',
			label: 'Endpoints',
			concept:
				"The identity provider's endpoints, and where to find the keys that verify its tokens.",
			fields: [
				{ name: 'issuer', place: 'body' },
				{ name: 'authorization_endpoint', place: 'body' },
				{ name: 'token_endpoint', place: 'body' },
				{ name: 'jwks_uri', place: 'body' },
				{ name: 'userinfo_endpoint', place: 'body', when: oidc }
			]
		},
		{
			id: 'configure-api',
			from: 'app-team',
			to: 'api',
			kind: 'human',
			plain: 'You tell the API who to trust',
			label: 'Configure the API',
			concept:
				'The API has to be told which issuer to trust, and what name tokens have to carry for it. Without the second, any token from that issuer gets in, including those meant for another API.',
			inPractice:
				'A library or a gateway takes these two values, and checks the rest. Do not leave out the audience, which it may let you do.',
			practice: [
				example('jose', true, 'when you pass it the issuer and audience'),
				example('awsJwt', true, 'once it is given them')
			],
			links: [
				{
					diagram: 'flow',
					step: 'api-check-token',
					text: 'See where these get checked',
					when: reachesTheApi
				}
			],
			fields: [
				{ name: 'issuer', place: 'setting' },
				{ name: 'audience', place: 'setting', note: 'The name a token has to carry for this API' }
			]
		},
		{
			id: 'fetch-keys',
			from: 'api',
			to: 'idp',
			kind: 'request',
			plain: 'The API gets the keys',
			label: 'GET jwks_uri',
			concept:
				'The API looks up the keys that check signatures, at the address discovery gives. After that it does not need to call the identity provider for each token, only when it meets a key it does not know.',
			fields: [{ name: '/certs', place: 'path', note: 'The jwks_uri from the discovery document' }]
		},
		{
			id: 'keys',
			from: 'idp',
			to: 'api',
			kind: 'response',
			plain: 'The keys that check tokens',
			label: '200 with keys',
			concept:
				'The public half of the keys the identity provider signs with. Anyone can have these, because they can only check a signature and not make one.',
			links: [
				{
					diagram: 'flow',
					step: 'open-app',
					text: 'Setup is done. See what happens when a user arrives'
				}
			],
			fields: [{ name: 'keys', place: 'body' }]
		}
	]
};
