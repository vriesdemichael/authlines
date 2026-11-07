import type { Meta, StoryObj } from '@storybook/sveltekit';
import Picture from '#lib/components/Picture.svelte';
import { defaultSettings, normalize, type Settings } from '#lib/flow/settings.ts';
import { sayer, type Wording } from '#lib/flow/wording.ts';
import { refreshPicture } from '#lib/pictures/refresh.ts';
import { whoKnowsWhom } from '#lib/pictures/who-knows-whom.ts';

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

const names = {
	app: 'App',
	idp: 'Identity provider',
	api: 'API',
	upstream: 'Other provider',
	directory: 'Directory'
};
const relations = (settings: Partial<Settings>, wording: Wording = 'plain') =>
	whoKnowsWhom(
		normalize({ ...defaultSettings, ...settings }).settings,
		sayer(wording),
		wording,
		names
	);

/** Who knows whom: what each party holds about the others, and whose tokens each trusts. */
export const WhoKnowsWhom: Story = { args: { picture: relations({}) } };

/** With another provider behind the identity provider, which it is registered at in turn. */
export const WhoKnowsWhomWithAnotherProvider: Story = {
	args: { picture: relations({ broker: true, oidc: true }) }
};

/** With a directory, where the accounts are, looked up at each login. */
export const WhoKnowsWhomWithADirectory: Story = {
	args: { picture: relations({ federation: true }) }
};

/** In Keycloak's words, with its console's names for what a realm holds. */
export const WhoKnowsWhomInKeycloaksWords: Story = {
	args: { picture: relations({ broker: true }, 'keycloak') }
};
