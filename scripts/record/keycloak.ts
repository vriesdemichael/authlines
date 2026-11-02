// A throwaway Keycloak in a container, set up the way someone would through its admin API. Nothing
// here is a real credential: the realms, users and secrets exist only for this run.
import { execFileSync } from 'node:child_process';
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
const PROXY_FROM_CONTAINER = `http://host.docker.internal:${PROXY_PORT}`;

export const BROKERED_REALM = 'demo-brokered';
export const UPSTREAM_REALM = 'upstream';
export const PUBLIC_CLIENT = 'demo-public';
export const PKCE_CLIENT = 'demo-public-pkce';
export const BROKER_CLIENT = 'demo-broker';
export const BROKER_SECRET = 'throwaway-broker-secret';
export const SECOND_APP = 'http://localhost:9103';
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
export const BACKCHANNEL_URL = 'http://host.docker.internal:9103/backchannel';
export const API_CLIENT = 'demo-api';
export const POST_LOGOUT_URI = `${APP}/bye`;

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

const CONTAINER = 'authlines-keycloak';
export const ADMIN_PASSWORD = 'throwaway-admin';

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

export async function setUpRealms(admin: Admin) {
	for (const realm of [LOCAL_REALM, BROKERED_REALM, UPSTREAM_REALM]) {
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

	await admin.call('POST', `/realms/${UPSTREAM_REALM}/users`, user);
	await admin.call('POST', `/realms/${UPSTREAM_REALM}/clients`, {
		clientId: BROKER_CLIENT,
		enabled: true,
		standardFlowEnabled: true,
		publicClient: false,
		clientAuthenticatorType: 'client-secret',
		secret: BROKER_SECRET,
		redirectUris: [`${KEYCLOAK}/realms/${BROKERED_REALM}/broker/${UPSTREAM_REALM}/endpoint`]
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

	await setUpFor(admin, LOCAL_REALM, defaultsForQuestions);
	await setUpFor(admin, BROKERED_REALM, defaultsForQuestions);
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
export async function setUpFor(
	admin: Admin,
	realm: string,
	settings: Pick<Settings, 'clientType' | 'consent' | 'upstreamTokens'> &
		Partial<Pick<Settings, 'apiToken' | 'refresh' | 'reuse' | 'logout'>>
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
			...(settings.clientType === 'public' ? { publicClient: true } : confidential),
			// Set when a client is created through this API, this also turns off Full scope allowed, and
			// the token has no roles and no audience. Turned on afterwards, as anyone does it in the
			// console, it changes nothing in the token (questions.json).
			...(settings.consent ? { consentRequired: true, fullScopeAllowed: true } : {}),
			...(settings.upstreamTokens === 'v2'
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
				: {})
		})
	);
	await admin.call('PUT', `/realms/${realm}`, { revokeRefreshToken: settings.reuse === 'ends' });

	if (realm !== BROKERED_REALM) return;
	const onProvider = `/realms/${BROKERED_REALM}/identity-provider/instances/${UPSTREAM_REALM}`;
	const provider = await admin.call<object>('GET', onProvider);
	await admin.call('PUT', onProvider, {
		...provider,
		storeToken: settings.upstreamTokens !== 'off',
		addReadTokenRoleOnCreate: settings.upstreamTokens === 'v1'
	});
}
