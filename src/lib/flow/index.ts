import { authorizationCode } from '#lib/flow/authorization-code.ts';
import { authorizationCodeSetup } from '#lib/flow/authorization-code-setup.ts';
import { clientCredentials } from '#lib/flow/client-credentials.ts';
import { clientCredentialsSetup } from '#lib/flow/client-credentials-setup.ts';
import { device } from '#lib/flow/device.ts';
import { deviceSetup } from '#lib/flow/device-setup.ts';
import type { BaseFlow, Preset } from '#lib/flow/model.ts';
import { codeFlowSettingIds } from '#lib/flow/settings.ts';

const presets: readonly Preset[] = [
	{ id: 'oauth', title: 'OAuth', settings: {} },
	{ id: 'in-a-directory', title: 'Users in a directory', settings: { federation: true } },
	{
		id: 'registers-itself',
		title: 'An app that registers itself',
		settings: { registration: 'dcr' }
	},
	{
		id: 'points-at-a-document',
		title: 'An app that points at a document',
		settings: { registration: 'cimd', clientType: 'public', pkce: true, consent: true }
	},
	{
		id: 'the-old-way',
		title: 'The old way: the app has your password',
		settings: { oldWay: true }
	},
	{
		id: 'address-refused',
		title: 'An address that was not registered',
		settings: { address: 'other' }
	},
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
		title: 'Using a refresh token twice ends the app’s session',
		settings: { refresh: true, reuse: 'ends' }
	},
	{
		id: 'refresh-public-ends',
		title: 'Using a refresh token twice ends the app’s session, with no secret',
		settings: { refresh: true, clientType: 'public', pkce: true, reuse: 'ends' }
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
		settings: { appRuns: 'page', oidc: true, clientType: 'public', pkce: true }
	},
	{
		id: 'behind-the-page',
		title: 'An app in the page, with a server behind it',
		settings: { appRuns: 'bff', clientType: 'confidential', pkce: true }
	},
	{
		id: 'in-the-page',
		title: 'An app in the page',
		settings: { appRuns: 'page', clientType: 'public', pkce: true }
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
		id: 'companies',
		title: 'A customer with a provider of their own',
		settings: { broker: true, companies: true }
	},
	{
		id: 'companies-saml',
		title: 'A customer whose provider speaks SAML',
		settings: { broker: true, companies: true, customerSpeaks: 'saml' }
	},
	{
		id: 'dpop-thief',
		title: 'Someone using a stolen DPoP token, at an API that checks the proof',
		settings: { binding: 'dpop', tokenThief: true }
	},
	{
		id: 'dpop-thief-bearer-only',
		title: 'Someone using a stolen DPoP token, at an API that knows only Bearer',
		settings: { binding: 'dpop', tokenThief: true, apiChecks: 'bearer' }
	},
	{
		id: 'companies-leaves',
		title: 'Someone leaves a customer whose provider speaks SAML',
		settings: { broker: true, companies: true, customerSpeaks: 'saml', leaves: true }
	},
	{
		id: 'companies-oidc-leaves',
		title: 'Someone leaves a customer whose provider speaks OpenID Connect',
		settings: { broker: true, companies: true, leaves: true }
	},
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
	settings: codeFlowSettingIds,
	presets
};

const ONLY_RECORDED_THERE = 'Only recorded on the authorization code flow so far.';
/** No real server has asked for one, so this is the RFC's, and it is only on that flow's diagram. */
const ONLY_DRAWN_THERE = 'Only drawn on the authorization code flow so far, from the RFC.';

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
		refresh: 'A refresh token should not be included here. The app asks again with its secret.',
		logout: 'There is no login to end.',
		apiToken: ONLY_RECORDED_THERE,
		dpopNonce: ONLY_DRAWN_THERE
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
	settings: ['oidc', 'deviceEnds', 'deviceAttack'],
	notHere: {
		consent:
			'It asks here anyway. The spec says a server should, and the one recorded did every time, with that setting off and on.',
		clientType:
			'Recorded with no secret, because software on someone’s own device generally cannot keep one. An app that had one would send it each time as well.',
		pkce: 'The code that gets the tokens goes straight to the app and never through a browser, so the theft PKCE is for does not happen here. RFC 8628 does not include it.',
		attacker:
			'The code that gets the tokens never goes through a browser, so that theft is not here. What can go wrong here is under "Someone misusing it". The page that asks the user to agree is where someone can still stop that one.',
		broker: ONLY_RECORDED_THERE,
		sso: ONLY_RECORDED_THERE,
		refresh: ONLY_RECORDED_THERE,
		logout: ONLY_RECORDED_THERE,
		apiToken: ONLY_RECORDED_THERE,
		binding: 'Not recorded on this flow so far.',
		dpopNonce: ONLY_DRAWN_THERE
	},
	presets: [
		{ id: 'on-a-device', title: 'An app on a device', settings: {} },
		{
			id: 'on-a-device-oidc',
			title: 'An app on a device, with who logged in',
			settings: { oidc: true }
		},
		{
			id: 'on-a-device-says-no',
			title: 'An app on a device, and the user says no',
			settings: { deviceEnds: 'says-no' }
		},
		{
			id: 'on-a-device-runs-out',
			title: 'An app on a device, and the codes run out',
			settings: { deviceEnds: 'runs-out' }
		},
		{
			id: 'on-a-device-sent',
			title: 'Someone sends the user a code of theirs',
			settings: { deviceAttack: 'sends-code' }
		},
		{
			id: 'on-a-device-sent-says-no',
			title: 'Someone sends the user a code of theirs, and the user says no',
			settings: { deviceAttack: 'sends-code', deviceEnds: 'says-no' }
		},
		{
			id: 'on-a-device-sent-runs-out',
			title: 'Someone sends the user a code of theirs, and it runs out',
			settings: { deviceAttack: 'sends-code', deviceEnds: 'runs-out' }
		},
		{
			id: 'on-a-device-read',
			title: 'Someone reads the code off the screen',
			settings: { deviceAttack: 'reads-code' }
		}
	]
};

export const flows: Record<string, BaseFlow> = {
	[authorizationCodeBase.id]: authorizationCodeBase,
	[clientCredentialsBase.id]: clientCredentialsBase,
	[deviceBase.id]: deviceBase
};
