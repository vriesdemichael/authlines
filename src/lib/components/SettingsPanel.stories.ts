import type { Meta, StoryObj } from '@storybook/sveltekit';
import SettingsPanel from '#lib/components/SettingsPanel.svelte';
import { defaultSettings } from '#lib/flow/settings.ts';

const meta = {
	title: 'SettingsPanel',
	component: SettingsPanel,
	args: { settings: defaultSettings, onchange: () => {} }
} satisfies Meta<typeof SettingsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithServerNotesOff: Story = {
	args: { serverNotes: false, settings: { ...defaultSettings, broker: true, binding: 'dpop' } }
};

export const Defaults: Story = {};

export const WhilePointingAtOne: Story = {
	args: { previewed: { id: 'oidc', says: 'Adds 3 steps, changes 2 messages.' } }
};

export const Simple: Story = {
	args: { mode: 'simple' }
};

export const SimpleWithAnAdvancedSettingOn: Story = {
	args: { mode: 'simple', settings: { ...defaultSettings, binding: 'dpop', dpopNonce: true } }
};

export const DPoPOffersANonce: Story = {
	args: { settings: { ...defaultSettings, binding: 'dpop' } }
};

export const BrokerOffersUpstreamTokens: Story = {
	args: { settings: { ...defaultSettings, broker: true, upstreamTokens: 'v1' } }
};

export const OptionUnavailableWithReason: Story = {
	args: { settings: { ...defaultSettings, broker: true, clientType: 'public' } }
};

export const SettingThatDoesNotFitSaysWhy: Story = {
	args: { mode: 'simple', settings: { ...defaultSettings, binding: 'dpop' } }
};

export const SomeOnlyChangeTheOtherDiagram: Story = {
	args: {
		mode: 'simple',
		notHere: ['oidc', 'consent', 'pkce', 'attacker'],
		elsewhere: { text: 'user flow', href: '#flow' }
	}
};
