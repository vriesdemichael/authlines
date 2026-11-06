import type { Meta, StoryObj } from '@storybook/sveltekit';
import Payload from '#lib/components/Payload.svelte';
import { authorizationCode as flow } from '#lib/flow/authorization-code.ts';
import { evaluate } from '#lib/flow/model.ts';
import { defaultSettings } from '#lib/flow/settings.ts';
import { notesFor } from '#lib/keycloak/notes.ts';
import type { Recording } from '#lib/recordings/format.ts';
import { traceRun } from '#lib/recordings/wire.ts';
import companiesSaml from '../../../static/recordings/authorization-code/companies-saml.json';
import oauth from '../../../static/recordings/authorization-code/oauth.json';

const recording = oauth as Recording;
const view = evaluate(flow, defaultSettings);
const numberOf = (id: string) => view.steps.findIndex((step) => step.id === id) + 1 || null;
const argsFor = (id: string) => ({
	step: view.steps.find((step) => step.id === id)!,
	message: recording.messages.find((message) => message.step === id)!,
	trace: traceRun(recording),
	numberOf
});

const meta = {
	title: 'Payload',
	component: Payload,
	args: argsFor('token-request')
} satisfies Meta<typeof Payload>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ARequest: Story = {};

export const ARedirectWithANewCode: Story = { args: argsFor('redirect-with-code') };

export const AnAnswerWithTokens: Story = { args: argsFor('token-response') };

export const CarryingATokenInAHeader: Story = { args: argsFor('api-request') };

export const AnHtmlPageLeftOut: Story = { args: argsFor('login-page') };

export const TokensSomeoneWasNotSent: Story = {
	args: { ...argsFor('token-response'), redacted: true }
};

export const SayingWhichSettingPutWhatInAToken: Story = {
	args: {
		...argsFor('token-response'),
		notes: notesFor('authorization-code', 'token-response', defaultSettings)
	}
};

const saml = companiesSaml as Recording;
const samlView = evaluate(flow, saml.settings);

export const OpeningASamlAssertion: Story = {
	args: {
		step: samlView.steps.find((step) => step.id === 'upstream-callback')!,
		message: saml.messages.find((message) => message.step === 'upstream-callback')!,
		trace: traceRun(saml),
		numberOf: (id: string) => samlView.steps.findIndex((step) => step.id === id) + 1 || null
	}
};

const ondecode = () => {};

/** Decoded, the address reads as it is and the session cookie's token is opened where it was set. */
export const ARedirectDecoded: Story = {
	args: { ...argsFor('redirect-with-code'), decoded: true, ondecode }
};

/** A form decoded, with each token in the answer opened where it is and what put what in it. */
export const AnAnswerDecoded: Story = {
	args: {
		...argsFor('token-response'),
		decoded: true,
		ondecode,
		notes: notesFor('authorization-code', 'token-response', defaultSettings)
	}
};

/** The switch is offered, as sent. */
export const ARedirectWithTheSwitch: Story = {
	args: { ...argsFor('redirect-with-code'), ondecode }
};
