import type { Meta, StoryObj } from '@storybook/sveltekit';
import Hint from '#lib/components/Hint.svelte';

const at = { left: 24, right: 160, top: 24, bottom: 44, width: 136, height: 20, x: 24, y: 24 };

const meta = {
	title: 'Hint',
	component: Hint,
	args: {
		preview: {
			text: 'The one-time code, which the app trades for tokens.',
			rect: { ...at, toJSON: () => at } as DOMRect
		}
	}
} satisfies Meta<typeof Hint>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UnderWhatItExplains: Story = {};

export const ALongerOne: Story = {
	args: {
		preview: {
			text: 'Pre-authentication data: a list of things sent beside the request or the answer, each with a type, to prove something or to say how.',
			rect: { ...at, toJSON: () => at } as DOMRect
		}
	}
};
