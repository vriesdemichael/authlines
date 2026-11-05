import type { SourceRef } from '#lib/sources/sources.ts';

export interface Settings {
	oidc: boolean;
	consent: boolean;
	clientType: 'public' | 'confidential';
	pkce: boolean;
	par: boolean;
	attacker: boolean;
	attackerUses: 'themselves' | 'real-app';
	attackerGets: 'copy' | 'link';
	registered: 'exact' | 'any';
	binding: 'bearer' | 'dpop';
	dpopNonce: boolean;
	broker: boolean;
	upstreamTokens: 'off' | 'v1' | 'v2';
	upstreamReader: 'app' | 'api' | 'refused';
	apiToken: 'good' | 'none' | 'expired' | 'changed' | 'elsewhere' | 'noscope';
	exchange: boolean;
	exchangeGives: 'token' | 'refresh';
	linkAccount: boolean;
	linkEnds: 'linked' | 'cancelled';
	refresh: boolean;
	reuse: 'keeps' | 'ends';
	sso: boolean;
	ssoAsks: 'remembered' | 'insists' | 'fresh';
	logout: boolean;
	deviceEnds: 'agrees' | 'says-no' | 'runs-out';
	deviceAttack: 'nobody' | 'sends-code' | 'reads-code';
	address: 'registered' | 'other';
	appRuns: 'server' | 'page' | 'bff';
	oldWay: boolean;
	registration: 'manual' | 'dcr' | 'cimd';
	federation: boolean;
	companies: boolean;
	customerSpeaks: 'oidc' | 'saml';
	leaves: boolean;
	tokenThief: boolean;
	apiChecks: 'proof' | 'bearer';
}

export type SettingId = keyof Settings;

/** Conditions are data, not functions, so the application can say which setting caused what. */
export type Condition =
	| { [K in SettingId]: { setting: K; is: Settings[K] } }[SettingId]
	| { all: readonly Condition[] }
	| { any: readonly Condition[] }
	| { not: Condition };

export const is = <K extends SettingId>(setting: K, value: Settings[K]): Condition =>
	({ setting, is: value }) as Condition;
export const all = (...conditions: Condition[]): Condition => ({ all: conditions });
export const any = (...conditions: Condition[]): Condition => ({ any: conditions });
export const not = (condition: Condition): Condition => ({ not: condition });

export function holds(condition: Condition, settings: Settings): boolean {
	if ('setting' in condition) return settings[condition.setting] === condition.is;
	if ('all' in condition) return condition.all.every((c) => holds(c, settings));
	if ('any' in condition) return condition.any.some((c) => holds(c, settings));
	return !holds(condition.not, settings);
}

export function settingsIn(condition: Condition): SettingId[] {
	if ('setting' in condition) return [condition.setting];
	const parts =
		'all' in condition ? condition.all : 'any' in condition ? condition.any : [condition.not];
	return [...new Set(parts.flatMap(settingsIn))];
}

/** What must hold for a setting or option to be available, and the reason to show when it does not. */
export interface Requirement {
	when: Condition;
	because: string;
	/**
	 * Stays on offer, turned off, and says why. For a setting that does not fit with another, where one
	 * that needs another first just appears when it can be used.
	 */
	sayWhenBlocked?: boolean;
}

interface SettingBase {
	label: string;
	param: string;
	summary: string;
	/** The problem it solves, because a toggle by itself only shows what changed. */
	why: string;
	/** Present when simple mode offers this setting, in words that need no explaining first. */
	simple?: { label: string; summary: string };
	/** Not a control of its own: a question or the first screen turns it on, and then it is a chip. */
	notOnOffer?: boolean;
	/** The only base flow it means anything on, so that no other flow has to test its combinations. */
	onlyOn?: string;
	sources: readonly SourceRef[];
	requires?: Requirement;
}

export interface ToggleDef extends SettingBase {
	kind: 'toggle';
	default: boolean;
	/** What turning this on brings with it. */
	setsWhenOn?: Partial<Settings>;
}

/** A Keycloak feature flag behind an option. Its status comes from a real server (recorded.json). */
export interface KeycloakFlag {
	name: string;
	/** What Keycloak's docs add, where the server itself does not say. */
	docs?: string;
}

export interface OptionDef<V extends string = string> {
	/** What it says as a chip in simple mode, where the setting is not on offer to explain it. */
	plainly?: string;
	/** What choosing this brings with it. */
	sets?: Partial<Settings>;
	/** Why this one, where what the setting says as a whole would be wrong about it. */
	why?: string;
	value: V;
	label: string;
	requires?: Requirement;
	flag?: KeycloakFlag;
}

export interface ChoiceDef<V extends string = string> extends SettingBase {
	kind: 'choice';
	default: V;
	options: readonly OptionDef<V>[];
}

export type SettingDef = ToggleDef | ChoiceDef;

type DefFor<T> = [T] extends [boolean] ? ToggleDef : ChoiceDef<T & string>;

export const settingDefs: { [K in SettingId]: DefFor<Settings[K]> } = {
	oidc: {
		kind: 'toggle',
		label: 'OpenID Connect',
		param: 'oidc',
		default: false,
		summary: 'Adds proof of who logged in on top of the access OAuth grants.',
		why: 'OAuth tells an app what it may do, not who the user is. An access token is for the API, and nothing promises the app can read it, even where it happens to name the user. OpenID Connect adds an ID token, made for the app, that says who logged in.',
		simple: {
			label: 'Know who logged in',
			summary:
				'If you are adding login, this is the part you want. Turns on OpenID Connect, so the app also gets proof of who the user is.'
		},
		sources: [
			{
				source: 'oidc-core',
				why: 'This switch adds what it defines on top of OAuth: the openid scope, the ID token and UserInfo.'
			}
		]
	},
	consent: {
		kind: 'toggle',
		label: 'Ask for consent',
		param: 'consent',
		default: false,
		summary: 'The identity provider asks the user whether the app may have this access.',
		why: 'An app should only get what the user is willing to give it. So the identity provider, which the user already trusts with their password, asks them. What it lists are scopes: each one names some access or some information. Many identity providers skip the question for their own apps, so you may never have seen it.',
		simple: {
			label: 'Ask the user to agree',
			summary: 'The identity provider asks whether the app may have this access.'
		},
		sources: [
			{
				source: 'rfc6749',
				section: '4.1',
				why: 'Section 4.1 has this as a step of the flow: the server asks the resource owner to grant or deny the access.'
			}
		]
	},
	clientType: {
		kind: 'choice',
		label: 'Client type',
		param: 'client',
		default: 'confidential',
		summary:
			'Whether the app can keep a secret. One that cannot, such as an app in a browser, has to rely on PKCE.',
		why: "A secret inside an app on someone else's device is not secret, because anyone can read it out. So an app in a browser or on a phone cannot prove who it is that way, and is treated differently. In a browser, the app and the browser on this diagram are the same place, so its direct calls come from the page.",
		sources: [
			{
				source: 'rfc6749',
				section: '2.1',
				why: 'Section 2.1 defines both types by one thing: whether the client can keep its credentials confidential. An app in a browser cannot.'
			}
		],
		options: [
			{ value: 'confidential', label: 'Confidential' },
			{ value: 'public', label: 'Public', plainly: 'This app has no secret' }
		]
	},
	registration: {
		kind: 'choice',
		label: 'How the provider learns about the app',
		param: 'register',
		default: 'manual',
		onlyOn: 'authorization-code',
		summary:
			'Someone registers it by hand, it registers itself, or it points at a document about itself. It changes the setup, and with a document the login too.',
		why: 'Registering each app by hand works until there are more apps than people to register them, or apps nobody knew about in advance. So an app can register itself, or be its own registration, with a document at an address it controls.',
		sources: [
			{
				source: 'rfc7591',
				section: '3',
				why: 'Section 3 is the request an app sends to register itself, and what comes back.'
			},
			{
				source: 'cimd-draft',
				why: 'The client ID is the address of a document about the app, and the server fetches it when it needs to. It is still a draft.'
			}
		],
		options: [
			{ value: 'manual', label: 'Someone registers it' },
			{
				value: 'dcr',
				label: 'It registers itself (DCR)',
				requires: {
					when: all(
						is('clientType', 'confidential'),
						is('pkce', false),
						is('oidc', false),
						is('consent', false),
						is('attacker', false),
						is('binding', 'bearer'),
						is('broker', false),
						is('apiToken', 'good'),
						is('refresh', false),
						is('sso', false),
						is('logout', false),
						is('address', 'registered'),
						is('appRuns', 'server'),
						is('oldWay', false)
					),
					because: 'Only drawn in the plain case so far.'
				}
			},
			{
				value: 'cimd',
				label: 'It points at a document (CIMD)',
				flag: { name: 'cimd', docs: 'And a client policy.' },
				sets: { clientType: 'public', pkce: true, consent: true },
				requires: {
					when: all(
						is('clientType', 'public'),
						is('pkce', true),
						is('oidc', false),
						is('consent', true),
						is('attacker', false),
						is('binding', 'bearer'),
						is('broker', false),
						is('apiToken', 'good'),
						is('refresh', false),
						is('sso', false),
						is('logout', false),
						is('address', 'registered'),
						is('appRuns', 'server'),
						is('oldWay', false)
					),
					because: 'Only drawn in the plain case so far.'
				}
			}
		]
	},
	pkce: {
		kind: 'toggle',
		label: 'PKCE',
		param: 'pkce',
		default: false,
		summary:
			'The app proves it started this login, so a stolen code is no use alone. Current advice is to have it on, and a public client must.',
		why: 'The code goes through the browser, where other software can get at it. An app with none has nothing else to show that it is the one that asked, so whoever holds the code gets the tokens. An app with a secret can prove who it is, and someone can still hand it the stolen code to trade for them. With PKCE the code only works together with a value that was never in a redirect, from the login the code came from.',
		simple: {
			label: 'Protect against a stolen code',
			summary:
				'The app proves it started this login, so a code someone intercepts is no use to them. Current advice is to always have this on.'
		},
		sources: [
			{
				source: 'rfc7636',
				section: '1',
				why: 'Section 1 describes the attack on an app with no secret. Section 4 is what this switch adds to the messages.'
			},
			{
				source: 'rfc9700',
				section: '2.1.1',
				why: 'Section 2.1.1 is the current advice: public clients must use PKCE, and it is recommended for all others.'
			}
		]
	},
	par: {
		kind: 'toggle',
		label: 'PAR',
		param: 'par',
		default: false,
		onlyOn: 'authorization-code',
		summary:
			'The app sends its request straight to the identity provider, and the browser carries only the client ID and a reference.',
		why: 'Everything in a login link goes through the browser, where it can be read on the way, changed, or end up in a log, and a long one can be too long for an address. Pushed first, it goes direct from the app, which can prove who it is while it is at it, and the identity provider checks it before the user is sent anywhere.',
		sources: [
			{
				source: 'rfc9126',
				section: '1',
				why: 'Section 1 says what goes wrong with a request in the address: nothing protects it from being changed or read, and it can get too long. Section 4 is what the browser carries instead.'
			}
		],
		requires: {
			when: all(
				is('attacker', false),
				is('binding', 'bearer'),
				is('broker', false),
				is('apiToken', 'good'),
				is('refresh', false),
				is('sso', false),
				is('logout', false),
				is('address', 'registered'),
				is('appRuns', 'server'),
				is('registration', 'manual'),
				is('oldWay', false),
				is('federation', false),
				is('companies', false)
			),
			because:
				'Drawn so far with nothing else on but OpenID Connect, consent and PKCE, with either kind of client and the app on a server.',
			sayWhenBlocked: true
		}
	},
	attacker: {
		kind: 'toggle',
		label: 'An attacker',
		param: 'attacker',
		default: false,
		summary:
			'Someone gets hold of the code and tries to use it. Flip PKCE, the client type or how they get it to see what changes.',
		why: 'A protection is hard to believe in until you see what it stops. This changes nothing about what the app does. It shows what someone else could do with a code for this app, and the answers they get are what a real server gave.',
		simple: {
			label: 'Show someone stealing the code',
			summary:
				'Someone copies the code as it crosses the browser, and tries to use it. See what they get.'
		},
		sources: [
			{
				source: 'rfc7636',
				section: '1',
				why: 'Section 1 describes this attack, with a figure, on an app with no secret.'
			},
			{
				source: 'rfc9700',
				section: '4.5',
				why: 'Section 4.5 is what someone can do with a stolen code, including on an app that has a secret.'
			}
		],
		requires: {
			when: all(is('binding', 'bearer'), is('broker', false)),
			because: 'The attacker only shows the plain case, with a Bearer token and no other provider.',
			sayWhenBlocked: true
		}
	},
	tokenThief: {
		kind: 'toggle',
		label: 'Show someone using a stolen token',
		param: 'thief',
		default: false,
		onlyOn: 'authorization-code',
		summary: 'Someone has the access token, and calls the API with it, without a proof.',
		why: 'A stolen access token is only refused where the API checks the proof. The identity provider checks proofs at its own endpoints, and cannot check them at yours, so it is up to the API and the library or gateway it uses.',
		sources: [
			{
				source: 'rfc9449',
				section: '7.2',
				why: 'Section 7.2 says an API that knows only Bearer would most likely take a DPoP-bound token as a Bearer one, and one that supports both must refuse that.'
			}
		],
		requires: {
			when: all(
				is('binding', 'dpop'),
				is('dpopNonce', false),
				is('oidc', false),
				is('consent', false),
				is('clientType', 'confidential'),
				is('pkce', false),
				is('attacker', false),
				is('broker', false),
				is('apiToken', 'good'),
				is('refresh', false),
				is('sso', false),
				is('logout', false),
				is('address', 'registered'),
				is('appRuns', 'server'),
				is('registration', 'manual'),
				is('federation', false)
			),
			because: 'Only with a DPoP token, in the plain case so far.'
		}
	},
	apiChecks: {
		kind: 'choice',
		label: 'What the API checks',
		param: 'checks',
		default: 'proof',
		onlyOn: 'authorization-code',
		summary:
			'An API that checks the DPoP proof, or one written before DPoP that knows only Bearer.',
		why: 'The same token gets two answers. An API that knows DPoP sees the token is tied to a key and wants the proof. One that knows only Bearer may never look at that, and the one recorded took the token alone.',
		sources: [
			{
				source: 'rfc9449',
				section: '7.1',
				why: 'Section 7.1 is what an API checks for a DPoP-bound token, including the proof.'
			}
		],
		requires: {
			when: is('tokenThief', true),
			because: 'Only someone using a stolen token asks this.'
		},
		options: [
			{ value: 'proof', label: 'Checks the proof' },
			{ value: 'bearer', label: 'Knows only Bearer' }
		]
	},
	attackerUses: {
		kind: 'choice',
		label: 'What they do with it',
		param: 'uses',
		default: 'themselves',
		summary:
			'A secret stops them trading the code themselves. They can also get the real app to trade it for them, secret and all.',
		why: 'This is why current advice recommends PKCE for an app with a secret too. The secret proves the request comes from the real app, and here it does. Nothing in the request says the code was meant for someone else.',
		options: [
			{ value: 'themselves', label: 'Trade it themselves' },
			{ value: 'real-app', label: 'Hand it to the real app' }
		],
		requires: {
			when: all(is('attacker', true), is('clientType', 'confidential'), is('attackerGets', 'copy')),
			because:
				'Only an app with a secret needs this, and only for a copied code. With no secret, they can just trade it.'
		},
		sources: [
			{
				source: 'rfc9700',
				section: '4.5',
				why: 'Section 4.5 is this attack, which it calls authorization code injection, and section 4.5.3 what stops it.'
			}
		]
	},
	attackerGets: {
		kind: 'choice',
		label: 'How they get the code',
		param: 'gets',
		default: 'copy',
		onlyOn: 'authorization-code',
		summary:
			'They copy it as it goes by, or they get the user to open a login link of their own, which asks for the code to go to them.',
		why: 'Anyone can make a login link for any app, because the client ID is in every login address. What keeps the code from going where the link says is the identity provider, which only sends it to an address registered for the app.',
		sources: [
			{
				source: 'rfc9700',
				section: '4.1.1',
				why: 'Section 4.1.1 is this attack: a link of theirs, with an address the identity provider should not have let through, and the code sent straight to them.'
			}
		],
		options: [
			{ value: 'copy', label: 'A copy, as it goes by' },
			{ value: 'link', label: 'Their own login link', sets: { attackerUses: 'themselves' } }
		],
		requires: {
			when: all(
				is('attacker', true),
				is('appRuns', 'server'),
				is('registration', 'manual'),
				is('federation', false),
				is('companies', false),
				is('consent', false),
				is('refresh', false),
				is('sso', false),
				is('logout', false),
				is('apiToken', 'good'),
				is('address', 'registered')
			),
			because: 'Only in the plain case so far, with the app on a server.'
		}
	},
	registered: {
		kind: 'choice',
		label: 'What the app registered',
		param: 'registered',
		default: 'exact',
		onlyOn: 'authorization-code',
		summary: 'Its exact address, or *, which some put there to make a redirect_uri error go away.',
		why: 'The identity provider sends the code only to an address registered for the app. With *, the server recorded took any address at all, so their link got them the code. An exact address stops it, and the identity provider is what checks it.',
		sources: [
			{
				source: 'rfc9700',
				section: '4.1.3',
				why: 'Section 4.1.3 is what stops it: the identity provider compares the address with what was registered, exactly.'
			}
		],
		options: [
			{ value: 'exact', label: 'Its exact address' },
			{ value: 'any', label: 'A wildcard, *' }
		],
		requires: {
			when: is('attackerGets', 'link'),
			because: 'Only a link of theirs asks this.'
		}
	},
	binding: {
		kind: 'choice',
		label: 'Token type',
		param: 'binding',
		default: 'bearer',
		summary: 'Whether holding the token is enough, or the app must also prove it holds a key.',
		why: 'Whoever holds a bearer token can use it, so a token that leaks is as good as the real thing. DPoP ties the token to a key that never leaves the app, so at an API that checks the proof a stolen token alone gets nobody in. Code running inside the app can still use the key while it is there.',
		sources: [
			{ source: 'rfc6750', why: 'This is the Bearer option: holding the token is enough.' },
			{
				source: 'rfc9449',
				why: 'This is the DPoP option: the app also has to prove it holds the key.'
			}
		],
		options: [
			{ value: 'bearer', label: 'Bearer' },
			{ value: 'dpop', label: 'DPoP', flag: { name: 'dpop' } }
		]
	},
	dpopNonce: {
		kind: 'toggle',
		label: 'Server requires a nonce',
		param: 'nonce',
		default: false,
		summary: 'The server rejects the first proof, to limit how long a proof can be used.',
		why: 'Someone who gets at the app for a moment could make proofs now and use them much later. A nonce from the server has to be in the proof, so a proof made in advance is no use.',
		sources: [
			{
				source: 'rfc9449',
				section: '8',
				why: 'Section 8 lets the server answer a proof without its nonce with use_dpop_nonce, which limits how far ahead a proof can be made.'
			}
		],
		requires: { when: is('binding', 'dpop'), because: 'A DPoP nonce only applies to DPoP tokens.' }
	},
	broker: {
		kind: 'toggle',
		label: 'External IdP',
		param: 'broker',
		default: false,
		setsWhenOn: { federation: false },
		summary: 'The IdP hands the login to another IdP. The app does not notice.',
		why: 'Users often already have an account somewhere else, such as at their employer. The IdP hands the login over, so an app that already uses it needs no changes, and by default never learns how the login happened.',
		simple: {
			label: 'Log in with another provider',
			summary: 'The identity provider hands the login to another one. The app does not notice.'
		},
		sources: [
			{
				source: 'keycloak-brokering',
				why: "Keycloak's name for this is identity brokering. The diagram shows a login through an upstream provider that uses the authorization code flow."
			}
		]
	},
	federation: {
		kind: 'toggle',
		label: 'Users in a directory',
		param: 'directory',
		default: false,
		setsWhenOn: { broker: false },
		onlyOn: 'authorization-code',
		summary: 'The identity provider checks users in LDAP or Active Directory.',
		why: 'Many organisations already have their users in a directory. Another provider takes the login away, and with this the identity provider keeps the login and only asks the directory, so the browser and the app see no difference.',
		sources: [
			{
				source: 'keycloak-federation',
				why: "Keycloak's name for this is user federation. It looks the user up in the directory, from the server."
			}
		],
		requires: {
			when: all(
				is('oidc', false),
				is('consent', false),
				is('clientType', 'confidential'),
				is('pkce', false),
				is('attacker', false),
				is('binding', 'bearer'),
				is('broker', false),
				is('apiToken', 'good'),
				is('refresh', false),
				is('sso', false),
				is('logout', false),
				is('address', 'registered'),
				is('appRuns', 'server'),
				is('registration', 'manual'),
				is('oldWay', false)
			),
			because: 'Only drawn in the plain case so far.',
			sayWhenBlocked: true
		}
	},
	companies: {
		kind: 'toggle',
		label: 'Each customer has a provider',
		param: 'companies',
		default: false,
		setsWhenOn: { broker: true, federation: false },
		onlyOn: 'authorization-code',
		summary:
			'Users log in at their own company, which the identity provider finds from their email.',
		why: 'An app sold to other businesses meets customers who each have a provider of their own, and their people expect to log in with their company account. The identity provider in the middle finds the company from the email and sends them there, so the app still knows only one provider.',
		sources: [
			{
				source: 'keycloak-organizations',
				why: "Keycloak's name for a customer here is an organization. Each of its domains can name the provider its people are sent to."
			}
		],
		requires: {
			when: all(
				is('broker', true),
				is('upstreamTokens', 'off'),
				is('oidc', false),
				is('consent', false),
				is('clientType', 'confidential'),
				is('pkce', false),
				is('binding', 'bearer'),
				is('apiToken', 'good'),
				is('address', 'registered'),
				is('registration', 'manual'),
				is('appRuns', 'server')
			),
			because: 'Only with another provider, in the plain case so far.',
			sayWhenBlocked: true
		}
	},
	customerSpeaks: {
		kind: 'choice',
		label: 'What their provider speaks',
		param: 'speaks',
		default: 'oidc',
		onlyOn: 'authorization-code',
		summary:
			'OpenID Connect, as on the rest of this diagram, or SAML, which many companies still run.',
		why: "A customer's IT may ask about SAML in the first meeting. The app's side does not change. Only the part between the two providers does: with SAML set up as here, the answer comes back through the browser in a signed response, where OpenID Connect sends a code and trades it out of sight.",
		sources: [
			{
				source: 'saml-core',
				why: 'SAML 2.0 defines the assertion, the statement about who logged in that comes back here.'
			}
		],
		requires: {
			when: is('companies', true),
			because: "Only a customer's own provider is asked this."
		},
		options: [
			{ value: 'oidc', label: 'OpenID Connect' },
			{ value: 'saml', label: 'SAML' }
		]
	},
	leaves: {
		kind: 'toggle',
		label: 'Someone leaves the company',
		param: 'leaves',
		default: false,
		onlyOn: 'authorization-code',
		summary: 'Their company turns their account off, and what still works here.',
		why: "When someone leaves, their company's admins turn their account off at their own provider. What a customer wants to know is how long that person can still get in through your app. Unless something is set up to tell it, the identity provider in the middle is not told.",
		sources: [
			{
				source: 'keycloak-timeouts',
				why: 'How long they can still get in is how long the session in the middle lasts, which these settings say.'
			}
		],
		requires: {
			when: is('companies', true),
			because: 'Only someone at a customer with a provider of their own leaves it.'
		}
	},
	upstreamTokens: {
		kind: 'choice',
		label: 'Stored upstream tokens',
		param: 'upstream',
		default: 'off',
		summary: "The IdP keeps the upstream IdP's tokens, and the app can ask for them.",
		why: "Sometimes the app has to call the other provider's own APIs for this user, such as their calendar. It has no token for that, but the IdP received one during the login. API V1 hands over everything it stored, and API V2 only the access token.",
		sources: [
			{
				source: 'keycloak-stored-tokens',
				why: 'The two API options here are the two versions this page describes.'
			}
		],
		requires: {
			when: is('broker', true),
			because: 'Upstream tokens only exist when another IdP handles the login.'
		},
		options: [
			{ value: 'off', label: 'Off' },
			{
				value: 'v1',
				label: 'API V1',
				flag: { name: 'identity-brokering-api:v1', docs: 'Deprecated in its docs.' }
			},
			{
				value: 'v2',
				label: 'API V2',
				flag: { name: 'identity-brokering-api:v2' },
				requires: {
					// The app needs a secret only when it is the one that reads the token (#180).
					when: all(
						is('binding', 'bearer'),
						any(
							is('clientType', 'confidential'),
							is('upstreamReader', 'api'),
							is('upstreamReader', 'refused')
						)
					),
					because:
						'API V2 only works with a Bearer token, and for a confidential client, which the app has to be unless an API reads the token.'
				}
			}
		]
	},
	upstreamReader: {
		kind: 'choice',
		label: 'Who reads it',
		param: 'reads',
		default: 'app',
		onlyOn: 'authorization-code',
		summary:
			'The app that logged in, or an API it calls, with a client of its own that the identity provider allows this provider.',
		why: 'Whoever reads the stored token holds a token for the user at the other provider. An API that needs it can read it itself, so the app does not have to and can be one with no secret, and each API can be allowed only the provider it needs.',
		sources: [
			{
				source: 'keycloak-stored-tokens',
				why: 'This page describes both ways to get the stored tokens, and API V2 is the one drawn here.'
			}
		],
		requires: {
			when: is('upstreamTokens', 'v2'),
			because: 'This is drawn with API V2, where whoever reads the token proves who it is.'
		},
		options: [
			{ value: 'app', label: 'The app that logged in' },
			{ value: 'api', label: 'The API, allowed this provider' },
			{ value: 'refused', label: 'An API not allowed this provider' }
		]
	},
	apiToken: {
		kind: 'choice',
		label: 'What the API is sent',
		param: 'send',
		default: 'good',
		summary: 'The same call to the API, and what it answers depending on the token.',
		why: 'An API checks a token before it answers, and each way that fails looks alike from the app. A 401 means it does not accept the token, and a 403 that it does and still refuses, often because the token does not allow this. A new token can help with the first, and usually not with the second.',
		sources: [
			{
				source: 'rfc6750',
				section: '3.1',
				why: 'Section 3.1 says what an API answers in each of these cases, and in which status.'
			}
		],
		requires: {
			when: all(
				is('binding', 'bearer'),
				is('broker', false),
				is('attacker', false),
				is('oidc', false),
				is('consent', false)
			),
			because: 'This shows the plain case, so other settings do not get in the way of the answer.',
			sayWhenBlocked: true
		},
		options: [
			{ value: 'good', label: 'A good token' },
			{ value: 'none', label: 'No token' },
			{ value: 'expired', label: 'An expired token' },
			{ value: 'changed', label: 'A changed token' },
			{ value: 'elsewhere', label: 'A token for another API' },
			{ value: 'noscope', label: 'A token that does not allow this' }
		]
	},
	exchange: {
		kind: 'toggle',
		label: 'Token exchange',
		param: 'exchange',
		default: false,
		onlyOn: 'authorization-code',
		summary:
			'The API needs a second API to answer, and trades the token it got for one meant for that API.',
		why: 'A token says which API it is for, and another API should refuse it. One way for an API that has to call another one for the user, and the one drawn here, is to ask the identity provider for a new token for the same user, meant for the next API, and send that on instead.',
		sources: [
			{
				source: 'rfc8693',
				section: '1',
				why: 'Section 1 describes this: an API trading the access token it got for one fit to send to the service behind it. Section 2.1 is the request, and section 1.1 the two things the new token can mean.'
			}
		],
		requires: {
			when: all(
				is('attacker', false),
				is('binding', 'bearer'),
				is('broker', false),
				is('apiToken', 'good'),
				is('refresh', false),
				is('sso', false),
				is('logout', false),
				is('address', 'registered'),
				is('appRuns', 'server'),
				is('registration', 'manual'),
				is('oldWay', false),
				is('federation', false),
				is('companies', false),
				is('par', false)
			),
			because:
				'Drawn so far with nothing else on but OpenID Connect, consent and PKCE, with either kind of client and the app on a server.',
			sayWhenBlocked: true
		}
	},
	exchangeGives: {
		kind: 'choice',
		label: 'What the trade gives back',
		param: 'trade',
		default: 'token',
		onlyOn: 'authorization-code',
		summary:
			'Only a token for the second API, or a refresh token as well, so that the API can get another later without the user.',
		why: 'A token from a trade does not last long, five minutes on the server recorded, and an API doing a long job for the user needs another one later. A refresh token from the trade is one way, and how long it keeps working is up to the server.',
		sources: [
			{
				source: 'rfc8693',
				section: '2.2.1',
				why: 'Section 2.2.1 is what the answer to a trade holds. It says a refresh token will typically not come with a trade of one temporary credential for another, and can where the API has to keep going after the token it traded is no longer good.'
			}
		],
		requires: {
			when: is('exchange', true),
			because: 'There is nothing to trade until token exchange is on.'
		},
		options: [
			{ value: 'token', label: 'A token for the second API' },
			{ value: 'refresh', label: 'A refresh token as well' }
		]
	},
	linkAccount: {
		kind: 'toggle',
		label: 'Account linking',
		param: 'link',
		default: false,
		onlyOn: 'authorization-code',
		summary:
			'Logged in, the user links an account at another provider, whose tokens the identity provider keeps.',
		why: 'Some apps have to reach another system for the user, such as their calendar, where the user did not log in. Linking sends them to that provider once, while they are logged in, and the identity provider keeps its tokens beside the user.',
		sources: [
			{
				source: 'keycloak-account-linking',
				why: 'This page is how an app asks for a link, with one parameter on an ordinary authorization request.'
			}
		],
		requires: {
			when: all(
				is('attacker', false),
				is('binding', 'bearer'),
				is('broker', false),
				is('apiToken', 'good'),
				is('refresh', false),
				is('sso', false),
				is('logout', false),
				is('address', 'registered'),
				is('appRuns', 'server'),
				is('registration', 'manual'),
				is('oldWay', false),
				is('federation', false),
				is('companies', false),
				is('par', false),
				is('exchange', false)
			),
			because:
				'Drawn so far with nothing else on but OpenID Connect, consent and PKCE, with either kind of client and the app on a server.',
			sayWhenBlocked: true
		}
	},
	linkEnds: {
		kind: 'choice',
		label: 'How the link ends',
		param: 'linkends',
		default: 'linked',
		onlyOn: 'authorization-code',
		summary: 'The user goes on and links it, or cancels at the page that asks.',
		why: 'The app is told either way, in the address it is sent back to, and has to handle both.',
		sources: [
			{
				source: 'keycloak-account-linking',
				why: 'This page is how an app asks for a link, and what comes back.'
			}
		],
		requires: {
			when: is('linkAccount', true),
			because: 'There is no link to end until account linking is on.'
		},
		options: [
			{ value: 'linked', label: 'Linked' },
			{ value: 'cancelled', label: 'Cancelled' }
		]
	},
	refresh: {
		kind: 'toggle',
		label: 'When the token runs out',
		param: 'refresh',
		default: false,
		summary: 'Later on the access token expires, and the app gets a new one without the user.',
		why: 'An access token is short-lived so that a stolen one is not good for long, and nobody wants to log in that often. A refresh token is how both can be true, which also makes it worth stealing.',
		sources: [
			{
				source: 'rfc6749',
				section: '6',
				why: 'Section 6 is how an app uses a refresh token, and says a server may send a new one back.'
			}
		],
		requires: {
			when: all(
				is('binding', 'bearer'),
				is('broker', false),
				is('attacker', false),
				is('apiToken', 'good')
			),
			because: 'This shows the plain case, so other settings do not get in the way of the answer.',
			sayWhenBlocked: true
		}
	},
	reuse: {
		kind: 'choice',
		label: 'Using a refresh token twice',
		param: 'reuse',
		default: 'keeps',
		summary: 'Whether an old refresh token still works once a new one has come back.',
		why: 'A new refresh token each time looks as if the old one is finished with, and whether it is depends on the server. It decides what someone with a copy can do.',
		sources: [
			{
				source: 'rfc9700',
				section: '2.2.2',
				why: "Section 2.2.2 says a public client's refresh tokens have to work only once, or be tied to the sender."
			}
		],
		requires: {
			when: is('refresh', true),
			because: 'There is no second use until the token runs out and the first has happened.'
		},
		options: [
			{ value: 'keeps', label: 'It keeps working' },
			{ value: 'ends', label: 'It ends the app’s session' }
		]
	},
	sso: {
		kind: 'toggle',
		label: 'A second app',
		param: 'sso',
		default: false,
		summary: 'A second app, the same identity provider, and no password.',
		why: 'The identity provider remembers the browser, not the app. So a second app starts a login exactly as the first did, and everything that was the login is simply not there.',
		sources: [
			{
				source: 'oidc-core',
				why: 'Its prompt parameter, in section 3.1.2.1, is how an app says whether a session is good enough.'
			}
		],
		requires: {
			when: all(
				is('binding', 'bearer'),
				is('broker', false),
				is('attacker', false),
				is('consent', false),
				is('apiToken', 'good'),
				is('refresh', false)
			),
			because: 'This shows the plain case, so other settings do not get in the way of the answer.',
			sayWhenBlocked: true
		}
	},
	ssoAsks: {
		kind: 'choice',
		label: 'What happens at the second app',
		param: 'second',
		default: 'remembered',
		summary: 'Whether the identity provider goes by the session, and what happens with none.',
		why: 'An app can ask for a login even with a session, or ask for none at all. Each is one parameter on the same request, and the answer shows what the session was doing.',
		sources: [
			{
				source: 'oidc-core',
				why: 'Section 3.1.2.1 defines prompt=login and prompt=none, and section 3.1.2.6 the login_required answer.'
			}
		],
		requires: {
			when: is('sso', true),
			because: 'There is no second app until it has been brought on.'
		},
		options: [
			{ value: 'remembered', label: 'The browser is remembered' },
			{
				value: 'insists',
				label: 'The app insists on a login',
				requires: { when: is('oidc', true), because: 'prompt is part of OpenID Connect.' }
			},
			{
				value: 'fresh',
				label: 'A new browser, told not to ask',
				requires: { when: is('oidc', true), because: 'prompt is part of OpenID Connect.' }
			}
		]
	},
	logout: {
		kind: 'toggle',
		label: 'Log out',
		param: 'logout',
		default: false,
		summary: 'The user logs out, and what ends is not everything.',
		why: 'Logging out ends a session. An access token already handed out does not know that, so whether it still works depends on who checks it.',
		sources: [
			{
				source: 'oidc-rp-logout',
				why: 'How an app sends the browser to log out. Section 2 says the server has to ask the user if it gets no ID token. It says nothing about access or refresh tokens.'
			},
			{
				source: 'oidc-backchannel-logout',
				why: 'How the identity provider tells other apps directly. Section 2.7 says refresh tokens from that session should go, and does not mention access tokens.'
			}
		],
		requires: {
			when: all(
				is('oidc', true),
				is('binding', 'bearer'),
				is('broker', false),
				is('attacker', false),
				is('consent', false),
				is('apiToken', 'good'),
				is('refresh', false),
				is('ssoAsks', 'remembered')
			),
			because: 'It is part of OpenID Connect.',
			sayWhenBlocked: true
		}
	},
	appRuns: {
		kind: 'choice',
		label: 'Where the app runs',
		param: 'runs',
		default: 'server',
		onlyOn: 'authorization-code',
		simple: {
			label: 'Where does your app run?',
			summary:
				'In the page, the tokens end up in the browser, and a script running there can get some for itself. With a server behind it, the page never has one.'
		},
		summary:
			'On a server of its own, or in the page in the user’s browser, alone or with a server behind it. In the page alone there is nowhere to keep a secret, and the tokens end up in the browser.',
		why: 'The rest of this flow is careful to keep the tokens away from the browser. An app that runs only in the page is in the browser, so that care stops at its door, and a script running there can get tokens just as the app does.',
		sources: [
			{
				source: 'rfc10017',
				section: '6.3.4.3',
				why: 'Section 6.3.4.3 says an app keeping tokens in the browser is not recommended for business apps, sensitive apps and those handling personal data.'
			}
		],
		options: [
			{ value: 'server', label: 'On a server', sets: { clientType: 'confidential' } },
			{
				value: 'page',
				label: 'In the page',
				sets: { clientType: 'public', pkce: true },
				requires: {
					when: all(
						is('clientType', 'public'),
						is('binding', 'bearer'),
						is('broker', false),
						is('attacker', false),
						is('consent', false),
						is('sso', false),
						is('refresh', false),
						is('logout', false),
						is('apiToken', 'good'),
						is('address', 'registered')
					),
					because: 'Not drawn with these settings yet.'
				}
			},
			{
				value: 'bff',
				label: 'In the page, with its server',
				why: 'The page is still in the browser, and no token reaches it: a server of the app’s own does the login and uses the tokens, and gives the browser a cookie no script can read. So a script in the page has no token to take, though it can still send requests through that server.',
				sets: { clientType: 'confidential', pkce: true },
				requires: {
					when: all(
						is('clientType', 'confidential'),
						is('pkce', true),
						is('oidc', false),
						is('binding', 'bearer'),
						is('broker', false),
						is('federation', false),
						is('attacker', false),
						is('consent', false),
						is('sso', false),
						is('refresh', false),
						is('logout', false),
						is('apiToken', 'good'),
						is('address', 'registered'),
						is('registration', 'manual')
					),
					because: 'Not drawn with these settings yet.'
				}
			}
		]
	},
	oldWay: {
		kind: 'toggle',
		label: 'The app has your password',
		param: 'oldway',
		default: false,
		onlyOn: 'authorization-code',
		notOnOffer: true,
		summary:
			'What came before: the app asks for the password, keeps it, and sends it with every call.',
		why: 'An app that logs in as you has your password, can do anything you can with that account, and gives it up if it is broken into. Most of what is here exists so that it does not have to.',
		sources: [
			{
				source: 'rfc6749',
				section: '1',
				why: 'Section 1 opens with what is wrong with this, and it is why OAuth exists.'
			},
			{
				source: 'rfc7617',
				section: '2',
				why: 'Section 2 is the scheme the call to the API uses here.'
			}
		],
		requires: {
			when: all(
				is('oidc', false),
				is('consent', false),
				is('clientType', 'confidential'),
				is('pkce', false),
				is('attacker', false),
				is('binding', 'bearer'),
				is('broker', false),
				is('apiToken', 'good'),
				is('refresh', false),
				is('sso', false),
				is('logout', false),
				is('address', 'registered'),
				is('appRuns', 'server'),
				is('registration', 'manual')
			),
			because: 'That is about logging in somewhere else, and this is what came before it.'
		}
	},
	address: {
		kind: 'choice',
		label: 'The address the app asks for',
		param: 'address',
		default: 'registered',
		onlyOn: 'authorization-code',
		summary:
			'Where the user should be sent back to, and what happens when that is not an address registered for this app.',
		why: 'The identity provider only sends a code to an address it knows for this app. Otherwise anyone could start a login and ask for the code to be sent to them.',
		sources: [
			{
				source: 'rfc9700',
				section: '2.1',
				why: 'Section 2.1 says a server must compare the address by exact match, because a loose comparison is how codes end up with someone else.'
			}
		],
		options: [
			{ value: 'registered', label: 'One that was registered' },
			{ value: 'other', label: 'One that was not' }
		],
		requires: {
			when: all(
				is('binding', 'bearer'),
				is('broker', false),
				is('attacker', false),
				is('consent', false),
				is('sso', false),
				is('refresh', false),
				is('logout', false),
				is('apiToken', 'good')
			),
			because: 'It stops before any of those would matter.'
		}
	},
	deviceEnds: {
		kind: 'choice',
		label: 'How it ends',
		param: 'ends',
		default: 'agrees',
		onlyOn: 'device',
		summary:
			'Whether the user agrees, says no, or never comes. The app only finds out from the answer the next time it asks.',
		why: 'The app cannot see the other device, so an error on the next call is all it ever gets. These two are ordinary ways for this to end, and an app has to handle them as that.',
		sources: [
			{
				source: 'rfc8628',
				section: '3.5',
				why: 'Section 3.5 lists access_denied and expired_token, and says that any error other than the two that mean carry on means stop asking.'
			}
		],
		options: [
			{ value: 'agrees', label: 'The user agrees' },
			{ value: 'says-no', label: 'The user says no' },
			{ value: 'runs-out', label: 'The codes run out' }
		]
	},
	deviceAttack: {
		kind: 'choice',
		label: 'Someone misusing it',
		param: 'misuse',
		default: 'nobody',
		onlyOn: 'device',
		simple: {
			label: 'Show someone misusing it',
			summary: 'No password gets stolen in either of these. See what they get.'
		},
		summary:
			'Someone starts this on a device of their own and sends the user the code, or reads the user code off a screen and gets there first. No password gets stolen in either.',
		why: 'Nothing in this flow ties the browser to the device. All that joins them is a code a person carries, so all it takes is getting a person to carry the wrong one, or getting there first.',
		sources: [
			{
				source: 'rfc8628',
				section: '5.4',
				why: 'Section 5.4 is someone sending the user their code, and what helps. Section 5.5, right after it, is someone reading it off a screen.'
			}
		],
		options: [
			{ value: 'nobody', label: 'Nobody' },
			{ value: 'sends-code', label: 'They send the user a code of theirs' },
			{
				value: 'reads-code',
				label: 'They read the user code off the screen',
				requires: {
					when: is('deviceEnds', 'agrees'),
					because: 'They are the one who agrees here, so it cannot end any other way.'
				}
			}
		]
	}
};

export const settingIds = Object.keys(settingDefs) as SettingId[];

/** What the first flow has: all but what belongs to another one. */
export const codeFlowSettingIds = settingIds.filter((id) => {
	const def: SettingDef = settingDefs[id];
	return !def.onlyOn || def.onlyOn === 'authorization-code';
});

/** The few that simple mode offers. The rest stay on as chips if someone turned them on (ADR-004). */
export const simpleSettingIds = settingIds.filter((id) => settingDefs[id].simple);

export const defaultSettings = Object.fromEntries(
	settingIds.map((id) => [id, settingDefs[id].default])
) as unknown as Settings;

function optionOf(id: SettingId, value: unknown): OptionDef | undefined {
	const def: SettingDef = settingDefs[id];
	return def.kind === 'choice' ? def.options.find((option) => option.value === value) : undefined;
}

/** Every Keycloak flag the settings name, which is what the recorder asks a real server about. */
export function flagsInSettings(): KeycloakFlag[] {
	return settingIds.flatMap((id) => {
		const def: SettingDef = settingDefs[id];
		return def.kind === 'choice' ? def.options.flatMap((option) => option.flag ?? []) : [];
	});
}

/** Why this setting could not take this value right now, or null when it can. */
export function unavailable<K extends SettingId>(
	id: K,
	value: Settings[K],
	settings: Settings
): Requirement | null {
	if (value === settingDefs[id].default) return null;
	const requirements = [settingDefs[id].requires, optionOf(id, value)?.requires];
	return requirements.find((r) => r && !holds(r.when, settings)) ?? null;
}

export function isOffered(id: SettingId, settings: Settings): boolean {
	const requires = settingDefs[id].requires;
	return !requires || requires.sayWhenBlocked === true || holds(requires.when, settings);
}

export interface Reset {
	setting: SettingId;
	because: string;
}

/** Settings fall back to their default when what they need no longer holds, until nothing changes. */
export function normalize(settings: Settings): { settings: Settings; resets: Reset[] } {
	const next = { ...settings };
	const resets: Reset[] = [];
	let changed = true;
	while (changed) {
		changed = false;
		for (const id of settingIds) {
			const failed = unavailable(id, next[id], next);
			if (failed) {
				Object.assign(next, { [id]: settingDefs[id].default });
				resets.push({ setting: id, because: failed.because });
				changed = true;
			}
		}
	}
	return { settings: next, resets };
}

/** Why this is here, which an option can say for itself. */
export function whyItIsHere(id: SettingId, value: unknown): string {
	return optionOf(id, value)?.why ?? settingDefs[id].why;
}

/** What choosing this brings with it, because someone who knows where their app runs should not also have to know these. */
export function setsWith<K extends SettingId>(id: K, value: Settings[K]): Partial<Settings> {
	const def: SettingDef = settingDefs[id];
	if (def.kind === 'toggle') return value === true ? (def.setsWhenOn ?? {}) : {};
	return optionOf(id, value)?.sets ?? {};
}

export function change<K extends SettingId>(settings: Settings, id: K, value: Settings[K]) {
	return normalize({ ...settings, ...setsWith(id, value), [id]: value });
}

function valuesOf(id: SettingId): readonly (boolean | string)[] {
	const def: SettingDef = settingDefs[id];
	return def.kind === 'toggle' ? [false, true] : def.options.map((option) => option.value);
}

/**
 * Every combination that is valid, by walking from one to another one change at a time. Trying every
 * possible one multiplied with each setting, into millions of objects to find a few hundred, which took
 * most of the time the unit tests took. A setting a change away from nothing valid would never be found,
 * so a test counts them.
 */
function validCombinations(ids: readonly SettingId[]): Settings[] {
	const keyOf = (settings: Settings) => ids.map((id) => settings[id]).join();
	const found = new Map([[keyOf(defaultSettings), defaultSettings]]);
	for (const settings of found.values()) {
		for (const id of ids) {
			for (const value of valuesOf(id)) {
				const next = { ...settings, [id]: value };
				const key = keyOf(next);
				if (!found.has(key) && normalize(next).resets.length === 0) found.set(key, next);
			}
		}
	}
	return [...found.values()];
}

let everyValid: readonly Readonly<Settings>[] | undefined;

/**
 * Every combination of these settings that makes sense, with the rest on their defaults. The ones to
 * try at least double with each setting, so the list for all of them is worked out once, and shared.
 */
export function allValidSettings(
	ids: readonly SettingId[] = codeFlowSettingIds
): readonly Readonly<Settings>[] {
	if (ids !== codeFlowSettingIds) return validCombinations(ids);
	everyValid ??= Object.freeze(validCombinations(ids).map((settings) => Object.freeze(settings)));
	return everyValid;
}
