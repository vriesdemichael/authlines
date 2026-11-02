import type { Meta, StoryObj } from '@storybook/sveltekit';
import FlowSwitch from '#lib/components/FlowSwitch.svelte';

const meta = {
	title: 'FlowSwitch',
	component: FlowSwitch,
	args: {
		flows: [
			{ id: 'authorization-code', title: 'Authorization code flow' },
			{ id: 'client-credentials', title: 'Client credentials flow' },
			{ id: 'device', title: 'Device flow' }
		],
		current: 'authorization-code',
		onchange: () => {}
	}
} satisfies Meta<typeof FlowSwitch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TheFirstOne: Story = {};

export const WithNoUser: Story = { args: { current: 'client-credentials' } };
