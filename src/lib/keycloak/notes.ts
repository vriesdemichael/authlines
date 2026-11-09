import { resolveText, type Text } from '#lib/flow/model.ts';
import {
	all,
	any,
	holds,
	is,
	not,
	type Condition,
	type KeycloakFlag,
	type Settings
} from '#lib/flow/settings.ts';

/**
 * Which Keycloak setting controls what a step shows. This is the only place the protocol diagrams
 * get anything about one product, so someone on another identity provider can leave it out
 * (ADR-015). Each note is held to something a real server did, by src/lib/keycloak/notes.test.ts.
 */

const confidential = is('clientType', 'confidential');
const pkce = is('pkce', true);
const dpop = is('binding', 'dpop');
const apiV1 = is('upstreamTokens', 'v1');
const apiV2 = is('upstreamTokens', 'v2');
// A group at the other provider becomes a role here (#183).
const groupRoles = is('groupRoles', true);
// Named, not "not the app", so a recording made before this setting existed is the app reading.
const apiReads = all(apiV2, any(is('upstreamReader', 'api'), is('upstreamReader', 'refused')));

const FLAG_V2 = 'identity-brokering-api:v2';
/** The provider the recorder sets up, and not one of a customer's, which is set up apart. */
const plainBroker = all(is('broker', true), is('companies', false));

/** A page of the admin console, which the recorder knows how to open. */
export type ConsolePage =
	| 'client-settings'
	| 'client-advanced'
	| 'client-scopes'
	| 'client-dedicated-scope'
	| 'api-client-settings'
	| 'api-client-advanced'
	| 'api-client-scopes'
	| 'provider-settings'
	| 'provider-mappers'
	| 'realm-settings'
	| 'realm-sessions'
	| 'realm-tokens'
	| 'browser-flow'
	| 'directory-settings'
	| 'organization-domains';

export interface ConsolePlace {
	/** What someone clicks through, in the words of the console. */
	path: readonly string[];
	page: ConsolePage;
	/** Something on the page to press first, for what only shows after that. */
	opens?: string;
	/** Words the recorder looks for on that page of a real server. */
	shows: readonly string[];
	/** A flag the server has to run with before the console shows this at all. */
	needsFlag?: string;
}

export interface NoteDef {
	id: string;
	steps: readonly string[];
	title: string;
	text: Text;
	when?: Condition;
	/** With these settings it is on these steps instead, for what a pushed request checks earlier. */
	instead?: { when: Condition; steps: readonly string[] };
	place?: ConsolePlace;
	/** A setting that is not in the console, because the server starts with it. */
	serverOption?: string;
	flag?: KeycloakFlag;
	/** The answer in questions.json that proves this, and what it has to show. */
	backedBy: { question: string; shows: Readonly<Record<string, unknown>> };
	/** What was done to find this out, when it was more than changing one setting. */
	seen?: string;
	/** What in an access token this setting controls. */
	claims?: readonly string[];
	/** How to say that, when it does not simply come from this setting. */
	claimsVerb?: string;
}

export interface Note {
	id: string;
	title: string;
	text: string;
	path?: readonly string[];
	serverOption?: string;
	flag?: KeycloakFlag;
	/** How this was found out, up to the name of the server. */
	evidence: string;
	claims: readonly string[];
	claimsVerb?: string;
}

const CHANGED_IT = 'Changed this, and the answer changed, on';
const YOUR_CLIENT = 'your client';
const clientSettings = (section: string, label: string, needsFlag?: string): ConsolePlace => ({
	path: ['Clients', YOUR_CLIENT, 'Settings', section, label],
	page: 'client-settings',
	shows: [section, label],
	needsFlag
});
const providerSettings = (label: string): ConsolePlace => ({
	path: ['Identity providers', 'the provider', 'Settings', 'Advanced settings', label],
	page: 'provider-settings',
	shows: ['Advanced settings', label]
});

const requirePkcePlace = clientSettings('Capability config', 'Require PKCE');
/** In the part of Advanced settings that opens with Advanced, which is closed when the page loads. */
const providerAdvanced = (label: string): ConsolePlace => ({
	path: ['Identity providers', 'the provider', 'Settings', 'Advanced settings', 'Advanced', label],
	page: 'provider-settings',
	opens: 'Advanced',
	shows: ['Advanced settings', label]
});

export const noteDefs: readonly NoteDef[] = [
	{
		id: 'valid-redirect-uris',
		steps: ['authorize', 'address-refused', 'create-client'],
		// Pushed first, the address is checked at the push, which has a note of its own.
		instead: { when: is('par', true), steps: ['create-client'] },
		title: 'Valid redirect URIs',
		text: 'The addresses this client may send users back to. Anything else gets a 400, and the page says: Invalid parameter: redirect_uri. It does take a * at the end of an address, which then lets any page on that site get the code, and * alone takes any site at all. An exact match closes both.',
		// A program's loopback address is let through at any port, which the note of its own says.
		when: not(is('appRuns', 'program')),
		place: clientSettings('Access settings', 'Valid redirect URIs'),
		backedBy: {
			question: 'validRedirectUris',
			shows: {
				before: { status: 400 },
				after: { status: 200 },
				wildcard: { atTheEnd: { sameSite: 200, otherSite: 400 }, alone: { otherSite: 200 } }
			}
		}
	},
	{
		id: 'loopback-redirects',
		steps: ['authorize', 'create-client'],
		title: 'Valid redirect URIs, for a program',
		text: 'Register http://127.0.0.1/callback and leave the port out. Logins at two ports the computer picked went through, and a third port got the login page. Another path got 400 with Invalid parameter: redirect_uri, and so did localhost in its place. Registered as localhost or [::1], an unregistered port got the login page. Registered as http://127.0.0.1:*, another path got it too, so a * after the port lets the path through unchecked.',
		when: is('appRuns', 'program'),
		place: clientSettings('Access settings', 'Valid redirect URIs'),
		backedBy: {
			question: 'loopbackRedirects',
			shows: {
				before: {
					registered: 'http://127.0.0.1/callback',
					anyPort: { status: 200 },
					anotherPath: { status: 400, refused: true },
					localhostInstead: { status: 400, refused: true }
				},
				after: {
					registered: 'http://127.0.0.1:*',
					anyPort: { status: 200 },
					anotherPath: { status: 200 }
				},
				localhost: { anyPort: { status: 200 } },
				ipv6: { anyPort: { status: 200 } }
			}
		}
	},
	{
		id: 'consent-required',
		steps: ['consent-page', 'submit-credentials'],
		title: 'Consent required',
		text: [
			{
				when: is('consent', true),
				text: "On for this client. What the page lists are the client's scopes, by their display names. Once someone agrees they are not asked again, on a client with a secret or without one, until the app asks for a scope they have not agreed to, and then only about that scope."
			},
			{
				text: 'Off on a new client, which is why most logins through Keycloak never ask the user anything. Turn it on to get the question.'
			}
		],
		place: clientSettings('Login settings', 'Consent required'),
		backedBy: {
			question: 'consentRequired',
			shows: {
				before: { asked: false, audience: 'account', hasRoles: true },
				after: {
					asked: true,
					secondLoginAsked: false,
					whenDeclined: 'access_denied',
					audience: 'account',
					hasRoles: true
				},
				onAPublicClient: {
					first: { asked: true },
					second: { asked: false },
					withANewScope: { asked: true, lists: ['Phone number'] },
					withThatScopeAgain: { asked: false }
				}
			}
		}
	},
	{
		id: 'client-authentication',
		steps: ['token-request', 'create-client'],
		title: 'Client authentication',
		text: [
			{
				when: confidential,
				text: 'On, which makes this a confidential client. Turn it off and this request needs no secret. That is for an app that cannot keep one, and not a way past a wrong secret, because anyone can then ask as this client.'
			},
			{
				text: 'Off, which makes this a public client. Turn it on and this request gets a 401 without a secret, with the error unauthorized_client, where RFC 6749 says invalid_client.'
			}
		],
		place: clientSettings('Capability config', 'Client authentication'),
		backedBy: {
			question: 'clientAuthentication',
			shows: { before: { status: 401 }, after: { status: 200 } }
		}
	},
	{
		id: 'implicit-flow',
		steps: ['redirect-with-code'],
		title: 'Implicit flow',
		text: 'Off on a new client, though the server lists it as something it supports. Asking for it then gets an error, and turning this on lets the token go through the browser. Current advice is to leave it off.',
		place: clientSettings('Capability config', 'Implicit flow'),
		backedBy: {
			question: 'implicitFlow',
			shows: { serverLists: true, before: { allowed: false }, after: { allowed: true } }
		}
	},
	{
		id: 'web-origins',
		steps: ['token-request'],
		title: 'Web origins',
		text: "An app that runs in the page makes this request from the page, so the browser blocks it unless the app's origin is listed here. It shows up as a CORS error, and the code still works afterwards, so the login can be tried again once the origin is listed. What ran in this recording is a server standing in for one of those, which needs nothing here.",
		when: not(confidential),
		place: clientSettings('Access settings', 'Web origins'),
		backedBy: {
			question: 'webOrigins',
			shows: {
				before: { blocked: true, theSameCodeAfterwards: 200 },
				after: { blocked: false, status: 200 }
			}
		}
	},
	{
		id: 'require-pkce',
		steps: ['authorize'],
		title: 'Require PKCE',
		text: [
			{
				when: pkce,
				text: 'Not what makes this work: any client that sends a challenge gets PKCE. Turn it on to refuse a login that has none.'
			},
			{
				text: 'Off by default, so a login with no challenge goes through. Turn it on, and the app gets an error back at its redirect URI instead of a code.'
			}
		],
		place: requirePkcePlace,
		backedBy: {
			question: 'requirePkce',
			shows: { before: { gotCode: true }, after: { gotCode: false } }
		}
	},
	{
		id: 'intercepted-code',
		steps: ['token-request', 'attacker-token-response'],
		title: 'Require PKCE',
		// What was asked is about a copied code. A link of theirs comes with their own verifier.
		when: not(is('attackerGets', 'link')),
		text: [
			{
				when: all(pkce, not(confidential)),
				text: 'Someone with only the code gets a 400 invalid_grant: PKCE code verifier not specified. That try also uses up the code, so the real app has to start the login again. That is how Keycloak does it, and the specs do not say whether a failed try counts.'
			},
			{
				when: pkce,
				text: 'Without the secret, this gets a 401 before PKCE comes into it, with the error unauthorized_client, where RFC 6749 says invalid_client. The code itself is still good, so the real app carries on.'
			},
			{
				when: confidential,
				text: 'Without the secret, this gets a 401, with the error unauthorized_client, where RFC 6749 says invalid_client. The code itself is still good, and PKCE is not insisted on unless this is turned on.'
			},
			{
				when: dpop,
				text: "Off by default. This login named the app's key with dpop_jkt, so someone with only the code gets a 400: DPoP Proof missing, or with their own key, that its thumbprint does not match. A login that does not name a key has no such protection: they get tokens with a key of their own, even with Require DPoP bound tokens on."
			},
			{
				text: 'Off by default, so a public client with no PKCE gets its tokens, and so does anyone else who has the code. The real app then finds the code already used. Turn it on to refuse a login without PKCE.'
			}
		],
		place: requirePkcePlace,
		backedBy: {
			question: 'interceptedCode',
			shows: {
				publicWithoutPkce: { status: 200, gotTokens: true },
				publicWithPkceNoVerifier: {
					status: 400,
					description: 'PKCE code verifier not specified',
					theRealAppAfterwards: { status: 400, description: 'Code not valid' }
				},
				confidentialNoPkceNoSecret: { status: 401, theRealAppAfterwards: { status: 200 } },
				withDpop: {
					namedKeyNoProof: { status: 400, description: 'DPoP Proof missing' },
					namedKeyOtherProof: {
						status: 400,
						description: 'DPoP Proof public key thumbprint does not match dpop_jkt'
					},
					namedKeyRightProof: { status: 200, tokenType: 'DPoP' },
					noNamedKeyNoProof: { status: 200, tokenType: 'Bearer' },
					noNamedKeyTheirOwnProof: { status: 200, tokenType: 'DPoP' },
					requiredNoProof: { status: 400 },
					requiredTheirOwnProof: { status: 200, tokenType: 'DPoP' }
				}
			}
		},
		seen: 'Tried with each kind of client, with and without PKCE, on'
	},
	{
		id: 'code-used-twice',
		steps: ['real-app-refused'],
		title: 'A code used twice',
		text: 'Keycloak cancels what the code got when someone uses it again: after this, UserInfo says 401 to their access token and their refresh token is refused. The demo API looks at the token itself and never asks Keycloak, so it goes on answering until the token expires. An API that asks the server each time may not.',
		when: not(pkce),
		backedBy: {
			question: 'stolenTokensAfterTheRealAppTried',
			shows: {
				before: { userinfo: 200, demoApi: 200 },
				after: { userinfo: 401, demoApi: 200 },
				refresh: { status: 400 }
			}
		},
		seen: 'Tried on'
	},
	{
		id: 'client-scopes',
		steps: ['token-response'],
		claims: [
			'name',
			'email',
			'preferred_username',
			'given_name',
			'family_name',
			'email_verified',
			'scope'
		],
		title: 'Client scopes',
		text: "What the access token says about the user comes from the client's default client scopes, whether or not the app asked for openid. A new client has profile and email among them, so its token already holds a name and an email address. Take those two off and they are gone.",
		place: {
			path: ['Clients', YOUR_CLIENT, 'Client scopes'],
			page: 'client-scopes',
			shows: ['profile', 'email']
		},
		backedBy: {
			question: 'clientScopes',
			shows: {
				before: { hasName: true, hasEmail: true },
				after: { hasName: false, hasEmail: false }
			}
		}
	},
	{
		id: 'token-lifespan',
		steps: ['token-response', 'token-runs-out'],
		claims: ['exp'],
		title: 'Access Token Lifespan',
		text: 'Sets expires_in for this client. Left empty, it comes from the realm, which is five minutes on a new one.',
		place: {
			path: ['Clients', YOUR_CLIENT, 'Advanced', 'Advanced settings', 'Access Token Lifespan'],
			page: 'client-advanced',
			shows: ['Advanced settings', 'Access Token Lifespan']
		},
		backedBy: {
			question: 'tokenLifespan',
			shows: { before: { expiresIn: 300 }, after: { expiresIn: 60 } }
		}
	},
	{
		id: 'redirect-checked-at-push',
		steps: ['push-request'],
		when: is('par', true),
		title: 'Valid redirect URIs',
		text: 'Checked when the request is pushed. An address that is not one of these gets a 400 at the push, which says: Invalid parameter: redirect_uri, so the app has no reference to send the user with. That holds for an app with no secret too.',
		place: clientSettings('Access settings', 'Valid redirect URIs'),
		backedBy: {
			question: 'pushedRedirect',
			shows: {
				before: { status: 400, says: 'Invalid parameter: redirect_uri' },
				after: { status: 201, says: null },
				withNoSecret: { status: 400, says: 'Invalid parameter: redirect_uri' }
			}
		}
	},
	{
		id: 'require-par',
		steps: ['push-request', 'authorize'],
		when: is('par', true),
		title: 'Pushed authorization request required',
		text: 'Off on a new client, so it takes an ordinary login link as well as a pushed one, and someone else can still start a login for it with a link of their own. On, a link that was not pushed sends the browser back to the app with error=invalid_request and: Pushed Authorization Request is only allowed. For an app with no secret that stops less, because anyone can push a request for it.',
		place: {
			path: [
				'Clients',
				YOUR_CLIENT,
				'Advanced',
				'Advanced settings',
				'Pushed authorization request required'
			],
			page: 'client-advanced',
			shows: ['Advanced settings', 'Pushed authorization request required']
		},
		backedBy: {
			question: 'requirePar',
			shows: {
				before: { status: 200, loginPage: true, error: null },
				after: {
					status: 302,
					loginPage: false,
					backToTheApp: true,
					error: 'invalid_request',
					says: 'Pushed Authorization Request is only allowed.'
				}
			}
		}
	},
	{
		id: 'par-lifespan',
		steps: ['push-response'],
		when: is('par', true),
		title: 'Lifetime of the Request URI for Pushed Authorization Request',
		text: 'Sets expires_in on the answer to a push. It is set for the realm, and is 60 seconds on a new one.',
		place: {
			page: 'realm-tokens',
			path: [
				'Realm settings',
				'Tokens',
				'Lifetime of the Request URI for Pushed Authorization Request'
			],
			shows: ['Lifetime of the Request URI for Pushed Authorization Request']
		},
		backedBy: {
			question: 'parLifespan',
			shows: { before: { status: 201, expiresIn: 60 }, after: { status: 201, expiresIn: 30 } }
		}
	},
	{
		id: 'full-scope-allowed',
		steps: ['give-the-app-its-roles', 'token-response'],
		when: groupRoles,
		claims: ['realm_access', 'resource_access'],
		claimsVerb: 'can be narrowed with',
		title: 'Full scope allowed',
		text: 'On for a new client, so its tokens carry every role the user has. Turned off with no role given to the client, a token here lost the realm’s three default roles and the account service’s roles, and with them account from its audience. A role given to the client on the same tab comes back. The console says the switch is deprecated, and to keep it off and give only the roles an app needs.',
		place: {
			path: [
				'Clients',
				YOUR_CLIENT,
				'Client scopes',
				'your client-dedicated',
				'Scope',
				'Full scope allowed'
			],
			page: 'client-dedicated-scope',
			opens: 'Scope',
			shows: ['Full scope allowed']
		},
		backedBy: {
			question: 'fullScopeAllowed',
			shows: {
				before: { realmRoles: 3, serviceRoles: ['account'], aud: 'account' },
				after: { realmRoles: 0, serviceRoles: [], aud: null }
			}
		}
	},
	{
		id: 'claim-to-role',
		steps: ['match-user', 'map-group-to-role'],
		when: groupRoles,
		title: 'Claim to Role',
		text: 'A mapper on the provider, of the type Claim to Role, gives the user a role here when a claim the other provider sent has a value. Here groups containing sales gives reads-orders. Without it, the same first login through the other provider gave a token with no reads-orders.',
		place: {
			path: ['Identity providers', 'the provider', 'Mappers', 'Add mapper', 'Mapper type'],
			page: 'provider-mappers',
			opens: 'Add mapper',
			shows: ['Mapper type']
		},
		backedBy: {
			question: 'claimToRole',
			shows: { before: { hasRole: false }, after: { hasRole: true } }
		}
	},
	{
		id: 'audience',
		steps: ['token-response', 'api-check-token'],
		claims: ['aud'],
		claimsVerb: 'can be changed with',
		title: 'Audience mapper',
		text: [
			{
				when: is('exchange', true),
				text: "A default client's access token names account as its audience, not your API, so an API that checks the audience refuses it. Here account comes from the default roles client scope, and without that scope there is no audience at all. Add an Audience mapper to the client's dedicated scope to name your API. That is done here, so the token names the first API as well as account, and the first API expects its own name."
			},
			{
				text: "A default client's access token names account as its audience, not your API, so an API that checks the audience refuses it. Here account comes from the default roles client scope, and without that scope there is no audience at all. Add an Audience mapper to the client's dedicated scope to name your API. The demo API here is told to accept account, so that it can run against a default client, which means any default client's token in this realm gets in. Yours should expect its own name."
			}
		],
		place: {
			path: [
				'Clients',
				YOUR_CLIENT,
				'Client scopes',
				'your client-dedicated',
				'Configure a new mapper',
				'Audience'
			],
			page: 'client-dedicated-scope',
			opens: 'Configure a new mapper',
			shows: ['Audience']
		},
		backedBy: {
			question: 'audience',
			shows: {
				before: { aud: 'account', namesTheApi: false, demoApi: 200 },
				after: { namesTheApi: true },
				withoutTheRolesScope: { aud: null }
			}
		}
	},
	{
		id: 'standard-token-exchange',
		steps: ['exchange-request', 'allow-exchange'],
		when: is('exchange', true),
		flag: { name: 'token-exchange-standard:v2' },
		title: 'Standard Token Exchange',
		text: 'Off on a new client, and on here for the API’s client, the one that asks. Off, the trade gets a 400 with invalid_request and: Standard token exchange is not enabled for the requested client.',
		place: {
			path: [
				'Clients',
				'the first API',
				'Settings',
				'Capability config',
				'Standard Token Exchange'
			],
			page: 'api-client-settings',
			shows: ['Capability config', 'Standard Token Exchange']
		},
		backedBy: {
			question: 'exchangeEnabled',
			shows: {
				before: {
					status: 400,
					error: 'invalid_request',
					says: 'Standard token exchange is not enabled for the requested client'
				},
				after: { status: 200 }
			}
		}
	},
	{
		id: 'exchange-subject',
		steps: ['exchange-request'],
		when: is('exchange', true),
		title: 'Audience mapper',
		text: 'The token being traded has to name the API that trades it, so the app’s client here has an Audience mapper that names the first API. A token that names only account gets a 403 with access_denied and: Client is not within the token audience. RFC 8693 asks for invalid_request there.',
		place: {
			path: [
				'Clients',
				YOUR_CLIENT,
				'Client scopes',
				'your client-dedicated',
				'Configure a new mapper',
				'Audience'
			],
			page: 'client-dedicated-scope',
			opens: 'Configure a new mapper',
			shows: ['Audience']
		},
		backedBy: {
			question: 'exchangeNeedsItsName',
			shows: {
				before: {
					status: 403,
					error: 'access_denied',
					says: 'Client is not within the token audience',
					subjectAud: 'account'
				},
				after: { status: 200 }
			}
		}
	},
	{
		id: 'exchange-audience',
		steps: ['exchange-response', 'allow-exchange'],
		when: is('exchange', true),
		claims: ['aud'],
		claimsVerb: 'comes from',
		title: 'Client scopes',
		text: 'The first API’s client has a client scope with an Audience mapper that names the second API, as a default scope. Without it, asking for that audience gets a 400 and: Requested audience not available: demo-api-two. With it, the new token names the second API, and not the first.',
		place: {
			path: ['Clients', 'the first API', 'Client scopes', 'Add client scope'],
			page: 'api-client-scopes',
			shows: ['Add client scope']
		},
		backedBy: {
			question: 'exchangeAudience',
			shows: {
				before: { status: 400, says: 'Requested audience not available: demo-api-two' },
				after: { status: 200, aud: 'demo-api-two' }
			}
		}
	},
	{
		id: 'exchange-refresh',
		steps: ['exchange-request', 'trade-refresh-request', 'allow-exchange'],
		when: all(is('exchange', true), is('exchangeGives', 'refresh')),
		title: 'Allow refresh token in Standard Token Exchange',
		text: 'Not set on a new client, and set here for the API’s client to the value that ties the refresh token to the user’s session, the only one tried. Not set, a trade that asks for a refresh token gets a 400 with invalid_request and: requested_token_type unsupported. Set, once the user’s session has ended, a refresh gets a 400 with invalid_grant and: Session not active.',
		place: {
			path: [
				'Clients',
				'the first API',
				'Advanced',
				'OpenID Connect Compatibility Modes',
				'Allow refresh token in Standard Token Exchange'
			],
			page: 'api-client-advanced',
			shows: [
				'OpenID Connect Compatibility Modes',
				'Allow refresh token in Standard Token Exchange'
			]
		},
		backedBy: {
			question: 'exchangeRefresh',
			shows: {
				before: {
					status: 400,
					error: 'invalid_request',
					says: 'requested_token_type unsupported'
				},
				after: { status: 200, gotRefreshToken: true, sameSession: true },
				sessionEnded: { status: 400, error: 'invalid_grant', says: 'Session not active' }
			}
		}
	},
	{
		id: 'post-logout-address',
		steps: ['logout-redirect'],
		title: 'Valid post logout redirect URIs',
		text: 'Where the browser may come back to after logging out. An address not listed here gets a page saying Invalid redirect uri, and stays there.',
		when: is('logout', true),
		place: clientSettings('Access settings', 'Valid post logout redirect URIs'),
		backedBy: {
			question: 'postLogoutAddress',
			shows: {
				before: { status: 400, saysInvalidRedirect: true },
				after: { backAtTheApp: true }
			}
		}
	},
	{
		id: 'backchannel-logout-url',
		steps: ['backchannel-logout'],
		title: 'Backchannel logout URL',
		text: 'Where Keycloak tells this client that a session has ended. With it empty nothing is delivered, and the app keeps them logged in until it next asks.',
		when: is('logout', true),
		place: clientSettings('Logout settings', 'Backchannel logout URL'),
		backedBy: {
			question: 'backchannelLogoutUrl',
			shows: { before: { delivered: 0 }, after: { delivered: 1, hasTheEvent: true } }
		}
	},
	{
		id: 'who-may-ask',
		steps: ['introspect', 'introspect-response'],
		title: 'Who may ask about a token',
		text: 'Introspection says active: false to a client that the token does not name in aud, even for a good token, which is easy to take for a broken one. Here an audience mapper names the API, so it got active: true before the logout, and active: false after.',
		when: is('logout', true),
		place: {
			path: [
				'Clients',
				YOUR_CLIENT,
				'Client scopes',
				'your client-dedicated',
				'Configure a new mapper',
				'Audience'
			],
			page: 'client-dedicated-scope',
			opens: 'Configure a new mapper',
			shows: ['Audience']
		},
		backedBy: {
			question: 'whoMayAsk',
			shows: {
				before: { active: false },
				after: { active: true },
				afterALogout: { active: false }
			}
		}
	},
	{
		id: 'after-a-logout',
		steps: [
			'token-after-logout-response',
			'asks-after-logout-response',
			'refresh-after-logout-response'
		],
		title: 'What a real server did after a logout',
		text: "The access token still had most of its life, and an API that only looks at the token took it. UserInfo said 401, and a refresh said Session not active, for the other app too, and the other app's next login showed the form.",
		when: is('logout', true),
		backedBy: {
			question: 'loggingOut',
			shows: {
				onlyTheAppForgets: { nextLoginSawForm: false },
				withAnIdToken: { backAtTheApp: true, state: 'kept' },
				withNoIdToken: { asks: true },
				after: {
					tokenNotExpired: true,
					demoApi: 200,
					userinfo: 401,
					otherAppUserinfo: 401,
					refresh: { status: 400, error: 'invalid_grant', description: 'Session not active' },
					otherAppRefresh: {
						status: 400,
						error: 'invalid_grant',
						description: 'Session not active'
					},
					otherAppNextLoginSawForm: true
				}
			}
		},
		seen: 'Tried each of these with two clients, on'
	},
	{
		id: 'sso-session-max',
		steps: ['idp-recognises'],
		title: 'SSO Session Max',
		text: 'How long a session lasts: thirty minutes idle and ten hours at most, by default, set by SSO Session Idle and SSO Session Max. Past that the cookie no longer counts, and the form comes back. Set Max to three seconds and wait, and the second app sees the form.',
		when: is('sso', true),
		place: {
			path: ['Realm settings', 'Sessions', 'SSO Session Max'],
			page: 'realm-sessions',
			shows: ['SSO Session Idle', 'SSO Session Max']
		},
		backedBy: {
			question: 'ssoSessionMax',
			shows: {
				before: { idle: 1800, max: 36000, secondSawForm: false },
				after: { secondSawForm: true }
			}
		}
	},
	{
		id: 'session-lifetimes',
		steps: ['refresh-after-logout-response'],
		title: 'SSO Session Idle and SSO Session Max',
		text: 'Thirty minutes idle and ten hours at most, by default, and a refresh token ends with the session: it came with thirty minutes left. Made five seconds, either one had a refresh token refused seven seconds later, with Token is not active, and idle at five seconds, one used every three kept working for nine: using it keeps it going. Signing the user out from their page in the console ended it too. None of these ended an offline token.',
		when: is('logout', true),
		place: {
			path: ['Realm settings', 'Sessions', 'SSO Session Idle'],
			page: 'realm-sessions',
			shows: ['SSO Session Idle', 'SSO Session Max']
		},
		backedBy: {
			question: 'offlineTokens',
			shows: {
				before: {
					defaults: { ssoSessionIdleTimeout: 1800, ssoSessionMaxLifespan: 36000 },
					onDefaults: { online: { refreshExpiresIn: 1800, type: 'Refresh' } },
					signedOutByAnAdmin: { online: { status: 400 }, offline: { status: 200 } }
				},
				after: {
					sessionMaximum: { tried: { online: { status: 400 }, offline: { status: 200 } } },
					idle: { afterSevenSeconds: { online: { status: 400 } } },
					keptInUse: { online: [200, 200, 200] }
				}
			}
		}
	},
	{
		id: 'offline-session-lifetimes',
		steps: ['token-response', 'refresh-after-logout-response'],
		title: 'Offline Session Idle and Offline Session Max',
		text: 'Thirty days idle by default, which is the time an offline token came with, and no maximum, because Offline Session Max Limited is off. Turned on, Offline Session Max is sixty days. Made five seconds, either one had an offline token refused seven seconds later, with Token is not active, and idle at five seconds, one used every three kept working for nine.',
		when: all(is('logout', true), is('logoutKeeps', 'offline')),
		place: {
			path: ['Realm settings', 'Sessions', 'Offline Session Idle'],
			page: 'realm-sessions',
			shows: ['Offline Session Idle', 'Offline Session Max Limited']
		},
		backedBy: {
			question: 'offlineTokens',
			shows: {
				before: {
					defaults: {
						offlineSessionIdleTimeout: 2592000,
						offlineSessionMaxLifespanEnabled: false,
						offlineSessionMaxLifespan: 5184000
					},
					onDefaults: { offline: { refreshExpiresIn: 2592000, type: 'Offline' } }
				},
				after: {
					offlineMaximum: { refreshExpiresIn: 5, tried: { status: 400 } },
					idle: { afterSevenSeconds: { offline: { status: 400 } } },
					keptInUse: { offline: [200, 200, 200] }
				}
			}
		}
	},
	{
		id: 'session-cookie',
		steps: ['redirect-with-code', 'second-authorize'],
		title: 'Where it keeps the session',
		text: "In a cookie called KEYCLOAK_IDENTITY, on Keycloak's own address, and HttpOnly, so a script on that page cannot read it either. The two ID tokens came out with the same sid and auth_time, and each app's own aud. Told not to show a form, it gave a code to the browser with a session, and login_required to a new one.",
		when: is('sso', true),
		backedBy: {
			question: 'singleSignOn',
			shows: {
				second: { sawForm: false, gotACode: true },
				sameSession: true,
				sameLoginTime: true,
				insists: { sawForm: true },
				told: {
					withASession: { sawForm: false, gotACode: true },
					inANewBrowser: { sawForm: false, error: 'login_required' }
				},
				cookie: { name: 'KEYCLOAK_IDENTITY', httpOnly: true }
			}
		},
		seen: 'Tried each of these with two clients, on'
	},
	{
		id: 'revoke-refresh-token',
		steps: ['refresh-again-response', 'refresh-newest-response'],
		title: 'Revoke Refresh Token',
		text: "Off by default, so the old refresh token keeps working though a new one came back, on a client with no secret too. RFC 9700 asks more than that of a public client, so this is the setting to look at. Turn it on and a second use says Maximum allowed refresh token reuse exceeded, and then the newest one says Session doesn't have required client, because the second use ended the session for that client.",
		when: is('refresh', true),
		place: {
			path: ['Realm settings', 'Tokens', 'Revoke Refresh Token'],
			page: 'realm-settings',
			opens: 'Tokens',
			shows: ['Revoke Refresh Token']
		},
		backedBy: {
			question: 'revokeRefreshToken',
			shows: {
				before: {
					setting: false,
					oldAgain: { status: 200 },
					oldAgainWithNoSecret: { again: 200 }
				},
				after: {
					oldAgain: {
						status: 400,
						error: 'invalid_grant',
						description: 'Maximum allowed refresh token reuse exceeded'
					},
					newest: {
						status: 400,
						error: 'invalid_grant',
						description: "Session doesn't have required client"
					}
				}
			}
		}
	},
	{
		id: 'short-for-this-recording',
		steps: ['token-runs-out'],
		title: 'How long this recording waited',
		text: 'An access token lasts five minutes on a default Keycloak, and its refresh token thirty. In this recording the access token lasts three seconds, so it does not have to wait, which is why expires_in says 3. A token with a life of one second, once that was over, got a 401 from UserInfo, and a refresh then said 200.',
		when: is('refresh', true),
		backedBy: {
			question: 'refreshTokens',
			shows: {
				first: { expiresIn: 300, refreshExpiresIn: 1800 },
				pastItsLife: { userinfo: 401, thenARefresh: 200, idTokenAgain: true }
			}
		},
		seen: 'Let a token run out, and tried both on'
	},
	{
		id: 'how-an-api-says-no',
		steps: ['api-response'],
		title: 'What its own API answers',
		text: "This answer is from the demo API. Keycloak's own UserInfo answers the same way: a 401 with no error when there is no token, a 401 with invalid_token and Token verification failed when it does not accept one, and a 403 with insufficient_scope when the token does not have the openid scope.",
		when: not(is('apiToken', 'good')),
		backedBy: {
			question: 'howAnApiSaysNo',
			shows: {
				goodToken: { status: 200 },
				noToken: { status: 401, wwwAuthenticate: 'Bearer realm="demo"' },
				changed: {
					status: 401,
					wwwAuthenticate:
						'Bearer realm="demo", error="invalid_token", error_description="Token verification failed"'
				},
				withoutOpenid: {
					status: 403,
					wwwAuthenticate:
						'Bearer realm="demo", error="insufficient_scope", error_description="Missing openid scope"'
				}
			}
		},
		seen: 'Tried each of these on'
	},
	{
		id: 'require-dpop',
		steps: ['token-request'],
		title: 'Require DPoP bound tokens',
		text: 'Off by default, and a client that sends a proof still gets a bound token. Turn it on and a request with no proof is refused. Someone with a stolen code can still send a proof of their own, so this alone does not protect the code.',
		when: dpop,
		place: clientSettings('Capability config', 'Require DPoP bound tokens'),
		flag: { name: 'dpop' },
		backedBy: {
			question: 'requireDpop',
			shows: { before: { status: 200, tokenType: 'Bearer' }, after: { status: 400 } }
		}
	},
	{
		id: 'no-dpop-nonce',
		steps: ['nonce-challenge'],
		title: 'Not something it did',
		text: 'Keycloak did not ask for a nonce when this was recorded: a proof with none got a 200 and a bound token.',
		backedBy: { question: 'dpopNonce', shows: { tokenStatus: 200, askedForNonce: false } },
		seen: 'Seen on'
	},
	{
		id: 'issuer',
		steps: ['configure-app', 'discover'],
		title: 'Endpoints',
		text: "The issuer is the server's address, then /realms/ and the name of the realm, so each realm is an identity provider of its own. This page links to its discovery document. RFC 8414 puts the well-known part ahead of the realm's path, at /.well-known/oauth-authorization-server/realms/demo, and this server answers there too. The recording asked after the realm instead, which is where OpenID Connect Discovery's address does go.",
		place: {
			path: ['Realm settings', 'General', 'Endpoints'],
			page: 'realm-settings',
			shows: ['Endpoints']
		},
		backedBy: {
			question: 'issuerPerRealm',
			shows: { realmsDiffer: true, endsWithRealm: true }
		},
		seen: 'Compared two realms on'
	},
	{
		id: 'auto-redirect',
		steps: ['find-company', 'add-organization'],
		title: 'Auto redirect',
		text: "On each of an organization's domains, beside the identity provider it goes to. Off, someone who types an address there gets a password page with only their company's button. On, they go straight there.",
		when: is('companies', true),
		place: {
			path: ['Organizations', 'the organization', 'Domains', 'Auto redirect'],
			page: 'organization-domains',
			shows: ['Identity provider', 'Auto redirect']
		},
		backedBy: {
			question: 'autoRedirect',
			shows: {
				before: { goesTo: null, buttons: ['acme'], asksForPassword: true },
				after: { goesTo: 'acme' }
			}
		}
	},
	{
		id: 'trust-email',
		steps: ['connect-directory', 'token-response'],
		title: 'Trust Email',
		text: 'Off on a new provider, so a token says email_verified false for someone from the directory, with their address right there. Turned on, it says true.',
		when: is('federation', true),
		place: {
			path: ['User federation', 'the provider', 'Settings', 'Trust Email'],
			page: 'directory-settings',
			shows: ['Trust Email']
		},
		backedBy: {
			question: 'trustEmail',
			shows: {
				before: { emailVerified: false },
				after: { emailVerified: true }
			}
		},
		claims: ['email_verified']
	},
	{
		id: 'broker-redirector',
		steps: ['redirect-to-upstream'],
		title: 'Identity Provider Redirector',
		text: 'Going straight to the other provider takes a default provider on this step of the browser flow, or the app sending kc_idp_hint. Without either, Keycloak shows its own login page, with a button for the other provider.',
		when: is('broker', true),
		place: {
			path: ['Authentication', 'browser', 'Identity Provider Redirector'],
			page: 'browser-flow',
			opens: 'browser',
			shows: ['Identity Provider Redirector']
		},
		backedBy: {
			question: 'brokerRedirector',
			shows: {
				before: { redirects: true },
				after: { redirects: false },
				withHint: { redirects: true }
			}
		}
	},
	// What goes on to the other provider, and what comes back from it into a user here (#182).
	{
		id: 'upstream-scopes',
		steps: ['upstream-authorize'],
		title: 'Scopes',
		text: 'What Keycloak asks this provider for. The app’s own scope did not go on: set to openid, with the app asking for openid email, the request here had openid, and set to openid profile, it had openid profile.',
		when: plainBroker,
		place: providerAdvanced('Scopes'),
		backedBy: {
			question: 'upstreamScope',
			shows: {
				appSent: 'openid email',
				before: { setTo: 'openid', sent: 'openid' },
				after: { setTo: 'openid profile', sent: 'openid profile' }
			}
		}
	},
	{
		id: 'upstream-prompt',
		steps: ['upstream-authorize'],
		title: 'Prompt',
		text: 'Not set on a new provider. Not set, the app’s select_account went on to the request here. Set to consent, the request had consent in its place. Asked straight with a prompt it does not know, the other provider, also Keycloak, showed its login page, so a provider that refuses one was not tried.',
		when: plainBroker,
		place: providerAdvanced('Prompt'),
		backedBy: {
			question: 'upstreamPrompt',
			shows: {
				byDefault: { prompt: null },
				appSent: 'select_account',
				before: { prompt: 'select_account' },
				after: { prompt: 'consent' },
				unknownPrompt: { status: 200, loginPage: true }
			}
		}
	},
	{
		id: 'upstream-pkce',
		steps: ['upstream-authorize', 'upstream-token-request'],
		title: 'Use PKCE',
		text: [
			{
				when: is('upstreamPkce', true),
				text: 'Off on a new provider, and on here, with S256. The request here has a code_challenge the identity provider made, and the trade a code_verifier, whether or not the app uses PKCE with it.'
			},
			{
				text: 'Off on a new provider, and here: the request here had no code_challenge, and none in any recording here where the app sent one. Turned on with S256, it had one, and the app still got its tokens after a login through it.'
			}
		],
		when: plainBroker,
		place: {
			path: [
				'Identity providers',
				'the provider',
				'Settings',
				'OpenID Connect settings',
				'Use PKCE'
			],
			page: 'provider-settings',
			shows: ['OpenID Connect settings', 'Use PKCE']
		},
		backedBy: {
			question: 'upstreamPkce',
			shows: {
				byDefault: { pkceEnabled: null },
				before: { codeChallenge: false },
				after: { codeChallenge: true, method: 'S256' },
				loginWithPkce: { tokenStatus: 200 }
			}
		}
	},
	{
		id: 'upstream-sync',
		steps: ['match-user'],
		title: 'Sync mode',
		text: 'Set to Import here. The first login made the user from what the other provider sent, and a later login, after their last name changed there, kept the old one. Set to Force, a later login copied the new one.',
		when: plainBroker,
		place: providerSettings('Sync mode'),
		backedBy: {
			question: 'upstreamSync',
			shows: {
				setUpWith: 'IMPORT',
				firstLogin: { lastName: 'Example' },
				before: { lastName: 'Example' },
				after: { lastName: 'Renamed' }
			}
		}
	},
	{
		id: 'upstream-trust-email',
		steps: ['match-user'],
		title: 'Trust Email',
		text: 'Off on a new provider, and on here, so the user made at the first login had a verified email. Turned off, a user made at a new first login had an email that was not verified, though the other provider had it verified. A user who was there already was not tried.',
		when: plainBroker,
		place: providerSettings('Trust Email'),
		backedBy: {
			question: 'upstreamTrustEmail',
			shows: {
				byDefault: { trustEmail: false },
				before: { emailVerified: true },
				after: { emailVerified: false }
			}
		}
	},
	{
		id: 'store-tokens',
		steps: ['store-upstream-tokens', 'enable-token-storage'],
		title: 'Store tokens',
		text: [
			{
				when: apiV2,
				text: 'Off by default. On API V2 this or Store token in session is enough for the app to ask, and with neither it gets a 400.'
			},
			{ text: 'Off by default, and then there is nothing for the app to ask for.' }
		],
		when: any(apiV1, apiV2),
		place: providerSettings('Store tokens'),
		backedBy: {
			question: 'storeTokens',
			shows: {
				byDefault: { storeToken: false },
				before: { status: 200 },
				after: { status: 400 }
			}
		}
	},
	{
		id: 'stored-tokens-readable',
		steps: ['retrieve-upstream-token', 'enable-token-storage'],
		title: 'Stored tokens readable',
		text: 'Gives each new user the role that lets their access token read the stored tokens. Without it, this request gets a 403. Users that already exist do not get it from this setting.',
		when: apiV1,
		place: providerSettings('Stored tokens readable'),
		flag: { name: 'identity-brokering-api:v1' },
		backedBy: {
			question: 'storedTokensReadable',
			shows: { before: { status: 200 }, after: { status: 403 } }
		}
	},
	{
		id: 'allow-external-tokens',
		steps: ['retrieve-upstream-token', 'enable-token-storage'],
		title: 'Allow retrieve external tokens',
		text: 'Lets this client ask for stored tokens, from the providers named in Allowed Identity Providers for External Tokens. The console only shows it on a server with API V2 on.',
		when: apiV2,
		place: clientSettings('Capability config', 'Allow retrieve external tokens', FLAG_V2),
		flag: { name: FLAG_V2 },
		backedBy: {
			question: 'allowExternalTokens',
			shows: { before: { status: 200 }, after: { status: 403 } }
		}
	},
	{
		id: 'api-reads-external-tokens',
		steps: ['api-retrieve-upstream-token', 'enable-token-storage'],
		title: 'Allow retrieve external tokens, for the API',
		text: 'On the API’s own client here, with this provider named in Allowed Identity Providers for External Tokens. A client allowed only another provider, or with the setting off, got a 403 with invalid_client and: Client not allowed to retrieve token for the provider. The console only shows it on a server with API V2 on.',
		when: apiReads,
		place: {
			path: [
				'Clients',
				'the API',
				'Settings',
				'Capability config',
				'Allow retrieve external tokens'
			],
			page: 'api-client-settings',
			shows: ['Capability config', 'Allow retrieve external tokens'],
			needsFlag: FLAG_V2
		},
		flag: { name: FLAG_V2 },
		backedBy: {
			question: 'apiReadsStored',
			shows: {
				before: { status: 403, gotUpstreamToken: false },
				after: { status: 200, gotUpstreamToken: true },
				byAClientForAnotherProvider: { status: 403, gotUpstreamToken: false }
			}
		}
	},
	{
		id: 'brokering-api-flags',
		steps: ['retrieve-upstream-token'],
		title: 'A server option',
		text: [
			{
				when: apiV2,
				text: 'API V2 needs the server started with this flag, and that turns API V1 off, which the docs do not say. Set it where the server starts. It is not in the admin console.'
			},
			{
				text: 'API V1 is on unless the server is started with the V2 flag, and that turns it off, which the docs do not say. Set it where the server starts. It is not in the admin console.'
			}
		],
		when: any(apiV1, apiV2),
		serverOption: `--features=${FLAG_V2}`,
		backedBy: {
			question: 'apiV1WhenV2IsEnabled',
			shows: { status: 400 }
		},
		seen: 'Tried with and without the flag on'
	}
];

/** About a flow with no user. What backs these is beside its own recordings. */
export const noUserNoteDefs: readonly NoteDef[] = [
	{
		id: 'admin-permissions',
		steps: ['service-allow-one-role', 'service-finds-user'],
		when: is('givesRole', true),
		title: 'Admin Permissions',
		text: 'Off on a new realm. With it off, the app’s token got 403 from the admin API when it looked the user up, though the token was one that API takes. On, the permissions an admin makes decide what the app may do there, and nothing else lets it.',
		place: {
			path: ['Realm settings', 'General', 'Admin Permissions'],
			page: 'realm-settings',
			shows: ['Admin Permissions']
		},
		backedBy: {
			question: 'adminPermissions',
			shows: { before: { status: 403 }, after: { status: 200 } }
		}
	},
	{
		id: 'admin-api-scope',
		steps: ['service-allow-one-role', 'service-token-response', 'service-finds-user'],
		when: is('givesRole', true),
		claims: ['aud', 'scope'],
		claimsVerb: 'name the admin API because of',
		title: 'kc-admin-api',
		text: 'A client scope built in from Keycloak 26.8.2, which puts the admin API in a token’s audience and its own name in the token’s scope. Without it on the app’s client, the admin API answered 401 to the app’s token, whatever the permissions said.',
		place: {
			path: ['Clients', YOUR_CLIENT, 'Client scopes', 'Add client scope', 'kc-admin-api'],
			page: 'client-scopes',
			opens: 'Add client scope',
			shows: ['kc-admin-api']
		},
		backedBy: {
			question: 'adminApiScope',
			shows: {
				before: { status: 401, scope: false, namesTheAdminApi: false },
				after: { status: 200, scope: true, namesTheAdminApi: true }
			}
		}
	},
	{
		id: 'service-accounts',
		steps: ['service-token-request', 'service-create-client'],
		title: 'Service account roles',
		text: 'An app can only do this with this on. Without it the server answers 401 with unauthorized_client. Keycloak then keeps an account for the app, named service-account- and its client ID, and that is who the token says it is about. So it has a sub and a preferred_username, though no person is involved.',
		place: clientSettings('Capability config', 'Service account roles'),
		backedBy: {
			question: 'serviceAccountsOff',
			shows: {
				before: { status: 200 },
				after: { status: 401, error: 'unauthorized_client' },
				name: 'service-account-demo-service'
			}
		}
	},
	{
		id: 'id-token-for-client-credentials',
		steps: ['service-token-response'],
		title: 'An ID token, if asked for',
		text: 'Asked for the openid scope, this server sends an ID token here too. OpenID Connect defines an ID token for a login, so do not count on it elsewhere.',
		seen: 'Asked a real server for a token, with and without the openid scope.',
		backedBy: {
			question: 'idTokenWhenAsked',
			shows: { withoutAsking: false, askedForOpenId: true }
		}
	},
	{
		id: 'refresh-for-client-credentials',
		steps: ['service-token-response'],
		title: 'Use refresh tokens for client credentials grant',
		text: 'Off by default, and that is why there is none here. RFC 6749 says one should not be included. With this on, the server does send one.',
		place: {
			page: 'client-advanced',
			path: ['Clients', 'your client', 'Advanced', 'OpenID Connect Compatibility Modes'],
			shows: ['Use refresh tokens for client credentials grant']
		},
		backedBy: {
			question: 'refreshForClientCredentials',
			shows: { before: { gotRefreshToken: false }, after: { gotRefreshToken: true } }
		}
	}
];

/** About the flow on a device. What backs these is beside its own recordings. */
export const deviceNoteDefs: readonly NoteDef[] = [
	{
		id: 'device-grant',
		steps: ['device-request', 'device-create-client'],
		title: 'OAuth 2.0 Device Authorization Grant',
		text: 'Off on a new client. Without it, the first request gets 400 with unauthorized_client, and a description saying the flow is disabled for the client.',
		place: clientSettings('Capability config', 'OAuth 2.0 Device Authorization Grant'),
		backedBy: {
			question: 'deviceGrantOff',
			shows: { before: { status: 200 }, after: { status: 400, error: 'unauthorized_client' } }
		}
	},
	{
		id: 'device-always-asks',
		steps: ['device-consent-page'],
		title: 'It always asks here',
		text: 'This server shows this page whatever Consent required says on the client, and again for someone who agreed before. It names the client and what it would get. It does not ask whether the device is theirs, or say which, as the spec recommends. The page before says Device Login, but opening the full address skips that one. What a client is called matters here, though anyone sending this client’s ID gets the same name.',
		seen: 'Went through it on a real server, with Consent required off and on, and a second time after agreeing.',
		backedBy: {
			question: 'deviceConsent',
			shows: {
				consentRequiredOff: { asked: true },
				consentRequiredOn: { asked: true },
				afterAgreeingBefore: { asked: true }
			}
		}
	},
	{
		id: 'device-full-address',
		steps: ['device-response'],
		title: 'The full address skips the user code',
		text: 'Someone opening verification_uri_complete here is not asked for the user code and is not shown it. The spec says a server should show it, so the user can compare it with the device. That leaves the page that asks, and how long the user code lasts, as what stands between a code somebody sent and the tokens.',
		seen: 'Opened the full address on a real server, and looked at each page up to the end.',
		backedBy: {
			question: 'deviceFullAddress',
			shows: { asksForTheCode: false, showsTheCode: false, stillAsksToAgree: true }
		}
	},
	{
		id: 'device-timings',
		steps: ['device-response'],
		title: 'OAuth 2.0 Device Code Lifespan',
		seen: 'Set both on one client, and the answer changed. The realm’s own were found in the console, and not changed.',
		text: 'Ten minutes on this server unless set, with 5 seconds between asking. Both are in the realm’s token settings, and a client can have its own. A shorter life limits what a code sent to someone is worth, and leaves less time to find a phone.',
		place: {
			page: 'realm-tokens',
			path: ['Realm settings', 'Tokens', 'OAuth 2.0 Device Code Lifespan'],
			shows: ['OAuth 2.0 Device Code Lifespan', 'OAuth 2.0 Device Polling Interval']
		},
		backedBy: {
			question: 'deviceTimings',
			shows: {
				byDefault: { expiresIn: 600, interval: 5 },
				setOnTheClient: { expiresIn: 60, interval: 1 }
			}
		}
	},
	{
		id: 'device-pkce',
		steps: ['device-request'],
		title: 'It takes PKCE here too',
		text: 'RFC 8628 does not include PKCE. This server takes a code_challenge on this request anyway, and then wants the verifier when the app asks for tokens. Without it the answer is invalid_grant, with PKCE code verifier not specified.',
		seen: 'Sent a challenge on a real server, and asked with no verifier.',
		backedBy: {
			question: 'devicePkce',
			shows: {
				startedWithAChallenge: { status: 200 },
				askedWithNoVerifier: { status: 400, error: 'invalid_grant' }
			}
		}
	},
	{
		id: 'device-wrong-client',
		steps: ['device-poll-again'],
		title: 'Only the client that started it',
		text: 'Another client sending this device code gets invalid_grant, and the device code stays good for the one that started it. Used once, it stops working: the same request again gets invalid_grant too. With no secret, the client is only its ID, so this does not stop someone who sends that ID as well.',
		seen: 'Tried a device code from another client, and the same one twice.',
		backedBy: {
			question: 'deviceCodeUse',
			shows: {
				fromAnotherClient: { status: 400, error: 'invalid_grant' },
				usedTwice: { status: 400, error: 'invalid_grant' }
			}
		}
	}
];

const notesOfFlow: Readonly<Record<string, readonly NoteDef[]>> = {
	'authorization-code': noteDefs,
	'client-credentials': noUserNoteDefs,
	device: deviceNoteDefs
};

/** The notes on a step of this base flow, in these settings. */
export function notesFor(flow: string, step: string, settings: Settings): Note[] {
	return (notesOfFlow[flow] ?? [])
		.filter((def) => {
			const on = def.instead && holds(def.instead.when, settings) ? def.instead.steps : def.steps;
			return on.includes(step) && (!def.when || holds(def.when, settings));
		})
		.map((def) => ({
			id: def.id,
			title: def.title,
			text: resolveText(def.text, settings),
			path: def.place?.path,
			serverOption: def.serverOption,
			flag: def.flag,
			evidence: def.seen ?? CHANGED_IT,
			claims: def.claims ?? [],
			claimsVerb: def.claimsVerb
		}));
}
