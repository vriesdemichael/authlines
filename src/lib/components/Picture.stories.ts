import type { Meta, StoryObj } from '@storybook/sveltekit';
import Picture from '#lib/components/Picture.svelte';
import { defaultSettings, normalize, type Settings } from '#lib/flow/settings.ts';
import { sayer, type Wording } from '#lib/flow/wording.ts';
import { refreshPicture } from '#lib/pictures/refresh.ts';
import { whatIsInATokenHere } from '#lib/keycloak/token-contents.ts';
import { howAnApiTrustsAToken } from '#lib/pictures/how-an-api-trusts-a-token.ts';
import { howLongEachLasts } from '#lib/pictures/how-long-each-lasts.ts';
import { trustAcrossProviders } from '#lib/pictures/trust-across-providers.ts';
import { whatACodeLooksLike } from '#lib/pictures/what-a-code-looks-like.ts';
import { whatAThiefCanDo } from '#lib/pictures/what-a-thief-can-do.ts';
import { whatEachFactorProves } from '#lib/pictures/what-each-factor-proves.ts';
import { whatEachSpecAdds } from '#lib/pictures/what-each-spec-adds.ts';
import { whatStopsWhat } from '#lib/pictures/what-stops-what.ts';
import { whereTheTokensAre } from '#lib/pictures/where-the-tokens-are.ts';
import { whichTokenIsForWhom } from '#lib/pictures/which-token-is-for-whom.ts';
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

const plain = sayer('plain');
const settings = normalize({ ...defaultSettings }).settings;

/** Who the identity provider trusts, and how: a relation diagram for the whole and not one flow. */
export const WhoTheIdentityProviderTrusts: Story = {
	args: { picture: trustAcrossProviders(plain, 'plain', names) }
};

/** How an API trusts a token from someone it never called: a chain of what vouches for what. */
export const HowAnApiTrustsAToken: Story = {
	args: { picture: howAnApiTrustsAToken(plain, 'demo') }
};

/** Which token is for whom: a matrix worked out from the steps. */
export const WhichTokenIsForWhom: Story = {
	args: { picture: whichTokenIsForWhom(settings, plain, 'plain') }
};

/** The same, for an app in the page, where the browser has the tokens. */
export const WhichTokenIsForWhomInThePage: Story = {
	args: {
		picture: whichTokenIsForWhom(
			normalize({ ...defaultSettings, appRuns: 'page', clientType: 'public', pkce: true }).settings,
			plain,
			'plain'
		)
	}
};

/** How long each lasts, and whether a logout ends it: a timeline. */
export const HowLongEachLasts: Story = { args: { picture: howLongEachLasts(plain) } };

/** Which protection stops which attack: a matrix of recorded attacks. */
export const WhatStopsWhat: Story = { args: { picture: whatStopsWhat(plain) } };

/** Where the tokens are, by where the app runs, with the current one marked. */
export const WhereTheTokensAre: Story = {
	args: { picture: whereTheTokensAre(settings, plain, 'plain') }
};

/** What each spec adds to OAuth: layers. */
export const WhatEachSpecAdds: Story = { args: { picture: whatEachSpecAdds(plain) } };

/** What each way of logging in proves, and what it falls to: a matrix from the standards. */
export const WhatEachFactorProves: Story = { args: { picture: whatEachFactorProves(plain) } };

/** What a thief can do with each, and for how long: a timeline. */
export const WhatAThiefCanDo: Story = { args: { picture: whatAThiefCanDo(plain) } };

/** What a one-time code looks like, in a message and on the page that asks for it. */
export const WhatACodeLooksLike: Story = { args: { picture: whatACodeLooksLike(plain) } };

/** On Keycloak, what decides what is in a token: containment. */
export const WhatIsInATokenHere: Story = { args: { picture: whatIsInATokenHere() } };
