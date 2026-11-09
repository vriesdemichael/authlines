import type { Meta, StoryObj } from '@storybook/sveltekit';
import PanelDivider from '#lib/components/PanelDivider.svelte';

const meta = {
	title: 'PanelDivider',
	component: PanelDivider,
	args: { width: 330, min: 280, max: 900, initial: 330, onresize: () => {} }
} satisfies Meta<typeof PanelDivider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AtItsOwnWidth: Story = {};

export const AsWideAsItGoes: Story = { args: { width: 900 } };
