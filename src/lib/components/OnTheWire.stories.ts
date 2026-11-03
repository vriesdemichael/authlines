import type { Meta, StoryObj } from '@storybook/sveltekit';
import OnTheWire from '#lib/components/OnTheWire.svelte';
import { authorizationCode as flow } from '#lib/flow/authorization-code.ts';
import { evaluate } from '#lib/flow/model.ts';
import { defaultSettings, type Settings } from '#lib/flow/settings.ts';
import type { Recording } from '#lib/recordings/format.ts';
import dpopNonce from '../../../static/recordings/authorization-code/dpop-nonce.json';
import inADirectory from '../../../static/recordings/authorization-code/in-a-directory.json';
import oauth from '../../../static/recordings/authorization-code/oauth.json';

const viewOf = (settings: Partial<Settings> = {}) =>
	evaluate(flow, { ...defaultSettings, ...settings });
const numberOfIn =
	(settings: Partial<Settings> = {}) =>
	(id: string) =>
		viewOf(settings)
			.steps.map((step) => step.id)
			.indexOf(id) + 1 || null;
const stepIn = (id: string, settings: Partial<Settings> = {}) =>
	viewOf(settings).steps.find((step) => step.id === id)!;

const meta = {
	title: 'OnTheWire',
	component: OnTheWire,
	args: {
		step: stepIn('token-request'),
		recording: oauth as Recording,
		status: 'loaded',
		numberOf: numberOfIn()
	}
} satisfies Meta<typeof OnTheWire>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ARequest: Story = {};

export const TheAnswerAfterExecuting: Story = {
	args: { step: stepIn('token-response'), answerTo: 'token-request' }
};

export const CarryingValuesFromEarlierSteps: Story = { args: { step: stepIn('callback') } };

export const FromALogAndNotTheWire: Story = {
	args: {
		step: stepIn('directory-bind', { federation: true }),
		recording: inADirectory as unknown as Recording,
		numberOf: numberOfIn({ federation: true })
	}
};

export const NoRecordingOfTheseSettings: Story = {
	args: {
		recording: null,
		status: 'none',
		nearest: [
			{ text: 'OpenID Connect', href: '#oidc' },
			{ text: 'DPoP', href: '#dpop' }
		]
	}
};

export const FromTheSpecOnly: Story = {
	args: {
		step: stepIn('nonce-challenge', { binding: 'dpop', dpopNonce: true }),
		recording: dpopNonce as Recording,
		numberOf: numberOfIn({ binding: 'dpop', dpopNonce: true })
	}
};

export const Loading: Story = { args: { recording: null, status: 'loading' } };

export const CouldNotLoad: Story = { args: { recording: null, status: 'failed' } };
