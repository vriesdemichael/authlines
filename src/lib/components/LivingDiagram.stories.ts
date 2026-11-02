import type { Meta, StoryObj } from '@storybook/sveltekit';
import LivingDiagram from '#lib/components/LivingDiagram.svelte';
import { mapNodes } from '#lib/map/nodes.ts';
import { wayIn } from '#lib/map/way-in.ts';

const node = (id: string) => mapNodes.find((candidate) => candidate.id === id)!;

const meta = {
	title: 'LivingDiagram',
	component: LivingDiagram,
	parameters: { layout: 'fullscreen' },
	args: { node: node('how-access-works'), step: 'token-response', href: '#' }
} satisfies Meta<typeof LivingDiagram>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TheWayIn: Story = {
	args: {
		node: node(wayIn.node),
		step: wayIn.step,
		flip: { on: false, onflip: () => {} }
	}
};

export const TheWayInFlipped: Story = {
	args: {
		node: node(wayIn.flipsTo.node),
		step: wayIn.flipsTo.step,
		flip: { on: true, onflip: () => {} }
	}
};

export const AQuestion: Story = { args: { node: node('who-logged-in'), step: null } };

export const OnSetup: Story = {
	args: { node: node('getting-to-know-each-other'), step: null }
};
