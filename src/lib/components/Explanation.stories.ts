import type { Meta, StoryObj } from '@storybook/sveltekit';
import Explanation from '#lib/components/Explanation.svelte';
import { defaultSettings, normalize, settingDefs } from '#lib/flow/settings.ts';
import { sayer } from '#lib/flow/wording.ts';
import { refreshPicture } from '#lib/pictures/refresh.ts';
import { artifacts } from '#lib/flow/vocabulary.ts';
import { NAMED_BY_OAUTH, NAMED_BY_OIDC } from '#lib/sources/sources.ts';

const meta = {
	title: 'Explanation',
	component: Explanation,
	args: {
		title: 'Identity provider',
		text: 'The identity provider, or IdP, logs users in and issues tokens.',
		onclose: () => {}
	}
} satisfies Meta<typeof Explanation>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ALifelineThatHasSeenThings: Story = {
	args: { seen: ['secret', 'password', 'code'], onseeonly: () => {} }
};

export const WhatElseItIsCalled: Story = {
	args: {
		title: 'Client',
		alsoCalled: ['App, in plain words', 'relying party, in OpenID Connect'],
		sources: [NAMED_BY_OAUTH, NAMED_BY_OIDC]
	}
};

export const SomethingToFollow: Story = {
	args: { title: 'code', onfollow: () => {} }
};

export const SomethingBeingFollowed: Story = {
	args: { title: 'code', onfollow: () => {}, following: true }
};

export const ALifelineWhoseViewIsShown: Story = {
	args: { seen: ['secret', 'password', 'code'], onseeonly: () => {}, seeingOnly: true }
};

export const ALifelineThatHasSeenNothing: Story = {
	args: { seen: [] }
};

export const AToken: Story = {
	args: {
		title: artifacts.code.label,
		text: artifacts.code.explains,
		seenBy: ["User's browser", 'Identity provider']
	}
};

export const ATokenNobodyHasYet: Story = {
	args: {
		title: artifacts['access-token'].label,
		text: artifacts['access-token'].explains,
		seenBy: []
	}
};

export const ASetting: Story = {
	args: {
		title: settingDefs.oidc.label,
		text: settingDefs.oidc.why,
		sources: settingDefs.oidc.sources
	}
};

/** A concept a picture says better than words, with each part opening its steps (#167). */
export const WithAPicture: Story = {
	args: {
		title: artifacts['refresh-token'].label,
		text: artifacts['refresh-token'].explains,
		seenBy: ['App', 'Identity provider'],
		picture: refreshPicture(
			normalize({ ...defaultSettings, refresh: true }).settings,
			sayer('plain')
		),
		onopenpart: () => {}
	}
};
