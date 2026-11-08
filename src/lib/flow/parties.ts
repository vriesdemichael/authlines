import type { KnownAs, LifelineDef } from '#lib/flow/model.ts';
import { is } from '#lib/flow/settings.ts';
import { NAMED_BY_OAUTH, NAMED_BY_OIDC } from '#lib/sources/sources.ts';

/**
 * What the specs call each party, wherever a diagram has it, with what it is in plain words under
 * that. RFC 6749 section 1.1 and OpenID Connect Core section 1.2, read on 2026-11-02.
 */
type Words = Pick<LifelineDef, 'name' | 'role' | 'knownAs'>;

const oidc = is('oidc', true);
const broker = is('broker', true);

const asAClient: readonly KnownAs[] = [
	{ word: 'client', by: 'OAuth', source: NAMED_BY_OAUTH },
	{ word: 'relying party', by: 'OpenID Connect', source: NAMED_BY_OIDC }
];

export const browserWords: Words = {
	name: 'User agent',
	role: 'User’s browser',
	knownAs: [
		// OAuth does not list it as a role, and says it from here on.
		{ word: 'user agent', by: 'OAuth', source: { ...NAMED_BY_OAUTH, section: '1.3.1' } },
		{ word: 'user agent', by: 'OpenID Connect', source: NAMED_BY_OIDC }
	]
};

export const appWords: Words = {
	name: [{ when: oidc, text: 'Relying party' }, { text: 'Client' }],
	role: [{ when: oidc, text: 'Client' }, { text: 'App' }],
	knownAs: asAClient
};

export const secondAppWords: Words = {
	name: [{ when: oidc, text: 'Second relying party' }, { text: 'Second client' }],
	role: [{ when: oidc, text: 'Second client' }, { text: 'Second app' }],
	knownAs: asAClient
};

export const idpWords: Words = {
	name: [{ when: oidc, text: 'OpenID provider' }, { text: 'Authorization server' }],
	role: [
		{ when: broker, text: 'And a broker' },
		{ when: oidc, text: 'Authorization server' },
		{ text: 'Identity provider' }
	],
	knownAs: [
		{ word: 'authorization server', by: 'OAuth', source: NAMED_BY_OAUTH },
		{ word: 'OpenID provider', by: 'OpenID Connect', source: NAMED_BY_OIDC }
	]
};

export const directoryWords: Words = {
	name: 'Directory',
	role: 'LDAP',
	knownAs: []
};

/** Kerberos calls it the client, a word this site already gives the app, so it keeps its own name. */
export const computerWords: Words = {
	name: 'Kerberos client',
	role: 'User’s computer',
	knownAs: [
		{
			word: 'client',
			by: 'Kerberos',
			source: {
				source: 'rfc4120',
				why: 'Section 1.7 defines a client as a process that uses a network service on behalf of a user.'
			}
		}
	]
};

export const kdcWords: Words = {
	name: 'KDC',
	role: 'Key distribution center',
	knownAs: [
		{
			word: 'key distribution center',
			by: 'Kerberos',
			source: {
				source: 'rfc4120',
				why: 'Section 1.7 defines the KDC, the key distribution center: a service that hands out tickets, and session keys to use them with.'
			}
		},
		{
			word: 'domain controller',
			by: 'Windows',
			source: {
				source: 'windows-kerberos',
				why: 'In Windows Server the KDC runs on every domain controller.'
			}
		}
	]
};

export const upstreamWords: Words = {
	name: 'Upstream provider',
	role: 'Other provider',
	knownAs: [
		{ word: 'authorization server', by: 'OAuth', source: NAMED_BY_OAUTH },
		{ word: 'OpenID provider', by: 'OpenID Connect', source: NAMED_BY_OIDC }
	]
};

const asAResourceServer: readonly KnownAs[] = [
	{ word: 'resource server', by: 'OAuth', source: NAMED_BY_OAUTH },
	{ word: 'resource server', by: 'OpenID Connect', source: NAMED_BY_OIDC }
];

export const apiWords: Words = {
	name: 'Resource server',
	role: 'API',
	knownAs: asAResourceServer
};

export const secondApiWords: Words = {
	name: 'Second resource server',
	role: 'Second API',
	knownAs: asAResourceServer
};
