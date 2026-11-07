import { flows } from '#lib/flow/index.ts';
import { evaluate } from '#lib/flow/model.ts';
import type { AppState } from '#lib/flow/state.ts';
import { nameIn, sayer, type Wording } from '#lib/flow/wording.ts';
import type { Picture } from './model.ts';
import { refreshPicture } from './refresh.ts';
import { whoKnowsWhom, type PartyNames } from './who-knows-whom.ts';

export type { Opens, Picture, PicturePart, PictureRow } from './model.ts';

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

/**
 * The picture an explanation has, if any. A concept gets one where a picture says in a glance what
 * would otherwise take a paragraph (#167), and only on the flow whose steps it opens.
 */
export function pictureFor(state: AppState, wording: Wording): Picture | null {
	const explained = state.explained;
	if (!explained || state.flow !== 'authorization-code') return null;
	const say = sayer(wording);
	const aboutRefresh =
		(explained.kind === 'artifact' && explained.id === 'refresh-token') ||
		(explained.kind === 'term' && explained.id === 'refresh-token') ||
		(explained.kind === 'setting' && explained.id === 'refresh');
	if (aboutRefresh) return refreshPicture(state.settings, say);
	const aboutTheProvider =
		(explained.kind === 'lifeline' && explained.id === 'idp') ||
		(explained.kind === 'term' && explained.id === 'identity-provider');
	if (aboutTheProvider) return whoKnowsWhom(state.settings, say, wording, namesOn(state, wording));
	return null;
}
