import type { Meta, StoryObj } from '@storybook/sveltekit';
import { createRawSnippet } from 'svelte';
import ExplainDialog from '#lib/components/ExplainDialog.svelte';

const words = (text: string) =>
	createRawSnippet(() => ({
		render: () =>
			`<section style="padding: 16px"><h2 tabindex="-1">Issuer</h2><p>${text}</p></section>`
	}));

const meta = {
	title: 'ExplainDialog',
	component: ExplainDialog,
	args: {
		label: 'Issuer',
		onclose: () => {},
		children: words('The address that says which identity provider a token came from.')
	}
} satisfies Meta<typeof ExplainDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InTheMiddle: Story = {};

export const BesideWhatItLightsUp: Story = { args: { side: 'right' } };

export const OnTheOtherSide: Story = { args: { side: 'left' } };

export const AWholeDocument: Story = {
	args: {
		wide: true,
		children: words('Text to read and move through. '.repeat(400))
	}
};
