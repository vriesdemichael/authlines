// A throwaway Keycloak in a container, set up the way someone would through its admin API. Nothing
// here is a real credential: the realms, users and secrets exist only for this run.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type { Settings } from '#lib/flow/settings.ts';
import {
	APP,
	CLIENT_SECRET,
	CONFIDENTIAL_CLIENT,
	demoClient as client,
	demoUser as user,
	KEYCLOAK,
	KEYCLOAK_PORT,
	LOCAL_REALM,
	PASSWORD,
	REDIRECT_URI,
	USERNAME,
	withSecret as confidential
} from '#lib/recordings/run-yourself.ts';

export {
	APP,
	CLIENT_SECRET,
	CONFIDENTIAL_CLIENT,
	KEYCLOAK,
	KEYCLOAK_PORT,
	LOCAL_REALM,
	PASSWORD,
	REDIRECT_URI,
	USERNAME
};
export const API = 'http://localhost:9101';
export const PROXY_PORT = 9102;
export const PROXY_FROM_CONTAINER = `http://host.docker.internal:${PROXY_PORT}`;

export const BROKERED_REALM = 'demo-brokered';
export const UPSTREAM_REALM = 'upstream';
export const PUBLIC_CLIENT = 'demo-public';
export const PKCE_CLIENT = 'demo-public-pkce';
export const BROKER_CLIENT = 'demo-broker';
export const BROKER_SECRET = 'throwaway-broker-secret';
export const SECOND_APP = 'http://localhost:9103';
/** A program on the user's computer, which listens here on a port the computer picks (#178). */
export const LOOPBACK = 'http://127.0.0.1';
export const LOOPBACK_REDIRECT_URI = `${LOOPBACK}/callback`;
export const SECOND_CLIENT = 'demo-app-two';
/** An app with no user, which is what the client credentials flow is. */
export const SERVICE_CLIENT = 'demo-service';
/** An app on a device, with no secret, which is what the device flow is for. */
export const DEVICE_CLIENT = 'demo-device';
/** What turns the flow on for one client. It is off on a new one (questions.json). */
export const DEVICE_GRANT_ON = { 'oauth2.device.authorization.grant.enabled': 'true' };
/** The same, with codes that do not last, so that a run can get to them running out. */
export const QUICK_DEVICE_CLIENT = 'demo-device-quick';
export const SOMEONE_ELSE = 'someone-else';
export const SECOND_REDIRECT_URI = `${SECOND_APP}/callback`;
/** Someone else's site, which a login link of theirs asks for the code to be sent to. */
export const ATTACKER_SITE = 'http://localhost:9104';
export const ATTACKER_REDIRECT_URI = `${ATTACKER_SITE}/catch`;
export const BACKCHANNEL_URL = 'http://host.docker.internal:9103/backchannel';
export const API_CLIENT = 'demo-api';
export const POST_LOGOUT_URI = `${APP}/bye`;
/** The API the first one calls for the user, which a token for the first API should not get into. */
export const SECOND_API = 'http://localhost:9105';
export const SECOND_API_CLIENT = 'demo-api-two';
/** What the first API's client gets, so that the server will issue it a token for the second. */
export const NAMES_THE_SECOND_API = 'names-the-second-api';
/** Off on a new client. It turns on token exchange for that client, as the one that asks. */
export const EXCHANGE_ON = { 'standard.token.exchange.enabled': 'true' };
/** Not set on a new client. Set, a trade may give a refresh token, tied to the user's session (#185). */
export const TRADE_REFRESH = 'standard.token.exchange.enableRefreshRequestedTokenType';
export const TRADE_REFRESH_ON = 'SAME_SESSION';

/** So that the API is named in the token, which it has to be before the server will discuss it. */
export const namesTheApi = {
	name: 'names-the-api',
	protocol: 'openid-connect',
	protocolMapper: 'oidc-audience-mapper',
	config: {
		'included.client.audience': API_CLIENT,
		'access.token.claim': 'true',
		'id.token.claim': 'false'
	}
};
// A default client's access token names this and nothing else, and the recordings use one (ADR-005).
// A real API expects its own name, which takes the Audience mapper, as the note on that step says.
export const API_AUDIENCE = 'account';

/** A group the user is in at the other provider, and the role it becomes here (#183). */
export const UPSTREAM_GROUP = 'sales';
export const ROLE_FROM_GROUP = 'reads-orders';
/** A role nobody lets the app with no user give, beside the one it may (#183). */
export const ANOTHER_ROLE = 'manages-orders';
const GROUPS_MAPPER = 'groups';
const GROUP_TO_ROLE = 'sales-reads-orders';

const CONTAINER = 'authlines-keycloak';
export const ADMIN_PASSWORD = 'throwaway-admin';
export const DIRECTORY_REALM = 'in-a-directory';

const docker = (...args: string[]) =>
	execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

export function stopKeycloak() {
	try {
		docker('rm', '--force', CONTAINER);
	} catch {
		// It was not running.
	}
}

export async function startKeycloak(version: string, features: readonly string[]) {
	stopKeycloak();
	docker(
		'run',
		'--detach',
		'--name',
		CONTAINER,
		'--publish',
		`${KEYCLOAK_PORT}:8080`,
		'--add-host=host.docker.internal:host-gateway',
		'--env',
		'KC_BOOTSTRAP_ADMIN_USERNAME=admin',
		'--env',
		`KC_BOOTSTRAP_ADMIN_PASSWORD=${ADMIN_PASSWORD}`,
		`quay.io/keycloak/keycloak:${version}`,
		'start-dev',
		...(features.length ? [`--features=${features.join(',')}`] : [])
	);
	for (let i = 0; i < 90; i++) {
		try {
			if ((await fetch(`${KEYCLOAK}/realms/master`)).ok) return;
		} catch {
			// Not up yet.
		}
		await new Promise((resolve) => setTimeout(resolve, 2000));
	}
	throw new Error(`Keycloak did not start:\n${docker('logs', '--tail', '40', CONTAINER)}`);
}

const form = (values: Record<string, string>) => new URLSearchParams(values).toString();

export class Admin {
	#token = '';

	static async connect() {
		const admin = new Admin();
		await admin.#logIn();
		return admin;
	}

	async #logIn() {
		const response = await fetch(`${KEYCLOAK}/realms/master/protocol/openid-connect/token`, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: form({
				grant_type: 'password',
				client_id: 'admin-cli',
				username: 'admin',
				password: ADMIN_PASSWORD
			})
		});
		if (!response.ok) throw new Error(`Admin login failed: ${response.status}`);
		this.#token = ((await response.json()) as { access_token: string }).access_token;
	}

	async call<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
		const send = () =>
			fetch(`${KEYCLOAK}/admin${path}`, {
				method,
				headers: {
					authorization: `Bearer ${this.#token}`,
					'content-type': 'application/json'
				},
				body: body === undefined ? undefined : JSON.stringify(body)
			});
		let response = await send();
		// An admin token lasts a minute, and a whole run takes longer than that.
		if (response.status === 401) {
			await this.#logIn();
			response = await send();
		}
		if (!response.ok) {
			throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);
		}
		const text = await response.text();
		return (text ? JSON.parse(text) : undefined) as T;
	}

	/** Makes something and says where it is, which is all a 201 gives back. */
	async created(method: string, path: string, body: unknown): Promise<string> {
		const send = () =>
			fetch(`${KEYCLOAK}/admin${path}`, {
				method,
				headers: { authorization: `Bearer ${this.#token}`, 'content-type': 'application/json' },
				body: JSON.stringify(body)
			});
		let response = await send();
		if (response.status === 401) {
			await this.#logIn();
			response = await send();
		}
		const location = response.headers.get('location');
		if (!response.ok || !location) {
			throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);
		}
		return location;
	}

	async serverVersion() {
		const info = await this.call<{ systemInfo: { version: string } }>('GET', '/serverinfo');
		return info.systemInfo.version;
	}

	/** Removes the user a brokered login creates, so every run starts from a first login. */
	async forgetBrokeredUsers() {
		const users = await this.call<{ id: string }[]>('GET', `/realms/${BROKERED_REALM}/users`);
		for (const user of users) {
			await this.call('DELETE', `/realms/${BROKERED_REALM}/users/${user.id}`);
		}
	}

	async setClientAttributes(realm: string, clientId: string, attributes: Record<string, string>) {
		const [client] = await this.call<{ id: string; attributes?: Record<string, string> }[]>(
			'GET',
			`/realms/${realm}/clients?clientId=${clientId}`
		);
		await this.call('PUT', `/realms/${realm}/clients/${client.id}`, {
			...client,
			attributes: { ...client.attributes, ...attributes }
		});
	}
}

const STORAGE_PROVIDER = 'org.keycloak.storage.UserStorageProvider';

const providerOfTheDirectory = async (admin: Admin) =>
	(
		await admin.call<{ id: string }[]>(
			'GET',
			`/realms/${DIRECTORY_REALM}/components?type=${STORAGE_PROVIDER}`
		)
	)[0]?.id;

/** Its users are only in the directory, so that what logs in is really coming from there. */
export async function connectDirectory(
	admin: Admin,
	url: string,
	usersDn: string,
	bindDn: string,
	bindCredential: string
) {
	const already = await providerOfTheDirectory(admin);
	if (already) return already;
	const { id } = await admin.call<{ id: string }>('GET', `/realms/${DIRECTORY_REALM}`);
	await admin.call('POST', `/realms/${DIRECTORY_REALM}/components`, {
		name: 'directory',
		providerId: 'ldap',
		providerType: STORAGE_PROVIDER,
		parentId: id,
		config: {
			enabled: ['true'],
			vendor: ['other'],
			connectionUrl: [url],
			usersDn: [usersDn],
			bindDn: [bindDn],
			bindCredential: [bindCredential],
			authType: ['simple'],
			usernameLDAPAttribute: ['uid'],
			rdnLDAPAttribute: ['cn'],
			uuidLDAPAttribute: ['entryUUID'],
			userObjectClasses: ['inetOrgPerson'],
			editMode: ['READ_ONLY'],
			importEnabled: ['true'],
			syncRegistrations: ['false'],
			batchSizeForSync: ['1000'],
			pagination: ['false']
		}
	});
	const provider = await providerOfTheDirectory(admin);
	if (!provider) throw new Error('The directory did not connect.');
	return provider;
}

/** Where the identity provider keeps the key it opens tickets with, in its own container. */
const KEYTAB_IN_THE_CONTAINER = '/opt/keycloak/data/service.keytab';

/**
 * The directory's users may also log in with a Kerberos ticket, which the identity provider opens with
 * a key of its own from the KDC, a keytab. Off again, the login page is as it was.
 */
export async function kerberosOn(
	admin: Admin,
	on: { keytab: Buffer; realm: string; principal: string } | null
) {
	const id = await providerOfTheDirectory(admin);
	if (!id) throw new Error('There is no directory to log in to with a ticket.');
	if (on) {
		const file = `${tmpdir()}/authlines-service.keytab`;
		writeFileSync(file, on.keytab);
		docker('cp', file, `${CONTAINER}:${KEYTAB_IN_THE_CONTAINER}`);
		docker('exec', '-u', '0', CONTAINER, 'chmod', '644', KEYTAB_IN_THE_CONTAINER);
	}
	const path = `/realms/${DIRECTORY_REALM}/components/${id}`;
	const component = await admin.call<{ config: Record<string, string[]> }>('GET', path);
	component.config = {
		...component.config,
		allowKerberosAuthentication: [on ? 'true' : 'false'],
		...(on
			? {
					kerberosRealm: [on.realm],
					serverPrincipal: [on.principal],
					keyTab: [KEYTAB_IN_THE_CONTAINER],
					useKerberosForPasswordAuthentication: ['false'],
					// By default it looks for krb5PrincipalName, which these people do not have, and
					// shows the login page. Empty, it looks them up by the name before the @.
					krbPrincipalAttribute: [''],
					// So that a run that goes wrong says why, in the identity provider's log.
					debug: ['true']
				}
			: {})
	};
	await admin.call('PUT', path, component);
	// Allowing it turns the Kerberos step of the browser flow on, and turning it off turns it off.
	const steps = await admin.call<{ displayName: string; requirement: string }[]>(
		'GET',
		`/realms/${DIRECTORY_REALM}/authentication/flows/browser/executions`
	);
	const kerberos = steps.find(({ displayName }) => displayName === 'Kerberos')?.requirement;
	if (kerberos !== (on ? 'ALTERNATIVE' : 'DISABLED')) {
		throw new Error(`The browser flow's Kerberos step is ${kerberos}`);
	}
}

export async function setUpRealms(admin: Admin) {
	for (const realm of [LOCAL_REALM, BROKERED_REALM, UPSTREAM_REALM, DIRECTORY_REALM]) {
		await admin.call('POST', '/realms', { realm, enabled: true });
	}

	await admin.call('POST', `/realms/${LOCAL_REALM}/users`, user);
	// Someone with an account of their own, for what they can do with it.
	await admin.call('POST', `/realms/${LOCAL_REALM}/users`, {
		...user,
		username: SOMEONE_ELSE,
		email: `${SOMEONE_ELSE}@example.com`
	});
	await admin.call('POST', `/realms/${LOCAL_REALM}/clients`, {
		...client(SECOND_CLIENT, confidential),
		redirectUris: [SECOND_REDIRECT_URI],
		attributes: { 'backchannel.logout.url': BACKCHANNEL_URL }
	});
	await admin.call('POST', `/realms/${LOCAL_REALM}/clients`, {
		...client(API_CLIENT, confidential),
		standardFlowEnabled: false
	});
	// Only a name to put in a token: it never logs anyone in or asks for anything itself.
	await admin.call('POST', `/realms/${LOCAL_REALM}/clients`, {
		...client(SECOND_API_CLIENT, confidential),
		standardFlowEnabled: false
	});
	await namesTheSecondApiIn(admin, LOCAL_REALM);
	await admin.call('POST', `/realms/${LOCAL_REALM}/clients`, {
		...client(SERVICE_CLIENT, confidential),
		standardFlowEnabled: false,
		serviceAccountsEnabled: true
	});
	await admin.call('POST', `/realms/${LOCAL_REALM}/clients`, {
		...client(DEVICE_CLIENT, { publicClient: true }),
		standardFlowEnabled: false,
		attributes: DEVICE_GRANT_ON
	});
	await admin.call('POST', `/realms/${LOCAL_REALM}/clients`, {
		...client(QUICK_DEVICE_CLIENT, { publicClient: true }),
		standardFlowEnabled: false,
		attributes: { ...DEVICE_GRANT_ON, 'oauth2.device.code.lifespan': '2' }
	});
	await admin.call(
		'POST',
		`/realms/${LOCAL_REALM}/clients`,
		client(PUBLIC_CLIENT, { publicClient: true })
	);
	await admin.call(
		'POST',
		`/realms/${LOCAL_REALM}/clients`,
		client(PKCE_CLIENT, {
			publicClient: true,
			attributes: { 'pkce.code.challenge.method': 'S256' }
		})
	);

	// Roles the app with no user may give, or may not, which nobody has until it gives one (#183).
	for (const name of [ROLE_FROM_GROUP, ANOTHER_ROLE]) {
		await admin.call('POST', `/realms/${LOCAL_REALM}/roles`, { name });
	}
	await admin.call('POST', `/realms/${UPSTREAM_REALM}/users`, user);
	const group = await admin.created('POST', `/realms/${UPSTREAM_REALM}/groups`, {
		name: UPSTREAM_GROUP
	});
	const [them] = await admin.call<{ id: string }[]>(
		'GET',
		`/realms/${UPSTREAM_REALM}/users?username=${USERNAME}&exact=true`
	);
	await admin.call(
		'PUT',
		`/realms/${UPSTREAM_REALM}/users/${them.id}/groups/${group.split('/').at(-1)}`
	);
	await admin.call('POST', `/realms/${BROKERED_REALM}/roles`, {
		name: ROLE_FROM_GROUP,
		description: `Given to everyone in ${UPSTREAM_GROUP} at the other provider`
	});
	await admin.call('POST', `/realms/${UPSTREAM_REALM}/clients`, {
		clientId: BROKER_CLIENT,
		enabled: true,
		standardFlowEnabled: true,
		publicClient: false,
		clientAuthenticatorType: 'client-secret',
		secret: BROKER_SECRET,
		redirectUris: [
			`${KEYCLOAK}/realms/${BROKERED_REALM}/broker/${UPSTREAM_REALM}/endpoint`,
			// Where a user who logs in with a password links an account there (#179).
			`${KEYCLOAK}/realms/${LOCAL_REALM}/broker/${UPSTREAM_REALM}/endpoint`
		]
	});

	// The calls Keycloak makes to the upstream go through the proxy, so they can be recorded too.
	const upstream = `realms/${UPSTREAM_REALM}/protocol/openid-connect`;
	await admin.call('POST', `/realms/${BROKERED_REALM}/identity-provider/instances`, {
		alias: UPSTREAM_REALM,
		providerId: 'oidc',
		enabled: true,
		trustEmail: true,
		config: {
			authorizationUrl: `${KEYCLOAK}/${upstream}/auth`,
			tokenUrl: `${PROXY_FROM_CONTAINER}/${upstream}/token`,
			userInfoUrl: `${PROXY_FROM_CONTAINER}/${upstream}/userinfo`,
			jwksUrl: `${PROXY_FROM_CONTAINER}/${upstream}/certs`,
			useJwksUrl: 'true',
			validateSignature: 'true',
			issuer: `${KEYCLOAK}/realms/${UPSTREAM_REALM}`,
			clientId: BROKER_CLIENT,
			clientSecret: BROKER_SECRET,
			clientAuthMethod: 'client_secret_post',
			defaultScope: 'openid',
			syncMode: 'IMPORT'
		}
	});

	// Sends everyone straight to the upstream, so the app really does not notice (see the setting).
	const executions = await admin.call<{ id: string; providerId?: string }[]>(
		'GET',
		`/realms/${BROKERED_REALM}/authentication/flows/browser/executions`
	);
	const redirector = executions.find((e) => e.providerId === 'identity-provider-redirector');
	if (!redirector) throw new Error('No identity provider redirector in the browser flow');
	await admin.call(
		'POST',
		`/realms/${BROKERED_REALM}/authentication/executions/${redirector.id}/config`,
		{ alias: 'straight-to-upstream', config: { defaultProvider: UPSTREAM_REALM } }
	);

	// A second app, a second API and what names it, so that these can be drawn with another provider
	// too (#186). The first API is made new for each run, below.
	await admin.call('POST', `/realms/${BROKERED_REALM}/clients`, {
		...client(SECOND_CLIENT, confidential),
		redirectUris: [SECOND_REDIRECT_URI]
	});
	await admin.call('POST', `/realms/${BROKERED_REALM}/clients`, {
		...client(SECOND_API_CLIENT, confidential),
		standardFlowEnabled: false
	});
	await namesTheSecondApiIn(admin, BROKERED_REALM);

	await setUpFor(admin, LOCAL_REALM, defaultsForQuestions);
	await setUpFor(admin, BROKERED_REALM, defaultsForQuestions);
}

/**
 * The other provider says which groups the user is in, in its ID token, and a mapper here turns one
 * of them into a role (#183). Both are taken off again for every other run.
 */
async function groupsBecomeRoles(admin: Admin, onProvider: string, on: boolean) {
	const [broker] = await admin.call<{ id: string }[]>(
		'GET',
		`/realms/${UPSTREAM_REALM}/clients?clientId=${BROKER_CLIENT}`
	);
	const onBroker = `/realms/${UPSTREAM_REALM}/clients/${broker.id}/protocol-mappers/models`;
	for (const mapper of await admin.call<{ id: string; name: string }[]>('GET', onBroker)) {
		if (mapper.name === GROUPS_MAPPER) await admin.call('DELETE', `${onBroker}/${mapper.id}`);
	}
	for (const mapper of await admin.call<{ id: string; name: string }[]>(
		'GET',
		`${onProvider}/mappers`
	)) {
		if (mapper.name === GROUP_TO_ROLE)
			await admin.call('DELETE', `${onProvider}/mappers/${mapper.id}`);
	}
	if (!on) return;
	await admin.call('POST', onBroker, {
		name: GROUPS_MAPPER,
		protocol: 'openid-connect',
		protocolMapper: 'oidc-group-membership-mapper',
		config: {
			'claim.name': 'groups',
			'full.path': 'false',
			'id.token.claim': 'true',
			'access.token.claim': 'false',
			'userinfo.token.claim': 'false'
		}
	});
	await admin.call('POST', `${onProvider}/mappers`, {
		name: GROUP_TO_ROLE,
		identityProviderAlias: UPSTREAM_REALM,
		identityProviderMapper: 'oidc-role-idp-mapper',
		config: {
			claim: 'groups',
			'claim.value': UPSTREAM_GROUP,
			role: ROLE_FROM_GROUP,
			syncMode: 'INHERIT'
		}
	});
}

/**
 * Gives the realm a new key to sign with, above the one it was made with, which stays listed. Or
 * takes it away again, so that no other recording changes (2026-11-08).
 */
export async function newSigningKey(admin: Admin, realm: string, on: boolean) {
	const KEY_PROVIDER = 'org.keycloak.keys.KeyProvider';
	const NAME = 'a-newer-key';
	for (const component of await admin.call<{ id: string; name: string }[]>(
		'GET',
		`/realms/${realm}/components?type=${KEY_PROVIDER}`
	)) {
		if (component.name === NAME)
			await admin.call('DELETE', `/realms/${realm}/components/${component.id}`);
	}
	if (!on) return;
	const { id } = await admin.call<{ id: string }>('GET', `/realms/${realm}`);
	await admin.call('POST', `/realms/${realm}/components`, {
		name: NAME,
		providerId: 'rsa-generated',
		providerType: KEY_PROVIDER,
		parentId: id,
		config: {
			priority: ['200'],
			keySize: ['2048'],
			active: ['true'],
			enabled: ['true'],
			algorithm: ['RS256']
		}
	});
}

/**
 * Lets the app with no user look users up and give them one role, and nothing else, with the realm's
 * admin permissions (#183). Turned off again after, with the role it gave taken back, so that no other
 * recording has it.
 */
export async function letTheServiceGiveOneRole(
	admin: Admin,
	on: boolean
): Promise<{ allowed: object; other: object } | null> {
	const realmPath = `/realms/${LOCAL_REALM}`;
	const realm = await admin.call<object>('GET', realmPath);
	if (!on) {
		const [them] = await admin.call<{ id: string }[]>(
			'GET',
			`${realmPath}/users?username=${USERNAME}&exact=true`
		);
		const given = await admin.call<{ name: string }[]>(
			'GET',
			`${realmPath}/users/${them.id}/role-mappings/realm`
		);
		const back = given.filter((role) => [ROLE_FROM_GROUP, ANOTHER_ROLE].includes(role.name));
		if (back.length) {
			await admin.call('DELETE', `${realmPath}/users/${them.id}/role-mappings/realm`, back);
		}
		await admin.call('PUT', realmPath, { ...realm, adminPermissionsEnabled: false });
		return null;
	}
	await admin.call('PUT', realmPath, { ...realm, adminPermissionsEnabled: true });
	const [permissions] = await admin.call<{ id: string }[]>(
		'GET',
		`${realmPath}/clients?clientId=admin-permissions`
	);
	const [service] = await admin.call<{ id: string }[]>(
		'GET',
		`${realmPath}/clients?clientId=${SERVICE_CLIENT}`
	);
	const server = `${realmPath}/clients/${permissions.id}/authz/resource-server`;
	const policy = await admin.call<{ id: string }>('POST', `${server}/policy/client`, {
		name: 'the-app-with-no-user',
		clients: [service.id],
		logic: 'POSITIVE'
	});
	const role = await admin.call<{ id: string }>('GET', `${realmPath}/roles/${ROLE_FROM_GROUP}`);
	for (const [name, resourceType, scopes, resources] of [
		['look-up-and-map-users', 'Users', ['view', 'map-roles'], []],
		['give-reads-orders', 'Roles', ['map-role'], [role.id]]
	] as const) {
		await admin.call('POST', `${server}/permission/scope`, {
			name,
			resourceType,
			scopes,
			resources,
			policies: [policy.id],
			decisionStrategy: 'UNANIMOUS'
		});
	}
	// The app may not read roles, so an admin hands it the one it gives, as the admin API names it.
	return {
		allowed: role,
		other: await admin.call<object>('GET', `${realmPath}/roles/${ANOTHER_ROLE}`)
	};
}

/** A scope that puts the second API in a token's audience, for a client that trades for it. */
async function namesTheSecondApiIn(admin: Admin, realm: string) {
	await admin.call('POST', `/realms/${realm}/client-scopes`, {
		name: NAMES_THE_SECOND_API,
		protocol: 'openid-connect',
		attributes: { 'include.in.token.scope': 'false', 'display.on.consent.screen': 'false' },
		protocolMappers: [
			{
				name: 'audience of the second API',
				protocol: 'openid-connect',
				protocolMapper: 'oidc-audience-mapper',
				config: {
					'included.client.audience': SECOND_API_CLIENT,
					'access.token.claim': 'true',
					'id.token.claim': 'false'
				}
			}
		]
	});
}

/** What the questions start from: an app with a secret, and stored tokens it can read. */
const defaultsForQuestions: Pick<Settings, 'clientType' | 'consent' | 'upstreamTokens'> = {
	clientType: 'confidential',
	consent: false,
	upstreamTokens: 'v1'
};

/**
 * The client a run uses, made new, and the provider set the way these settings say. So nothing
 * carries over from another run, such as an answer to the consent question, and a setting that is
 * off really is off, on a client and a provider that are otherwise on their defaults (ADR-005).
 */
/** What an admin creates and hands to a team, so that their app can register itself, once. */
export async function makeInitialAccessToken(admin: Admin, realm: string) {
	const { token } = await admin.call<{ token: string }>(
		'POST',
		`/realms/${realm}/clients-initial-access`,
		{ count: 1, expiration: 600 }
	);
	return token;
}

/**
 * The flag alone does nothing: it takes a client policy too. Plain HTTP is turned on only because the
 * demo app has no certificate, and the screen says a real one has to be HTTPS.
 */
export async function allowClientDocuments(admin: Admin, realm: string) {
	await admin.call('PUT', `/realms/${realm}/client-policies/profiles`, {
		profiles: [
			{
				name: 'client-documents',
				description: 'Apps may point at a document about themselves',
				executors: [
					{
						executor: 'client-id-metadata-document',
						configuration: {
							'cimd-allow-http-scheme': 'true',
							'cimd-allow-permitted-domains': ['host.docker.internal', 'localhost']
						}
					}
				]
			}
		]
	});
	await admin.call('PUT', `/realms/${realm}/client-policies/policies`, {
		policies: [
			{
				name: 'client-documents',
				description: 'Apps may point at a document about themselves',
				enabled: true,
				conditions: [{ condition: 'any-client', configuration: {} }],
				profiles: ['client-documents']
			}
		]
	});
	// Its token has no roles, and so no audience, and an API that checks says "not for this API". There
	// is no client to set it on, so an admin has to put it in a scope every client gets.
	const scopes = await admin.call<{ id: string; name: string }[]>(
		'GET',
		`/realms/${realm}/client-scopes`
	);
	const basic = scopes.find(({ name }) => name === 'basic');
	await admin.call('POST', `/realms/${realm}/client-scopes/${basic?.id}/protocol-mappers/models`, {
		name: 'audience of the API',
		protocol: 'openid-connect',
		protocolMapper: 'oidc-audience-mapper',
		config: { 'included.custom.audience': API_AUDIENCE, 'access.token.claim': 'true' }
	});
}

/**
 * What an admin does so that the first API may trade a token for one meant for the second: token
 * exchange on for its client, and a scope it gets that names the second API. Off, both are taken away
 * again, so a run without it is on a client that is on its defaults.
 */
export async function letTheApiExchange(
	admin: Admin,
	on: boolean,
	clientId = API_CLIENT,
	refresh = false,
	realm = LOCAL_REALM
) {
	const onClients = `/realms/${realm}/clients`;
	const [api] = await admin.call<{ id: string; attributes?: Record<string, string> }[]>(
		'GET',
		`${onClients}?clientId=${clientId}`
	);
	const [scope] = (
		await admin.call<{ id: string; name: string }[]>('GET', `/realms/${realm}/client-scopes`)
	).filter(({ name }) => name === NAMES_THE_SECOND_API);
	// Taken away again when not wanted, so the client is on its defaults, as the notes say.
	const attributes = Object.fromEntries(
		Object.entries(api.attributes ?? {}).filter(([name]) => name !== TRADE_REFRESH)
	);
	await admin.call('PUT', `${onClients}/${api.id}`, {
		...api,
		attributes: {
			...attributes,
			'standard.token.exchange.enabled': String(on),
			...(on && refresh ? { [TRADE_REFRESH]: TRADE_REFRESH_ON } : {})
		}
	});
	const scopeOnIt = `${onClients}/${api.id}/default-client-scopes/${scope.id}`;
	if (on) await admin.call('PUT', scopeOnIt);
	else {
		try {
			await admin.call('DELETE', scopeOnIt);
		} catch {
			// It did not have it.
		}
	}
}

/**
 * The other provider, in the realm where people log in with a password, only to link an account
 * at (#179). It keeps the tokens a link brings, and is hidden from the login page, so the login is
 * the same as without it. Taken away again when not wanted.
 */
async function linkingWith(admin: Admin, on: boolean) {
	const onProviders = `/realms/${LOCAL_REALM}/identity-provider/instances`;
	try {
		await admin.call('DELETE', `${onProviders}/${UPSTREAM_REALM}`);
	} catch {
		// It was not there.
	}
	if (!on) return;
	const upstream = `realms/${UPSTREAM_REALM}/protocol/openid-connect`;
	await admin.call('POST', onProviders, {
		alias: UPSTREAM_REALM,
		providerId: 'oidc',
		enabled: true,
		storeToken: true,
		hideOnLogin: true,
		config: {
			authorizationUrl: `${KEYCLOAK}/${upstream}/auth`,
			tokenUrl: `${PROXY_FROM_CONTAINER}/${upstream}/token`,
			userInfoUrl: `${PROXY_FROM_CONTAINER}/${upstream}/userinfo`,
			jwksUrl: `${PROXY_FROM_CONTAINER}/${upstream}/certs`,
			useJwksUrl: 'true',
			validateSignature: 'true',
			issuer: `${KEYCLOAK}/realms/${UPSTREAM_REALM}`,
			clientId: BROKER_CLIENT,
			clientSecret: BROKER_SECRET,
			clientAuthMethod: 'client_secret_post',
			defaultScope: 'openid'
		}
	});
}

export async function setUpFor(
	admin: Admin,
	realm: string,
	settings: Pick<Settings, 'clientType' | 'consent' | 'upstreamTokens'> &
		Partial<
			Pick<
				Settings,
				| 'appRuns'
				| 'apiToken'
				| 'refresh'
				| 'reuse'
				| 'logout'
				| 'registered'
				| 'exchange'
				| 'exchangeGives'
				| 'upstreamReader'
				| 'linkAccount'
				| 'implicit'
				| 'groupRoles'
				| 'rolesReach'
			>
		>
) {
	const onClients = `/realms/${realm}/clients`;
	const [old] = await admin.call<{ id: string }[]>(
		'GET',
		`${onClients}?clientId=${CONFIDENTIAL_CLIENT}`
	);
	if (old) await admin.call('DELETE', `${onClients}/${old.id}`);
	await admin.call(
		'POST',
		onClients,
		client(CONFIDENTIAL_CLIENT, {
			...(settings.appRuns === 'page' ? { webOrigins: [APP] } : {}),
			// What some put there to make Invalid parameter: redirect_uri go away.
			...(settings.registered === 'any' ? { redirectUris: ['*'] } : {}),
			// Registered with no port, which a loopback address does not need (RFC 8252 section 7.3).
			...(settings.appRuns === 'program' ? { redirectUris: [LOOPBACK_REDIRECT_URI] } : {}),
			...(settings.clientType === 'public' ? { publicClient: true } : confidential),
			// Off on a new client, and on here, which is the Implicit flow switch in the console.
			...(settings.implicit ? { implicitFlowEnabled: true } : {}),
			...(settings.rolesReach === 'given' ? { fullScopeAllowed: false } : {}),
			// Set when a client is created through this API, this also turns off Full scope allowed, and
			// the token has no roles and no audience. Turned on afterwards, as anyone does it in the
			// console, it changes nothing in the token (questions.json).
			...(settings.consent ? { consentRequired: true, fullScopeAllowed: true } : {}),
			...(settings.upstreamTokens === 'v2' && (settings.upstreamReader ?? 'app') === 'app'
				? {
						attributes: {
							'external.token.enabled': 'true',
							'external.token.idp': UPSTREAM_REALM
						}
					}
				: {}),
			// A second, so the demo app only has to wait a moment to have an expired one.
			...(settings.apiToken === 'expired' ? { attributes: { 'access.token.lifespan': '1' } } : {}),
			// Long enough for one call with the new token, and short enough not to wait five minutes.
			...(settings.refresh ? { attributes: { 'access.token.lifespan': '3' } } : {}),
			...(settings.logout
				? {
						attributes: { 'post.logout.redirect.uris': POST_LOGOUT_URI },
						protocolMappers: [namesTheApi]
					}
				: {}),
			// The first API can only trade a token that names it (questions.json), and an API reads a
			// stored token only with one that names it too (#180).
			...(settings.exchange ||
			(settings.upstreamReader ?? 'app') !== 'app' ||
			settings.rolesReach === 'given'
				? { protocolMappers: [namesTheApi] }
				: {})
		})
	);
	if (settings.rolesReach === 'given') {
		const [made] = await admin.call<{ id: string }[]>(
			'GET',
			`${onClients}?clientId=${CONFIDENTIAL_CLIENT}`
		);
		const role = await admin.call<object>('GET', `/realms/${realm}/roles/${ROLE_FROM_GROUP}`);
		await admin.call('POST', `${onClients}/${made.id}/scope-mappings/realm`, [role]);
	}
	await admin.call('PUT', `/realms/${realm}`, { revokeRefreshToken: settings.reuse === 'ends' });
	if (realm === LOCAL_REALM) {
		await linkingWith(admin, Boolean(settings.linkAccount));
		await letTheApiExchange(
			admin,
			Boolean(settings.exchange),
			API_CLIENT,
			settings.exchangeGives === 'refresh'
		);
	}

	if (realm !== BROKERED_REALM) return;
	// The API, as a client of its own here, allowed this provider's stored tokens or another's (#180).
	const [oldApi] = await admin.call<{ id: string }[]>('GET', `${onClients}?clientId=${API_CLIENT}`);
	if (oldApi) await admin.call('DELETE', `${onClients}/${oldApi.id}`);
	const reader = settings.upstreamReader ?? 'app';
	if (settings.upstreamTokens === 'v2' && reader !== 'app') {
		await admin.call('POST', onClients, {
			...client(API_CLIENT, confidential),
			standardFlowEnabled: false,
			attributes: {
				'external.token.enabled': 'true',
				'external.token.idp': reader === 'refused' ? 'some-other-provider' : UPSTREAM_REALM
			}
		});
	}
	// The first API, trading the token it was sent, as it does without another provider (#186).
	if (settings.exchange) {
		await admin.call('POST', onClients, {
			...client(API_CLIENT, confidential),
			standardFlowEnabled: false
		});
		await letTheApiExchange(
			admin,
			true,
			API_CLIENT,
			settings.exchangeGives === 'refresh',
			BROKERED_REALM
		);
	}
	// The API, so that the app's token can name it, which is what an audience mapper names (#183).
	if (settings.rolesReach === 'given') {
		await admin.call('POST', onClients, {
			...client(API_CLIENT, confidential),
			standardFlowEnabled: false
		});
	}
	const onProvider = `/realms/${BROKERED_REALM}/identity-provider/instances/${UPSTREAM_REALM}`;
	await groupsBecomeRoles(admin, onProvider, Boolean(settings.groupRoles));
	const provider = await admin.call<object>('GET', onProvider);
	await admin.call('PUT', onProvider, {
		...provider,
		storeToken: settings.upstreamTokens !== 'off',
		addReadTokenRoleOnCreate: settings.upstreamTokens === 'v1'
	});
}
