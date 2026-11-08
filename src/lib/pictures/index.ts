import { flows } from '#lib/flow/index.ts';
import { evaluate } from '#lib/flow/model.ts';
import type { AppState, Explained } from '#lib/flow/state.ts';
import { nameIn, sayer, type Say, type Wording } from '#lib/flow/wording.ts';
import { whatIsInATokenHere } from '#lib/keycloak/token-contents.ts';
import { howAnApiTrustsAToken } from './how-an-api-trusts-a-token.ts';
import { howLongEachLasts } from './how-long-each-lasts.ts';
import type { Opens, Picture, PictureId } from './model.ts';
import { refreshPicture } from './refresh.ts';
import { inSimpleMode } from './simple.ts';
import { trustAcrossProviders } from './trust-across-providers.ts';
import { whatAThiefCanDo } from './what-a-thief-can-do.ts';
import { whatEachFactorProves } from './what-each-factor-proves.ts';
import { whatEachSpecAdds } from './what-each-spec-adds.ts';
import { whatStopsWhat } from './what-stops-what.ts';
import { whereTheTokensAre } from './where-the-tokens-are.ts';
import { whichTokenIsForWhom } from './which-token-is-for-whom.ts';
import { whoKnowsWhom, type PartyNames } from './who-knows-whom.ts';

export type { Opens, Picture, PictureId, PicturePart, PictureRow } from './model.ts';

const PLAIN: PartyNames = {
	app: 'App',
	idp: 'Identity provider',
	api: 'API',
	upstream: 'Other provider',
	directory: 'Directory'
};

/** What the parties are called on the diagram, so a picture uses the same names as its heads. */
function namesOn(state: AppState, wording: Wording): PartyNames {
	const lines = evaluate(flows[state.flow].diagrams.flow, state.settings).lifelines;
	const named = (id: keyof PartyNames) => {
		const line = lines.find((candidate) => candidate.id === id);
		return line ? nameIn(line, wording) : sayer(wording)(PLAIN[id]);
	};
	return {
		app: named('app'),
		idp: named('idp'),
		api: named('api'),
		upstream: named('upstream'),
		directory: named('directory')
	};
}

const key = (explained: Explained) => `${explained.kind}.${explained.id}`;

/**
 * Which picture goes in which explanation (#167). A concept gets one where a picture says in a glance
 * what would otherwise take a paragraph, and each explanation has at most one. The maintainer asked
 * for these on 2026-11-06 and 2026-11-07.
 */
export const PICTURE_OF: Readonly<Record<string, PictureId>> = {
	'artifact.refresh-token': 'refresh',
	'term.refresh-token': 'refresh',
	'setting.refresh': 'refresh',
	'lifeline.idp': 'who-knows-whom',
	'term.identity-provider': 'who-knows-whom',
	'setting.broker': 'trust-across-providers',
	'setting.companies': 'trust-across-providers',
	'setting.federation': 'trust-across-providers',
	'term.saml': 'trust-across-providers',
	'term.ldap': 'trust-across-providers',
	'term.issuer': 'how-an-api-trusts-a-token',
	'term.signature': 'how-an-api-trusts-a-token',
	'term.audience': 'how-an-api-trusts-a-token',
	'term.jwt': 'how-an-api-trusts-a-token',
	'term.token': 'which-token-is-for-whom',
	'artifact.access-token': 'which-token-is-for-whom',
	'term.access-token': 'which-token-is-for-whom',
	'artifact.id-token': 'which-token-is-for-whom',
	'term.id-token': 'which-token-is-for-whom',
	'artifact.session': 'how-long-each-lasts',
	'term.session': 'how-long-each-lasts',
	'term.logout': 'how-long-each-lasts',
	'setting.logout': 'how-long-each-lasts',
	'setting.logoutKeeps': 'how-long-each-lasts',
	'setting.attacker': 'what-stops-what',
	'setting.pkce': 'what-stops-what',
	'term.pkce': 'what-stops-what',
	'term.state': 'what-stops-what',
	'term.nonce': 'what-stops-what',
	'term.csrf': 'what-stops-what',
	'term.code-injection': 'what-stops-what',
	'setting.appRuns': 'where-the-tokens-are',
	'term.spa': 'where-the-tokens-are',
	'term.bff': 'where-the-tokens-are',
	'term.xss': 'where-the-tokens-are',
	'term.web-storage': 'where-the-tokens-are',
	'term.worker': 'where-the-tokens-are',
	'term.oauth': 'what-each-spec-adds',
	'term.openid-connect': 'what-each-spec-adds',
	'term.authn-authz': 'what-each-spec-adds',
	'setting.oidc': 'what-each-spec-adds',
	'term.realm': 'what-is-in-a-token-here',
	'term.mfa': 'what-each-factor-proves',
	'term.passkey': 'what-each-factor-proves',
	'term.one-time-password': 'what-each-factor-proves',
	'artifact.password': 'what-a-thief-can-do'
};

/** Each picture, drawn for the state on screen in the words chosen. */
export function draw(id: PictureId, state: AppState, wording: Wording, say: Say): Picture {
	const realm = state.settings.companies
		? 'demo-companies'
		: state.settings.broker
			? 'demo-brokered'
			: state.settings.federation
				? 'in-a-directory'
				: 'demo';
	// Simple mode leaves out what is tied to advanced settings, as the maintainer decided on 2026-11-08.
	const keep = (opens: Opens | undefined) =>
		state.mode !== 'simple' || inSimpleMode(opens, state.settings);
	switch (id) {
		case 'refresh':
			return refreshPicture(state.settings, say);
		case 'who-knows-whom':
			return whoKnowsWhom(state.settings, say, wording, namesOn(state, wording));
		case 'trust-across-providers':
			return trustAcrossProviders(say, wording, namesOn(state, wording), keep);
		case 'how-an-api-trusts-a-token':
			return howAnApiTrustsAToken(say, realm);
		case 'which-token-is-for-whom':
			return whichTokenIsForWhom(state.settings, say, wording);
		case 'how-long-each-lasts':
			return howLongEachLasts(say, keep);
		case 'what-stops-what':
			return whatStopsWhat(say, keep);
		case 'where-the-tokens-are':
			return whereTheTokensAre(state.settings, say, wording, keep);
		case 'what-each-spec-adds':
			return whatEachSpecAdds(say, keep);
		case 'what-is-in-a-token-here':
			return whatIsInATokenHere();
		case 'what-each-factor-proves':
			return whatEachFactorProves(say);
		case 'what-a-thief-can-do':
			return whatAThiefCanDo(say, keep);
	}
}

/**
 * The picture an explanation has, if any, and only on the flow whose steps it opens. One about a
 * single server goes with that server's notes (ADR-015).
 */
export function pictureFor(state: AppState, wording: Wording): Picture | null {
	const explained = state.explained;
	if (!explained || state.flow !== 'authorization-code') return null;
	const id = PICTURE_OF[key(explained)];
	if (!id) return null;
	// Like the server's notes, it is in advanced mode only, and goes when they do (ADR-015).
	if (id === 'what-is-in-a-token-here' && (!state.serverNotes || state.mode !== 'advanced'))
		return null;
	return draw(id, state, wording, sayer(wording));
}
