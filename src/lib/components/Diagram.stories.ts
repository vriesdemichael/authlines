import type { Meta, StoryObj } from '@storybook/sveltekit';
import Diagram from '#lib/components/Diagram.svelte';
import { freshIds } from '#lib/diagram/fresh.ts';
import { layoutDiagram } from '#lib/diagram/layout.ts';
import { authorizationCode as flow } from '#lib/flow/authorization-code.ts';
import { authorizationCodeSetup as setup } from '#lib/flow/authorization-code-setup.ts';
import { diffViews, evaluate, holdingsAt } from '#lib/flow/model.ts';
import { defaultSettings, type Settings } from '#lib/flow/settings.ts';

const layoutFor = (settings: Partial<Settings> = {}) =>
	layoutDiagram(evaluate(flow, { ...defaultSettings, ...settings }));
const setupFor = (settings: Partial<Settings> = {}) =>
	layoutDiagram(evaluate(setup, { ...defaultSettings, ...settings }));

const meta = {
	title: 'Diagram',
	component: Diagram,
	args: { layout: layoutFor(), currentStep: 'authorize', animate: false }
} satisfies Meta<typeof Diagram>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OAuth: Story = {};

export const OpenIdConnect: Story = {
	args: {
		layout: layoutFor({ oidc: true }),
		currentStep: 'token-response',
		holdings: holdingsAt(evaluate(flow, { ...defaultSettings, oidc: true }), 'token-response')
	}
};

export const OpenIdConnectJustChanged: Story = {
	args: {
		layout: layoutFor({ oidc: true }),
		currentStep: 'token-response',
		fresh: freshIds(
			diffViews(evaluate(flow, defaultSettings), evaluate(flow, { ...defaultSettings, oidc: true }))
		)
	}
};

export const AMessageOnItsWay: Story = {
	args: {
		currentStep: 'submit-credentials',
		sending: 'submit-credentials',
		landing: new Set(['idp:password']),
		holdings: holdingsAt(evaluate(flow, defaultSettings), 'submit-credentials')
	}
};

export const ARefusalOnItsWay: Story = {
	args: {
		layout: layoutFor({ attacker: true, clientType: 'public', pkce: true }),
		currentStep: 'attacker-token-response',
		sending: 'attacker-token-response'
	}
};

export const NearTheEnd: Story = {
	args: {
		currentStep: 'api-request',
		holdings: holdingsAt(evaluate(flow, defaultSettings), 'api-request')
	}
};

export const TheWholeFlow: Story = {
	args: {
		layout: layoutDiagram(
			evaluate(flow, {
				...defaultSettings,
				oidc: true,
				binding: 'dpop',
				dpopNonce: true,
				broker: true,
				upstreamTokens: 'v1'
			}),
			'advanced',
			{ width: 1280, height: 560 },
			'specs',
			true
		),
		currentStep: 'token-request'
	}
};

export const InTheSpecsWords: Story = {
	args: {
		layout: layoutDiagram(evaluate(flow, defaultSettings), 'simple', undefined, 'specs'),
		currentStep: 'authorize'
	}
};

export const WithOpenIdConnectInTheSpecsWords: Story = {
	args: {
		layout: layoutDiagram(
			evaluate(flow, { ...defaultSettings, oidc: true }),
			'simple',
			undefined,
			'specs'
		),
		currentStep: 'authorize'
	}
};

export const InKeycloaksWords: Story = {
	args: {
		layout: layoutDiagram(
			evaluate(flow, { ...defaultSettings, broker: true }),
			'simple',
			undefined,
			'keycloak'
		),
		currentStep: 'authorize'
	}
};

export const FollowingTheCode: Story = {
	args: {
		currentStep: 'authorize',
		followed: {
			steps: new Set(['redirect-with-code', 'callback', 'token-request']),
			forms: ['code']
		},
		holdings: holdingsAt(evaluate(flow, defaultSettings), 'authorize')
	}
};

export const SeenAsTheBrowser: Story = {
	args: {
		currentStep: 'token-response',
		eyes: 'browser',
		holdings: holdingsAt(evaluate(flow, defaultSettings), 'token-response')
	}
};

export const SeenAsAnAttackerWhoIsRefused: Story = {
	args: {
		layout: layoutFor({ attacker: true, clientType: 'public', pkce: true }),
		currentStep: 'attacker-token-response',
		eyes: 'attacker',
		holdings: holdingsAt(
			evaluate(flow, { ...defaultSettings, attacker: true, clientType: 'public', pkce: true }),
			'attacker-token-response'
		)
	}
};

export const DPoP: Story = {
	args: { layout: layoutFor({ binding: 'dpop' }), currentStep: 'token-request' }
};

export const DPoPWithNonceRetry: Story = {
	args: { layout: layoutFor({ binding: 'dpop', dpopNonce: true }), currentStep: 'nonce-challenge' }
};

export const Brokered: Story = {
	args: { layout: layoutFor({ broker: true }), currentStep: 'upstream-authorize' }
};

export const StoredUpstreamTokens: Story = {
	args: {
		layout: layoutFor({ broker: true, upstreamTokens: 'v2' }),
		currentStep: 'retrieve-upstream-token'
	}
};

export const ASecondApp: Story = {
	args: { layout: layoutFor({ sso: true, oidc: true }), currentStep: 'idp-recognises' }
};

export const AfterALogout: Story = {
	args: { layout: layoutFor({ oidc: true, logout: true }), currentStep: 'session-ended' }
};

export const TimePassing: Story = {
	args: { layout: layoutFor({ refresh: true }), currentStep: 'token-runs-out' }
};

export const UsingARefreshTokenTwice: Story = {
	args: {
		layout: layoutFor({ refresh: true, reuse: 'ends' }),
		currentStep: 'refresh-again-response'
	}
};

export const EverythingOn: Story = {
	args: {
		layout: layoutFor({
			oidc: true,
			binding: 'dpop',
			dpopNonce: true,
			broker: true,
			upstreamTokens: 'v1'
		}),
		currentStep: 'token-request'
	}
};

export const Setup: Story = {
	args: { layout: setupFor(), currentStep: 'register-client' }
};

export const SetupAtAnHttpMessage: Story = {
	args: { layout: setupFor(), currentStep: 'discover' }
};

export const SetupWithAnExternalIdP: Story = {
	args: {
		layout: setupFor({ broker: true, upstreamTokens: 'v2' }),
		currentStep: 'register-with-upstream'
	}
};
