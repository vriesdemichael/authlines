import type { Meta, StoryObj } from '@storybook/sveltekit';
import Picture from '#lib/components/Picture.svelte';
import { defaultSettings, normalize, type Settings } from '#lib/flow/settings.ts';
import { sayer, type Wording } from '#lib/flow/wording.ts';
import { refreshPicture } from '#lib/pictures/refresh.ts';

const refresh = (settings: Partial<Settings>, wording: Wording = 'plain') =>
	refreshPicture(
		normalize({ ...defaultSettings, refresh: true, ...settings }).settings,
		sayer(wording)
	);

const meta = {
	title: 'Picture',
	component: Picture,
	args: { picture: refresh({}), onopen: () => {} }
} satisfies Meta<typeof Picture>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Refresh, or log in again: an app with a secret. */
export const RefreshOrLogInAgain: Story = {};

/** With no secret, a copy of the refresh token is all someone else needs. */
export const WithNoSecret: Story = {
	args: { picture: refresh({ clientType: 'public', pkce: true }) }
};

/** Where a used refresh token ends the app's session. */
export const AUsedRefreshTokenEndsIt: Story = { args: { picture: refresh({ reuse: 'ends' }) } };

/** With another provider, which the refresh does not ask. */
export const WithAnotherProvider: Story = { args: { picture: refresh({ broker: true }) } };

/** In the specs' words, which are longer. */
export const InTheSpecsWords: Story = { args: { picture: refresh({}, 'specs') } };
