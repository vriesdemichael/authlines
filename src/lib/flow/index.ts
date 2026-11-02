import { authorizationCode } from '#lib/flow/authorization-code.ts';
import { authorizationCodeSetup } from '#lib/flow/authorization-code-setup.ts';
import { clientCredentials } from '#lib/flow/client-credentials.ts';
import { clientCredentialsSetup } from '#lib/flow/client-credentials-setup.ts';
import { device } from '#lib/flow/device.ts';
import { deviceSetup } from '#lib/flow/device-setup.ts';
import type { BaseFlow, Preset } from '#lib/flow/model.ts';
import { settingIds } from '#lib/flow/settings.ts';

const presets: readonly Preset[] = [
	{ id: 'oauth', title: 'OAuth', settings: {} },
	{ id: 'api-no-token', title: 'The API sent no token', settings: { apiToken: 'none' } },
	{ id: 'api-expired', title: 'The API sent an expired token', settings: { apiToken: 'expired' } },
	{ id: 'api-changed', title: 'The API sent a changed token', settings: { apiToken: 'changed' } },
	{
		id: 'api-elsewhere',
		title: 'The API sent a token for another API',
		settings: { apiToken: 'elsewhere' }
	},
	{
		id: 'api-no-scope',
		title: 'The API sent a token that does not allow this',
		settings: { apiToken: 'noscope' }
	},
	{ id: 'refresh', title: 'When the token runs out', settings: { refresh: true } },
	{
		id: 'refresh-public',
		title: 'When the token runs out, with no secret',
		settings: { refresh: true, clientType: 'public', pkce: true }
	},
	{
		id: 'refresh-ends',
		title: 'Using a refresh token twice ends the login',
		settings: { refresh: true, reuse: 'ends' }
	},
	{ id: 'sso', title: 'A second app', settings: { sso: true } },
	{
		id: 'sso-oidc',
		title: 'A second app, with who logged in',
		settings: { sso: true, oidc: true }
	},
	{
		id: 'sso-insists',
		title: 'A second app that insists on a login',
		settings: { sso: true, oidc: true, ssoAsks: 'insists' }
	},
	{
		id: 'sso-fresh',
		title: 'A second app, in a new browser',
		settings: { sso: true, oidc: true, ssoAsks: 'fresh' }
	},
	{ id: 'logout', title: 'Logging out', settings: { oidc: true, logout: true } },
	{
		id: 'logout-two-apps',
		title: 'Logging out, with a second app',
		settings: { oidc: true, sso: true, logout: true }
	},
	{ id: 'oidc', title: 'OpenID Connect', settings: { oidc: true } },
	{
		id: 'consent',
		title: 'Asking the user',
		settings: { consent: true }
	},
	{ id: 'pkce', title: 'PKCE', settings: { pkce: true } },
	{
		id: 'public',
		title: 'An app with no secret',
		settings: { clientType: 'public' }
	},
	{
		id: 'public-pkce',
		title: 'An app with no secret, with PKCE',
		settings: { clientType: 'public', pkce: true }
	},
	{
		id: 'oidc-pkce',
		title: 'OpenID Connect with PKCE',
		settings: { oidc: true, pkce: true }
	},
	{
		id: 'browser-app',
		title: 'An app in the browser',
		settings: { oidc: true, clientType: 'public', pkce: true }
	},
	{
		id: 'attack-public',
		title: 'An attacker, against an app with no secret',
		settings: { attacker: true, clientType: 'public' }
	},
	{
		id: 'attack-public-pkce',
		title: 'An attacker, against an app with no secret, with PKCE',
		settings: { attacker: true, clientType: 'public', pkce: true }
	},
	{
		id: 'attack-confidential',
		title: 'An attacker, against an app with a secret',
		settings: { attacker: true }
	},
	{
		id: 'attack-confidential-pkce',
		title: 'An attacker, against an app with a secret, with PKCE',
		settings: { attacker: true, pkce: true }
	},
	{
		id: 'attack-at-the-app',
		title: 'A stolen code, handed to the real app',
		settings: { attacker: true, attackerUses: 'real-app' }
	},
	{
		id: 'attack-at-the-app-pkce',
		title: 'A stolen code, handed to the real app, with PKCE',
		settings: { attacker: true, attackerUses: 'real-app', pkce: true }
	},
	{
		id: 'attack-at-the-app-oidc',
		title: 'A stolen code, handed to the real app, with a nonce',
		settings: { attacker: true, attackerUses: 'real-app', oidc: true }
	},
	{ id: 'dpop', title: 'DPoP', settings: { binding: 'dpop' } },
	{
		id: 'dpop-nonce',
		title: 'DPoP with a nonce',
		settings: { binding: 'dpop', dpopNonce: true }
	},
	{ id: 'broker', title: 'External IdP', settings: { broker: true } },
	{
		id: 'upstream-v1',
		title: 'Stored upstream tokens, API V1',
		settings: { broker: true, upstreamTokens: 'v1' }
	},
	{
		id: 'upstream-v2',
		title: 'Stored upstream tokens, API V2',
		settings: { broker: true, upstreamTokens: 'v2' }
	},
	{
		id: 'everything',
		title: 'Everything on',
		settings: {
			oidc: true,
			pkce: true,
			binding: 'dpop',
			dpopNonce: true,
			broker: true,
			upstreamTokens: 'v1'
		}
	}
];

export const authorizationCodeBase: BaseFlow = {
	id: authorizationCode.id,
	diagrams: { flow: authorizationCode, setup: authorizationCodeSetup },
	settings: settingIds,
	presets
};

const ONLY_RECORDED_THERE = 'Only recorded on the authorization code flow so far.';

export const clientCredentialsBase: BaseFlow = {
	id: clientCredentials.id,
	diagrams: { flow: clientCredentials, setup: clientCredentialsSetup },
	settings: ['binding'],
	notHere: {
		oidc: 'It says who logged in, and here nobody does.',
		consent: 'There is no user to ask.',
		clientType: 'This only works for an app that can prove who it is, with a secret or a key.',
		pkce: 'There is no code to protect.',
		attacker: 'There is no code to steal.',
		broker: 'There is no login to hand to anyone.',
		sso: 'There is no login to remember.',
		refresh: 'There is no refresh token. The app asks again with its secret.',
		logout: 'There is no login to end.',
		apiToken: ONLY_RECORDED_THERE,
		dpopNonce: ONLY_RECORDED_THERE
	},
	presets: [
		{ id: 'as-itself', title: 'An app acting for itself', settings: {} },
		{
			id: 'as-itself-dpop',
			title: 'An app acting for itself, with DPoP',
			settings: { binding: 'dpop' }
		}
	]
};

export const deviceBase: BaseFlow = {
	id: device.id,
	diagrams: { flow: device, setup: deviceSetup },
	settings: ['oidc'],
	notHere: {
		consent: 'It always asks here. The spec says a server should, and this one did either way.',
		clientType:
			'Recorded with no secret, because software on someone’s own device generally cannot keep one. An app that had one would send it each time as well.',
		pkce: 'No code goes through a browser here. The device code goes straight to the app, so there is nothing for it to protect.',
		attacker:
			'No code goes through a browser to steal. The trick here is a different one, and the page that asks the user to agree is where it gets stopped.',
		broker: ONLY_RECORDED_THERE,
		sso: ONLY_RECORDED_THERE,
		refresh: ONLY_RECORDED_THERE,
		logout: ONLY_RECORDED_THERE,
		apiToken: ONLY_RECORDED_THERE,
		binding: ONLY_RECORDED_THERE,
		dpopNonce: ONLY_RECORDED_THERE
	},
	presets: [
		{ id: 'on-a-device', title: 'An app on a device', settings: {} },
		{
			id: 'on-a-device-oidc',
			title: 'An app on a device, with who logged in',
			settings: { oidc: true }
		}
	]
};

export const flows: Record<string, BaseFlow> = {
	[authorizationCodeBase.id]: authorizationCodeBase,
	[clientCredentialsBase.id]: clientCredentialsBase,
	[deviceBase.id]: deviceBase
};
