import type { DiagramDef } from '#lib/flow/model.ts';
import { example } from '#lib/flow/libraries.ts';
import { apiWords, appWords, idpWords } from '#lib/flow/parties.ts';
import { is } from '#lib/flow/settings.ts';

const oidc = is('oidc', true);

/** What happens before anyone starts this on a device, which is less than for an app with a redirect. */
export const deviceSetup: DiagramDef = {
	id: 'device-setup',
	title: 'Setting up the device flow',
	caption: 'What people do first.',
	summary:
		'What people do before anyone starts the app, so the app and the identity provider know each other.',
	intro:
		'There is no address to send anyone back to, because nobody gets sent back, and usually no secret, because it could be read off the device. The identity provider still has to learn about the app, and the app about the identity provider.',
	specs: ['rfc8628', 'rfc6749'],
	lifelines: [
		{
			id: 'app-team',
			plainName: 'You',
			plainRole: 'The app team',
			name: 'App team',
			role: 'People',
			icon: 'people',
			concept:
				'The people who build and ship the app, which is probably you. They know what it needs to do, so they are the ones who ask.'
		},
		{
			id: 'app',
			plainName: 'App',
			plainRole: 'The one being set up',
			...appWords,
			icon: 'app',
			concept:
				'The application being set up. It has to learn about the identity provider before it can ask for anything.'
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
			from: 'device-register'
		},
		{
			label: 'Set up the app',
			why: 'The app has to know which provider to trust, and where to find it.',
			from: 'device-configure'
		},
		{
			label: 'Set up the API',
			why: 'The API has to know who to trust, and how to check a token.',
			from: 'device-configure-api'
		}
	],
	steps: [
		{
			id: 'device-register',
			cites: [
				{
					source: 'rfc8628',
					section: '5.6',
					why: 'Section 5.6 says clients on a device generally cannot keep a secret, because whoever has the device can extract it, so unless more is done they should be treated as public clients.'
				}
			],
			from: 'app-team',
			to: 'idp-admin',
			kind: 'human',
			plain: 'Ask to register the app',
			label: 'Ask to register the app',
			concept:
				'The app team, which is probably you, asks an admin to register the app, and to let it use this flow. There is no address to list, because nobody gets sent back anywhere, and usually no secret to ask for, because anyone with the device could get it out. People do this, so there is no HTTP message.',
			inPractice:
				'You do this once. Say what the app has to call, because its tokens have to carry the name of that API, and how long people should stay logged in.',
			fields: [{ name: 'client type', place: 'setting', note: 'One with no secret' }]
		},
		{
			id: 'device-create-client',
			from: 'idp-admin',
			to: 'idp',
			kind: 'human',
			plain: 'Create the client',
			label: 'Create the client',
			concept:
				'The admin creates the client in the admin console, with no secret, and, where the server wants it, allows this app to use this flow. From here on, the identity provider knows it.',
			fields: [
				{ name: 'client_id', place: 'setting' },
				{
					name: 'may use the device flow',
					place: 'setting',
					note: 'Some servers want this on for each client, and refuse without it'
				}
			]
		},
		{
			id: 'device-hand-over',
			from: 'idp-admin',
			to: 'app-team',
			kind: 'human',
			plain: 'Hand over the client ID',
			label: 'Hand over client ID',
			concept:
				'The admin passes the client ID back to the app team. It says which app this is, and proves nothing, so anyone with a copy of the app has it too.',
			fields: [{ name: 'client_id', place: 'setting' }]
		},
		{
			id: 'device-configure',
			from: 'app-team',
			to: 'app',
			kind: 'human',
			plain: 'Configure the app',
			label: 'Configure the app',
			concept: 'The team gives the app the issuer URL and the client ID.',
			inPractice:
				'This is most of what you write: these values in your configuration, and a library that takes them.',
			practice: [example('openidClient', true, 'takes the issuer and client ID')],
			fields: [
				{ name: 'issuer', place: 'setting' },
				{ name: 'client_id', place: 'setting' }
			]
		},
		{
			id: 'device-discover',
			from: 'app',
			to: 'idp',
			kind: 'request',
			plain: "The app looks up the provider's addresses",
			label: 'GET /.well-known/…',
			execute: { answer: 'device-discovery-document' },
			inPractice:
				'Many libraries do this when they start. Others want the addresses in your configuration.',
			practice: [example('openidClient', true, 'with discovery')],
			concept:
				'The app starts from the issuer URL and asks the identity provider where everything else is.',
			fields: [
				{ name: '/.well-known/openid-configuration', place: 'path', when: oidc },
				{ name: '/.well-known/oauth-authorization-server', place: 'path', when: is('oidc', false) }
			]
		},
		{
			id: 'device-discovery-document',
			cites: [
				{
					source: 'rfc8628',
					section: '4',
					why: 'Section 4 is how a server says it has this flow, and where it starts.'
				}
			],
			from: 'idp',
			to: 'app',
			kind: 'response',
			plain: 'Where everything is',
			label: 'Endpoints',
			concept:
				'Of what comes back, this app needs where to start and where to ask for tokens. A server that lists where to start says it offers this flow. One that does not may still have it, and then the address has to come from somewhere else.',
			fields: [
				{ name: 'issuer', place: 'body' },
				{
					name: 'device_authorization_endpoint',
					place: 'body',
					note: 'Where to ask for the two codes'
				},
				{ name: 'token_endpoint', place: 'body', note: 'Where to keep asking' },
				{ name: 'jwks_uri', place: 'body' }
			]
		},
		{
			id: 'device-configure-api',
			from: 'app-team',
			to: 'api',
			kind: 'human',
			plain: 'You tell the API who to trust',
			label: 'Configure the API',
			concept:
				'The API has to be told which issuer to trust, and what name tokens have to carry for it. Without the second, any token from that issuer gets in, including those meant for another API.',
			inPractice:
				'A library or a gateway takes these two values, and checks the rest. Do not leave out the audience, which it may let you do.',
			practice: [example('jose', true, 'when you pass it the issuer and audience')],
			links: [
				{
					diagram: 'flow',
					step: 'device-check-token',
					text: 'See where these get checked',
					when: is('deviceEnds', 'agrees')
				}
			],
			fields: [
				{ name: 'issuer', place: 'setting' },
				{ name: 'audience', place: 'setting', note: 'The name a token has to carry for this API' }
			]
		},
		{
			id: 'device-fetch-keys',
			from: 'api',
			to: 'idp',
			kind: 'request',
			plain: 'The API gets the keys',
			label: 'GET jwks_uri',
			concept:
				'The API looks up the keys that check signatures, at the address discovery gives. After that it does not need to call the identity provider for each token, only when the keys change.',
			fields: [{ name: '/certs', place: 'path', note: 'The jwks_uri from the discovery document' }]
		},
		{
			id: 'device-keys',
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
					step: 'device-request',
					text: 'Setup is done. See what happens when someone starts the app'
				}
			],
			fields: [{ name: 'keys', place: 'body' }]
		}
	]
};
