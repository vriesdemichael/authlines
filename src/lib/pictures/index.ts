import type { AppState } from '#lib/flow/state.ts';
import type { Say } from '#lib/flow/wording.ts';
import type { Picture } from './model.ts';
import { refreshPicture } from './refresh.ts';

export type { Opens, Picture, PicturePart } from './model.ts';

/**
 * The picture an explanation has, if any. A concept gets one where a picture says in a glance what
 * would otherwise take a paragraph (#167), and only on the flow whose steps it opens.
 */
export function pictureFor(state: AppState, say: Say): Picture | null {
	const explained = state.explained;
	if (!explained || state.flow !== 'authorization-code') return null;
	const aboutRefresh =
		(explained.kind === 'artifact' && explained.id === 'refresh-token') ||
		(explained.kind === 'term' && explained.id === 'refresh-token') ||
		(explained.kind === 'setting' && explained.id === 'refresh');
	return aboutRefresh ? refreshPicture(state.settings, say) : null;
}
