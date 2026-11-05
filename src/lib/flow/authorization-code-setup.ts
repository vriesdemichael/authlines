import { withTheOldWayInTheSetup } from '#lib/flow/old-way.ts';
import type { DiagramDef } from '#lib/flow/model.ts';
import { example } from '#lib/flow/libraries.ts';
import { apiWords, appWords, idpWords, secondApiWords, upstreamWords } from '#lib/flow/parties.ts';
import { all, any, is, not } from '#lib/flow/settings.ts';

const oidc = is('oidc', true);
// Someone stole the code from an app with no secret, so the real app never gets as far as the API.
const reachesTheApi = not(
	any(
		all(is('attacker', true), is('clientType', 'public')),
		is('attackerUses', 'real-app'),
		is('attackerGets', 'link'),
		is('address', 'other')
	)
);
const anyAddress = is('registered', 'any');
const confidential = is('clientType', 'confidential');
const broker = is('broker', true);
const links = is('linkAccount', true);
const storedTokens = any(is('upstreamTokens', 'v1'), is('upstreamTokens', 'v2'));
const apiV1 = is('upstreamTokens', 'v1');
const apiV2 = is('upstreamTokens', 'v2');
// Named, not "not the app", so a recording made before this setting existed is the app reading.
const apiReads = all(apiV2, any(is('upstreamReader', 'api'), is('upstreamReader', 'refused')));
const apiReadRefused = all(apiReads, is('upstreamReader', 'refused'));
const byHand = is('registration', 'manual');
const itself = is('registration', 'dcr');
const document = is('registration', 'cimd');
const inADirectory = is('federation', true);
const companies = is('companies', true);
const saml = all(companies, is('customerSpeaks', 'saml'));
const exchange = is('exchange', true);
const tradeRefresh = all(exchange, is('exchangeGives', 'refresh'));
// A program on the user's own computer, registered with an address on 127.0.0.1 (#178).
const inAProgram = is('appRuns', 'program');

/**
 * What happens before any user arrives. It has a diagram of its own, because no user does this: the
 * people on it do. Each person sits next to the system they look after.
 */
export const authorizationCodeSetup: DiagramDef = withTheOldWayInTheSetup({
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
			when: not(inAProgram),
			concept:
				'The application being set up. It has to learn about the identity provider before anyone logs in.'
		},
		{
			id: 'app',
			plainName: 'Program',
			plainRole: 'The one being set up',
			...appWords,
			icon: 'app',
			when: inAProgram,
			concept:
				'A program for users’ own computers, being set up. Every copy of it learns about the identity provider, and each is the same client.'
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
			plainRole: 'The other account',
			...upstreamWords,
			icon: 'upstream',
			concept:
				'Another identity provider, where users have accounts that the app wants to reach. The identity provider is its client.',
			when: links
		},
		{
			id: 'upstream',
			plainName: 'Other provider',
			plainRole: 'Will do the login',
			...upstreamWords,
			icon: 'upstream',
			concept: 'Another identity provider, which the identity provider will trust to log users in.',
			when: all(broker, not(companies))
		},
		{
			id: 'customer-admins',
			plainName: 'Their admins',
			plainRole: 'At the customer',
			name: 'Customer admins',
			role: 'People',
			icon: 'people',
			concept:
				"The people who run the customer's own provider. Each customer has its own, and what they do is not something anyone on our side can do for them, so this part is a conversation with each new customer.",
			when: companies
		},
		{
			id: 'upstream',
			plainName: 'Their company',
			plainRole: 'Its own provider',
			...upstreamWords,
			icon: 'upstream',
			concept:
				"The customer's own provider, which their admins run, and which will log their people in.",
			when: companies
		},
		{
			id: 'api',
			plainName: 'API',
			plainRole: 'Will check tokens',
			...apiWords,
			icon: 'api',
			concept:
				'The API the app will call. It has a setup of its own, because it has to know which tokens to accept.'
		},
		{
			id: 'second-api',
			plainName: 'Second API',
			plainRole: 'Checks tokens too',
			...secondApiWords,
			icon: 'api',
			when: exchange,
			concept:
				'The API the first one will call for the user. It is set up like the first: which issuer to trust, and its own name, which a token has to carry to get in.'
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
			when: byHand,
			from: 'app-team',
			to: 'idp-admin',
			kind: 'human',
			plain: 'Ask to register the app',
			label: 'Ask to register the app',
			concept:
				'The app team, which is probably you, tells an admin where users may be sent back to, the redirect URIs, and whether the app can keep a secret, the client type. People do this, so there is no HTTP message.',
			inPractice: [
				{
					when: anyAddress,
					text: 'With *, nothing more has to be listed, which is the trouble: on the server recorded, any address passes, theirs too.'
				},
				{
					when: inAProgram,
					text: 'You do this once. List the address of the user’s own computer with its path and no port, because the program picks a port each time it runs, and on the server recorded any port got through while another path did not.'
				},
				{
					text: 'You do this once, and again for each new address the app runs at, because each one has to be listed.'
				}
			],
			links: [{ diagram: 'flow', step: 'authorize', text: 'See where this address gets checked' }],
			fields: [
				{
					name: 'redirect_uris',
					place: 'setting',
					note: 'Checked again during every login',
					when: all(not(anyAddress), not(inAProgram))
				},
				{
					name: 'redirect_uris',
					place: 'setting',
					note: 'http://127.0.0.1/callback, with no port, because the program picks one',
					when: inAProgram
				},
				{
					name: 'redirect_uris=*',
					place: 'setting',
					note: 'On the server recorded, any address at all, so a wrong one stops failing',
					when: anyAddress
				},
				{ name: 'client type', place: 'setting' }
			]
		},
		{
			id: 'create-client',
			when: byHand,
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
			when: byHand,
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
			id: 'dcr-make-token',
			when: itself,
			from: 'idp-admin',
			to: 'idp',
			kind: 'human',
			plain: 'Create a token for registering',
			label: 'Create an initial access token',
			concept:
				'An admin creates a token that lets an app register itself, and sets how long it lasts and how many uses it has. This one had one. The server recorded refused an app that came without any.',
			cites: [
				{
					source: 'rfc7591',
					section: '3',
					why: 'Section 3 says a server should allow registration with no initial access token, may limit it with one, and leaves how one is issued out of scope.'
				}
			],
			pitfall: {
				title: 'Could an app register with no token at all?',
				text: 'The spec says a server should allow it, and may limit it. The one recorded said no: "Policy \'Trusted Hosts\' rejected request to client-registration service." It takes an admin allowing the address it comes from, and then anyone there can register an app.'
			},
			fields: [
				{
					name: 'initial access token',
					place: 'setting',
					note: 'Good for one registration here, and then refused'
				}
			]
		},
		{
			id: 'dcr-hand-token',
			when: itself,
			from: 'idp-admin',
			to: 'app-team',
			kind: 'human',
			plain: 'Hand over the token',
			label: 'Hand over the token',
			concept:
				'This is the one hand-off left. Everything else an admin used to enter, the app now sends for itself.',
			fields: [{ name: 'initial access token', place: 'setting' }]
		},
		{
			id: 'cimd-allow',
			when: document,
			from: 'idp-admin',
			to: 'idp',
			kind: 'human',
			plain: 'Allow apps to point at a document',
			label: 'Allow client documents',
			concept:
				'The server recorded needs an admin to allow this once, naming domains to trust and not apps. Until an app first asks, it has no client to set anything on.',
			pitfall: {
				title: 'What if the API refuses the token?',
				text: 'On the server recorded, a token for an app like this had no audience at all, and an API that checks said "not for this API". Here an admin put the audience in a scope every client gets.'
			},
			fields: [
				{ name: 'allowed domains', place: 'setting' },
				{ name: 'audience', place: 'setting', note: 'In a scope every client gets' }
			]
		},
		{
			id: 'cimd-host',
			when: document,
			from: 'app-team',
			to: 'app',
			kind: 'human',
			plain: 'Host a document about the app',
			label: 'Publish client metadata',
			concept:
				'The team puts a document at an address it controls: the name of the app, where users may be sent back to, and that same address as its client ID. Nobody has to register it first.',
			inPractice:
				'A real one has to be on HTTPS. The recording here turned on plain HTTP, because the demo app has no certificate.',
			cites: [
				{
					source: 'cimd-draft',
					why: 'The draft makes the client ID the address of a document about the app.'
				}
			],
			links: [{ diagram: 'flow', step: 'cimd-fetch', text: 'See when this gets fetched' }],
			fields: [
				{ name: 'client_id', place: 'setting', note: 'The address of this document' },
				{ name: 'redirect_uris', place: 'setting', note: 'Checked again during every login' }
			]
		},
		{
			id: 'connect-directory',
			when: inADirectory,
			from: 'idp-admin',
			to: 'idp',
			kind: 'human',
			plain: 'Connect the directory',
			label: 'Add an LDAP provider',
			concept:
				'An admin tells the identity provider where the directory is, where in it the users are, which field is the username, and an account to search it with. The app team does nothing different.',
			inPractice:
				'Nothing for your app: it sees the same provider and the same tokens. This is between whoever runs the provider and whoever runs the directory.',
			fields: [
				{ name: 'connection URL', place: 'setting', note: 'Use ldaps://, or turn on StartTLS' },
				{ name: 'users DN', place: 'setting', note: 'Where in the directory the users are' },
				{ name: 'bind DN', place: 'setting', note: 'The account it searches with' }
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
				'The identity provider is itself a client of the other provider, so it has to be registered there the same way. That is done once, for the identity provider, and not again for each app behind it.',
			inPractice:
				'Whoever runs the other provider has to do their half, so this is a conversation with them. If each customer has a provider of their own, it is one conversation for each.',
			when: any(all(broker, not(companies)), links),
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
			id: 'add-provider-for-linking',
			when: links,
			from: 'idp-admin',
			to: 'idp',
			kind: 'human',
			plain: 'Add the other provider, to link accounts with',
			label: 'Add the provider',
			concept:
				'An admin adds the other provider to the identity provider, with the client ID and secret it got there, and has it keep the tokens a link brings. Here it is hidden from the login page, which then shows no button for it: it is there to link accounts with, not to log in with.',
			fields: [
				{ name: 'client_id', place: 'setting', note: 'The one the other provider gave it' },
				{ name: 'client_secret', place: 'setting' },
				{ name: 'Store Tokens', place: 'setting', note: 'So the tokens a link brings are kept' },
				{
					name: 'Hide on login page',
					place: 'setting',
					note: 'So it is for linking, not logging in'
				}
			]
		},
		{
			id: 'send-our-details',
			from: 'idp-admin',
			to: 'customer-admins',
			kind: 'human',
			plain: "Send them our provider's details",
			label: [{ when: saml, text: 'Our SAML metadata' }, { text: 'Our details' }],
			concept: [
				{
					when: saml,
					text: "The admin sends the customer's admins what their provider has to know about ours: the entity ID it goes by, the address to post answers to, and the certificate it signs its requests with. Often it is one link, to our provider's SAML metadata."
				},
				{
					text: "The admin sends the customer's admins what their provider has to know about ours, as an app would: where to send people back to."
				}
			],
			when: companies,
			fields: [
				{ name: 'entity ID', place: 'setting', note: 'The name our provider goes by', when: saml },
				{ name: 'ACS URL', place: 'setting', note: 'Where to post the answer', when: saml },
				{
					name: 'certificate',
					place: 'setting',
					note: 'What our signed requests are checked with',
					when: saml
				},
				{
					name: 'redirect_uri',
					place: 'setting',
					note: "The identity provider's broker endpoint",
					when: not(saml)
				}
			]
		},
		{
			id: 'customer-registers-us',
			from: 'customer-admins',
			to: 'upstream',
			kind: 'human',
			plain: 'They register our provider',
			label: 'Register our provider',
			concept:
				'Their admins add our provider to theirs, as one more thing that may ask it to log their people in.',
			when: companies,
			fields: [
				{ name: 'client_id', place: 'setting', when: not(saml) },
				{ name: 'client_secret', place: 'setting', when: not(saml) }
			]
		},
		{
			id: 'send-their-details',
			from: 'customer-admins',
			to: 'idp-admin',
			kind: 'human',
			plain: "They send their provider's details",
			label: [{ when: saml, text: 'Their SAML metadata' }, { text: 'Their details' }],
			concept: [
				{
					when: saml,
					text: "Their admins send back their provider's SAML metadata: the entity ID it goes by, where to send the request, and the certificate it signs with. The certificate is what lets our provider trust an assertion that came through someone's browser."
				},
				{
					text: "Their admins send back their provider's issuer, and the client ID and secret they made for our provider."
				}
			],
			when: companies,
			fields: [
				{
					name: 'entity ID',
					place: 'setting',
					note: 'The name their provider goes by',
					when: saml
				},
				{ name: 'SSO URL', place: 'setting', note: 'Where to send the request', when: saml },
				{
					name: 'certificate',
					place: 'setting',
					note: 'What their signature is checked with',
					when: saml
				},
				{ name: 'issuer', place: 'setting', when: not(saml) },
				{ name: 'client_id', place: 'setting', when: not(saml) },
				{ name: 'client_secret', place: 'setting', when: not(saml) }
			]
		},
		{
			id: 'add-organization',
			from: 'idp-admin',
			to: 'idp',
			kind: 'human',
			plain: 'Add them as a customer, with their domain',
			label: 'Add the organization',
			concept:
				"The admin adds the company with its email domain, and says which provider that domain goes to. With Auto redirect on, someone who types an email at that domain is then sent to their company's provider.",
			inPractice:
				'This is where each new customer starts, and the app does not change. If the app keeps customers apart, the token can say which one someone is from.',
			when: companies,
			fields: [
				{
					name: 'domain',
					place: 'setting',
					note: 'The part after the @: acme.test is only that, and *.acme.test its subdomains too'
				},
				{ name: 'identity provider', place: 'setting', note: 'Where that domain goes' },
				{
					name: 'auto redirect',
					place: 'setting',
					note: 'Send them there straight away'
				}
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
					when: apiReadRefused,
					text: 'An admin turns on token storage for the other provider, and registers the API as a client of its own, with a secret. It allows that client to retrieve stored tokens, only not this provider’s. The app’s tokens get the API’s name, because the identity provider here only hands a stored token to a client the token was issued to or names in its audience.'
				},
				{
					when: apiReads,
					text: 'An admin turns on token storage for the other provider, and registers the API as a client of its own, with a secret, allowed to retrieve this provider’s tokens. The app’s tokens get the API’s name, because the identity provider here only hands a stored token to a client the token was issued to or names in its audience.'
				},
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
				{
					name: 'Allow retrieve external tokens',
					place: 'setting',
					when: all(apiV2, not(apiReads))
				},
				{
					name: 'Allow retrieve external tokens',
					place: 'setting',
					note: 'For the API’s own client',
					when: apiReads
				},
				{
					name: 'Allowed Identity Providers for External Tokens',
					place: 'setting',
					note: 'This provider',
					when: all(apiReads, not(apiReadRefused))
				},
				{
					name: 'Allowed Identity Providers for External Tokens',
					place: 'setting',
					note: 'Another provider, and not this one',
					when: apiReadRefused
				},
				{
					name: 'audience of the API',
					place: 'setting',
					note: 'In the app’s tokens, so the API can read with them',
					when: apiReads
				}
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
					when: itself,
					text: 'The team gives the app the issuer URL and that token, and the app gets the rest for itself.'
				},
				{
					when: document,
					text: 'The team gives the app the issuer URL, and the address of its document as its client ID.'
				},
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
				{ name: 'client_id', place: 'setting', when: not(itself) },
				{
					name: 'client_secret',
					place: 'setting',
					artifact: 'secret',
					when: all(confidential, byHand)
				},
				{ name: 'initial access token', place: 'setting', when: itself }
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
				{ name: 'userinfo_endpoint', place: 'body', when: oidc },
				{ name: 'registration_endpoint', place: 'body', when: itself },
				{
					name: 'client_id_metadata_document_supported',
					place: 'body',
					note: 'Says it will fetch a document',
					when: document
				}
			]
		},
		{
			id: 'dcr-request',
			when: itself,
			from: 'app',
			to: 'idp',
			kind: 'request',
			plain: 'The app asks to be registered',
			label: 'POST registration_endpoint',
			concept:
				'The app sends what someone would otherwise have told an admin: where users may be sent back to. Nobody has to copy anything.',
			cites: [
				{
					source: 'rfc7591',
					section: '3.1',
					why: 'Section 3.1 is this request, and says the server can ask for an initial access token with it.'
				}
			],
			links: [{ diagram: 'flow', step: 'authorize', text: 'See where this address gets checked' }],
			fields: [
				{
					name: 'Authorization: Bearer',
					place: 'header',
					note: 'The token the admin handed over'
				},
				{ name: 'redirect_uris', place: 'body', note: 'Checked again during every login' },
				{ name: 'client_name', place: 'body' }
			]
		},
		{
			id: 'dcr-response',
			when: itself,
			from: 'idp',
			to: 'app',
			kind: 'response',
			plain: 'Its client ID and secret',
			label: '201 with client_id and client_secret',
			concept:
				'The app now has what an admin would have handed over, and the identity provider knows it. What comes back also says how it may log in, and gives it a token for changing or deleting this registration later.',
			inPractice: 'Keep what comes back as you would a password. Losing it takes an admin to fix.',
			cites: [
				{
					source: 'rfc7591',
					section: '3.2.1',
					why: 'Section 3.2.1 is this answer: the client ID, a secret if it gets one, and what was registered.'
				}
			],
			fields: [
				{ name: 'client_id', place: 'body' },
				{ name: 'client_secret', place: 'body', artifact: 'secret' },
				{ name: 'client_name', place: 'body' },
				{ name: 'redirect_uris', place: 'body' },
				{ name: 'token_endpoint_auth_method', place: 'body' },
				{ name: 'grant_types', place: 'body' },
				{ name: 'response_types', place: 'body' },
				{ name: 'scope', place: 'body', note: 'What it may ask for' },
				{ name: 'client_id_issued_at', place: 'body' },
				{ name: 'client_secret_expires_at', place: 'body', note: 'Zero says it does not run out' },
				{
					name: 'registration_access_token',
					place: 'body',
					note: 'For changing or deleting this registration'
				},
				{ name: 'registration_client_uri', place: 'body' }
			]
		},
		{
			id: 'configure-api',
			from: 'app-team',
			to: 'api',
			kind: 'human',
			plain: 'You tell the API who to trust',
			label: 'Configure the API',
			concept: [
				{
					when: exchange,
					text: 'The API has to be told which issuer to trust, and what name tokens have to carry for it. Without the second, any token from that issuer gets in, including those meant for another API. This one also trades tokens, which takes a client ID and secret of its own, from the admin.'
				},
				{
					text: 'The API has to be told which issuer to trust, and what name tokens have to carry for it. Without the second, any token from that issuer gets in, including those meant for another API.'
				}
			],
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
			id: 'allow-exchange',
			when: exchange,
			from: 'idp-admin',
			to: 'idp',
			kind: 'human',
			plain: 'Let the API trade tokens',
			label: 'Allow token exchange',
			concept: [
				{
					when: tradeRefresh,
					text: 'An admin registers the API as a client of its own, with a secret for the team to give it, and lets it trade tokens and get a refresh token from a trade, which the identity provider here does not allow on a new client. The identity provider is told this API may get tokens for the second. The app’s tokens get the first API’s name, because the identity provider here only trades a token that names the API asking.'
				},
				{
					text: 'An admin registers the API as a client of its own, with a secret for the team to give it, and lets it trade tokens. The identity provider is told this API may get tokens for the second. The app’s tokens get the first API’s name, because the identity provider here only trades a token that names the API asking.'
				}
			],
			fields: [
				{
					name: 'client_id',
					place: 'setting',
					note: 'The API’s own, because it is a client when it trades'
				},
				{ name: 'client_secret', place: 'setting', note: 'The API’s own' },
				{ name: 'token exchange', place: 'setting', note: 'Allowed for this API' },
				{
					name: 'refresh token from a trade',
					place: 'setting',
					note: 'Allowed for this API, and here tied to the user’s session',
					when: tradeRefresh
				},
				{
					name: 'audience of the second API',
					place: 'setting',
					note: 'So the API may get tokens for it'
				},
				{
					name: 'audience of the API',
					place: 'setting',
					note: 'In the app’s tokens, so the API can trade them'
				}
			]
		},
		{
			id: 'configure-second-api',
			when: exchange,
			from: 'app-team',
			to: 'second-api',
			kind: 'human',
			plain: 'You tell the second API who to trust',
			label: 'Configure the second API',
			concept:
				'The same two values as the first API, with its own name as the audience. It is not told about the first API: a token that names it is all it needs.',
			links: [{ diagram: 'flow', step: 'second-api-request', text: 'See the token it gets' }],
			fields: [
				{ name: 'issuer', place: 'setting' },
				{
					name: 'audience',
					place: 'setting',
					note: 'Its own name, which the exchanged token carries'
				}
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
					text: 'Setup is done. See what happens when a user arrives',
					when: all(not(is('attackerGets', 'link')), not(inAProgram))
				},
				{
					diagram: 'flow',
					step: 'program-starts',
					text: 'Setup is done. See what happens when a user runs the program',
					when: inAProgram
				},
				{
					diagram: 'flow',
					step: 'attacker-makes-link',
					text: 'Setup is done. See what someone else does with it',
					when: is('attackerGets', 'link')
				}
			],
			fields: [{ name: 'keys', place: 'body' }]
		}
	]
});
