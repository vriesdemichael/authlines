import type { Meta, StoryObj } from '@storybook/sveltekit';
import StepDetail from '#lib/components/StepDetail.svelte';
import { authorizationCode as flow } from '#lib/flow/authorization-code.ts';
import { authorizationCodeSetup as setup } from '#lib/flow/authorization-code-setup.ts';
import { diffViews, evaluate, introOf } from '#lib/flow/model.ts';
import { defaultSettings, type Settings } from '#lib/flow/settings.ts';
import { notesFor } from '#lib/keycloak/notes.ts';

const view = (settings: Partial<Settings> = {}) =>
	evaluate(flow, { ...defaultSettings, ...settings });
const stepIn = (id: string, settings: Partial<Settings> = {}) => {
	const step = view(settings).steps.find((candidate) => candidate.id === id);
	if (!step) throw new Error(`No step ${id}`);
	return step;
};

const meta = {
	title: 'StepDetail',
	component: StepDetail,
	args: { step: stepIn('authorize'), lifelines: view().lifelines }
} satisfies Meta<typeof StepDetail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Request: Story = {};

export const SeenAsSomeoneNotPartOfIt: Story = {
	args: { step: stepIn('token-request'), unseenBy: "User's browser" }
};

export const WithFieldsFromSettings: Story = {
	args: { step: stepIn('authorize', { oidc: true, binding: 'dpop' }) }
};

export const WithKeycloakNotes: Story = {
	args: {
		step: stepIn('token-request'),
		notes: notesFor('authorization-code', 'token-request', defaultSettings)
	}
};

export const NotNamingTheServer: Story = {
	args: { step: stepIn('token-request'), serverNamed: false }
};

export const RecordedFromTheServer: Story = {
	args: {
		step: stepIn('token-request'),
		known: { kind: 'recorded', by: 'server', keycloak: '26.8.1', date: '2026-11-01' }
	}
};

export const RecordedFromTheDemo: Story = {
	args: {
		step: stepIn('api-response'),
		known: { kind: 'recorded', by: 'demo', keycloak: '26.8.1', date: '2026-11-01' }
	}
};

export const RecordedWithOtherSettings: Story = {
	args: { step: stepIn('token-request'), known: { kind: 'other-settings' } }
};

export const ACopyOfAMessage: Story = {
	args: {
		step: stepIn('attacker-steals-code', { attacker: true }),
		known: { kind: 'copied', text: 'The request the real app gets, drawn going to them as well.' }
	}
};

export const FromTheSpecOnly: Story = {
	args: {
		step: stepIn('nonce-challenge', { binding: 'dpop', dpopNonce: true }),
		known: { kind: 'spec', source: 'RFC 9449 section 8' }
	}
};

export const NoFields: Story = {
	args: { step: stepIn('open-app') }
};

export const Internal: Story = {
	args: { step: stepIn('validate-id-token', { oidc: true }) }
};

export const PeopleNotHttp: Story = {
	args: {
		step: evaluate(setup, defaultSettings).steps[0],
		lifelines: evaluate(setup, defaultSettings).lifelines
	}
};

export const Simple: Story = {
	args: { mode: 'simple', step: stepIn('token-response', { oidc: true }) }
};

export const SimpleOnTheFirstStep: Story = {
	args: { mode: 'simple', step: stepIn('open-app'), intro: introOf(flow, defaultSettings) }
};

export const SimpleWithAPitfall: Story = {
	args: { mode: 'simple' }
};

export const AfterAChangeSayingWhy: Story = {
	args: { mode: 'simple', change: diffViews(view(), view({ oidc: true })), changed: 'oidc' }
};

/** After Back or a link there is a difference to name, and nobody just flipped anything. */
export const AfterBackWithNoWhy: Story = {
	args: { change: diffViews(view({ oidc: true }), view({})) }
};

export const WithALinkToTheOtherDiagram: Story = {
	args: { links: [{ text: 'See where the redirect URI was registered', href: '#' }] }
};

export const ASettingThatOnlyChangesTheOtherDiagram: Story = {
	args: { elsewhere: { text: 'It changes the user flow.', href: '#' } }
};

export const OnlyBecauseOfASetting: Story = {
	args: {
		step: stepIn('upstream-authorize', { broker: true }),
		lifelines: view({ broker: true }).lifelines
	}
};

export const AfterAChange: Story = {
	args: { change: diffViews(view(), view({ oidc: true })) }
};

export const AfterAChangeThatResetAnother: Story = {
	args: {
		change: diffViews(
			view({ broker: true, upstreamTokens: 'v2' }),
			view({ broker: true, clientType: 'public' })
		),
		resets: [
			{
				setting: 'upstreamTokens',
				because:
					'API V2 only works with a Bearer token, and for a confidential client, which the app has to be unless an API reads the token.'
			}
		]
	}
};

export const TheChannelIsNoNews: Story = {
	args: { step: stepIn('login-page'), previousChannel: 'front' }
};

export const AtTheEndWithAQuestionToGoOnTo: Story = {
	args: {
		step: stepIn('api-response'),
		atEnd: true,
		onward: {
			title: 'How does an app know who logged in?',
			summary: 'Access is not identity, which is what OpenID Connect adds.',
			href: '#next'
		}
	}
};

export const AtTheEndWithNowhereToGo: Story = {
	args: { step: stepIn('api-response'), atEnd: true, mapHref: '#map' }
};

export const ItSaysWhichSpec: Story = {
	args: {
		step: {
			...stepIn('authorize'),
			cites: [
				{ source: 'rfc9700', section: '2.1.2', why: 'What current advice says about this.' },
				{ source: 'rfc6749', section: '4.1.2', why: 'What the spec says about this.' }
			]
		}
	}
};
