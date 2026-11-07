import type { KnownAs } from '#lib/flow/model.ts';
import { NAMED_BY_KEYCLOAK } from '#lib/sources/sources.ts';

/** What one server calls things, kept out of the flow so that the flow stays neutral (ADR-015). */
interface InKeycloak {
	name: string;
	role: string;
	/** The word for it, where it has one of its own, and who says so. */
	word?: string;
	by?: string;
}

/**
 * What its docs and console call each party, read on Keycloak 26.8.1. It has no word for the browser
 * or for an API, so those stay as they are in plain words.
 */
const names: Readonly<Record<string, InKeycloak>> = {
	browser: { name: 'User’s browser', role: 'Where the user is' },
	app: { name: 'Client', role: 'App', word: 'client' },
	'second-app': { name: 'Second client', role: 'Second app', word: 'client' },
	idp: { name: 'Keycloak', role: 'One realm in it', word: 'realm' },
	// Its console has a page of these. Keycloak itself is one as well, its docs say.
	upstream: {
		name: 'Identity provider',
		role: 'External',
		word: 'identity provider',
		by: 'Keycloak’s console'
	},
	api: { name: 'API', role: 'Has the data' },
	'second-api': { name: 'Second API', role: 'The API calls it' },
	'idp-admin': { name: 'Realm admin', role: 'People' }
};

export const keycloakName = (id: string): InKeycloak | undefined => names[id];

export function keycloakKnownAs(id: string): readonly KnownAs[] {
	const { word, by = 'Keycloak' } = names[id] ?? {};
	return word ? [{ word, by, source: NAMED_BY_KEYCLOAK }] : [];
}

/**
 * Its docs say Keycloak is an identity provider, and users log in to a realm. Its console keeps
 * "identity provider" for the ones it can hand off to, so a bare one stays what it says.
 */
export const KEYCLOAK_PHRASES: Readonly<Record<string, string>> = {
	'the same identity provider': 'the same realm',
	'this identity provider': 'this realm',
	'the identity provider': 'Keycloak',
	'the IdP': 'Keycloak',
	'the other provider': 'the external identity provider'
};

/**
 * What its admin console calls what a realm holds, read on Keycloak 26.8.1: the menu names, and
 * Keys under Realm settings. Used only where someone asked for Keycloak's words (ADR-015).
 */
export const realmHolds = {
	apps: 'Clients',
	accounts: 'Users',
	providers: 'Identity providers',
	directories: 'User federation',
	customers: 'Organizations',
	keys: 'Keys'
} as const;
