import type { DiagramDef } from '#lib/flow/model.ts';
import { example } from '#lib/flow/libraries.ts';
import { apiWords, appWords, idpWords } from '#lib/flow/parties.ts';
import { is } from '#lib/flow/settings.ts';

/** What happens before the app makes its first call, which is the same as for any app, with less. */
export const clientCredentialsSetup: DiagramDef = {
	id: 'client-credentials-setup',
	title: 'Setting up the client credentials flow',
	caption: 'What people do first.',
	summary:
		'What people do before the first call, so the app and the identity provider know each other.',
	intro:
		'With no user there is less to set up. There is no address to send anyone back to, because nobody gets sent anywhere. The identity provider still has to learn about the app, and the app about the identity provider.',
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
				'The people who build and run the app, which is probably you. They know what it needs to do, so they are the ones who ask.'
		},
		{
			id: 'app',
			plainName: 'App',
			plainRole: 'The one being set up',
			...appWords,
			icon: 'app',
			concept:
				'The application being set up. It has to learn about the identity provider before it can ask for a token.'
		},
		{
			id: 'idp',
			plainName: 'Identity provider',
			plainRole: 'Will hand out tokens',
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
			from: 'service-register'
		},
		{
			label: 'Set up the app',
			why: 'The app has to know which provider to trust, and where to find it.',
			from: 'service-configure'
		},
		{
			label: 'Set up the API',
			why: 'The API has to know who to trust, and how to check a token.',
			from: 'service-configure-api'
		}
	],
	steps: [
		{
			id: 'service-register',
			from: 'app-team',
			to: 'idp-admin',
			kind: 'human',
			plain: 'Ask to register the app',
			label: 'Ask to register the app',
			concept:
				'The app team, which is probably you, asks an admin to register the app, and that it may act for itself. There is no address to list, because nobody gets sent back anywhere. People do this, so there is no HTTP message.',
			inPractice:
				'You do this once. An app acting for itself gets nobody’s permission but its own, so ask for only what it needs.',
			fields: [{ name: 'client type', place: 'setting', note: 'Has to be able to keep a secret' }]
		},
		{
			id: 'service-create-client',
			from: 'idp-admin',
			to: 'idp',
			kind: 'human',
			plain: 'Create the client',
			label: 'Create the client',
			concept:
				'The admin enters those values in the admin console, and allows this app to ask for tokens for itself. From here on, the identity provider knows it.',
			fields: [
				{ name: 'client_id', place: 'setting' },
				{ name: 'client_secret', place: 'setting', artifact: 'secret' },
				{
					name: 'may act for itself',
					place: 'setting',
					note: 'Without this it can ask, and it is refused'
				}
			]
		},
		{
			id: 'service-hand-over',
			from: 'idp-admin',
			to: 'app-team',
			kind: 'human',
			plain: 'Hand over the client ID and secret',
			label: 'Hand over client ID and secret',
			concept:
				'The admin passes the client ID and secret back to the app team. With no user, that secret is what says this is the app.',
			inPractice: 'Keep the secret out of your code and your repository, as you would a password.',
			fields: [
				{ name: 'client_id', place: 'setting' },
				{ name: 'client_secret', place: 'setting', artifact: 'secret' }
			]
		},
		// The last of #183: what this app may do at the admin API, and no more.
		{
			id: 'service-allow-one-role',
			when: is('givesRole', true),
			from: 'idp-admin',
			to: 'idp',
			kind: 'human',
			plain: 'Let it give one role, and nothing else',
			label: 'One role it may give',
			concept:
				'An admin turns on permissions for the admin API, and lets this app’s service account look users up and give them reads-orders. Nothing else is allowed, so it cannot give other roles. It may not look roles up either, so the admin hands it reads-orders as the admin API wants it, with its name and ID. The admin API recorded takes only a token meant for it, so the admin also gives the app’s client a scope, kc-admin-api, that puts the admin API in its tokens’ audience. Before Keycloak 26.8.2 it did not check who a token was for.',
			fields: [
				{ name: 'Users: view, map-roles', place: 'setting', note: 'For any user' },
				{ name: 'Roles: map-role', place: 'setting', note: 'For reads-orders only' },
				{
					name: 'reads-orders, with its ID',
					place: 'setting',
					note: 'For the app’s configuration'
				},
				{ name: 'kc-admin-api', place: 'setting', note: 'A scope that names the admin API' }
			]
		},
		{
			id: 'service-configure',
			from: 'app-team',
			to: 'app',
			kind: 'human',
			plain: 'Configure the app',
			label: 'Configure the app',
			concept: 'The team gives the app the issuer URL, the client ID and the secret.',
			inPractice:
				'This is most of what you write: these values in your configuration, and a library that takes them.',
			practice: [example('openidClient', true, 'takes the issuer, client ID and secret')],
			fields: [
				{ name: 'issuer', place: 'setting' },
				{ name: 'client_id', place: 'setting' },
				{ name: 'client_secret', place: 'setting', artifact: 'secret' }
			]
		},
		{
			id: 'service-discover',
			from: 'app',
			to: 'idp',
			kind: 'request',
			plain: "The app looks up the provider's addresses",
			label: 'GET /.well-known/…',
			execute: { answer: 'service-discovery-document' },
			inPractice:
				'Many libraries do this when they start. Others want the addresses in your configuration.',
			practice: [example('openidClient', true, 'with discovery')],
			concept:
				'The app starts from the issuer URL and asks the identity provider where everything else is.',
			fields: [{ name: '/.well-known/oauth-authorization-server', place: 'path' }]
		},
		{
			id: 'service-discovery-document',
			from: 'idp',
			to: 'app',
			kind: 'response',
			plain: 'Where everything is',
			label: 'Endpoints',
			concept: 'Of what comes back, this app only needs where to ask for tokens.',
			fields: [
				{ name: 'issuer', place: 'body' },
				{ name: 'token_endpoint', place: 'body' },
				{ name: 'jwks_uri', place: 'body' }
			]
		},
		{
			id: 'service-configure-api',
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
				{ diagram: 'flow', step: 'service-check-token', text: 'See where these get checked' }
			],
			fields: [
				{ name: 'issuer', place: 'setting' },
				{ name: 'audience', place: 'setting', note: 'The name a token has to carry for this API' }
			]
		},
		{
			id: 'service-fetch-keys',
			from: 'api',
			to: 'idp',
			kind: 'request',
			plain: 'The API gets the keys',
			label: 'GET jwks_uri',
			concept:
				'The API looks up the keys that check signatures, at the address discovery gives. After that it does not need to call the identity provider for each token. A library usually fetches the keys again from time to time, and when a token names one it does not have.',
			fields: [{ name: '/certs', place: 'path', note: 'The jwks_uri from the discovery document' }]
		},
		{
			id: 'service-keys',
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
					step: 'service-token-request',
					text: 'Setup is done. See what happens when the app makes its first call'
				}
			],
			fields: [{ name: 'keys', place: 'body' }]
		}
	]
};
