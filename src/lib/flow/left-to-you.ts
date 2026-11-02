import { evaluate, type BaseFlow, type DiagramId, type Step } from '#lib/flow/model.ts';
import type { Settings } from '#lib/flow/settings.ts';
import { speak, type Say } from '#lib/flow/wording.ts';

export interface LeftItem {
	diagram: DiagramId;
	step: string;
	title: string;
	text: string;
}

export type LeftGroupId = 'before' | 'app' | 'api' | 'wrong';

export interface LeftGroup {
	id: LeftGroupId;
	title: string;
	items: LeftItem[];
}

export interface LeftToYou {
	/** What is bigger than anything on the diagram, said where it comes up. */
	larger: string | null;
	groups: LeftGroup[];
}

const TITLES: Readonly<Record<LeftGroupId, string>> = {
	before: 'Before anything runs',
	app: 'In your app',
	api: 'In your API',
	wrong: 'What can go wrong'
};

/** Whose job a step is, going by who is doing it, and an app showing something is the app's. */
function jobOf(step: Step, diagram: DiagramId): LeftGroupId {
	if (diagram === 'setup' && step.kind === 'human') return 'before';
	return step.from === 'api' ? 'api' : 'app';
}

const DIAGRAMS: readonly DiagramId[] = ['setup', 'flow'];

/**
 * All that the steps say is left to someone, in one place, because someone told to add login should
 * not have to copy it out of 24 steps. Nothing here is written for this list, so it can only say what
 * the steps do, and it follows the settings as they do.
 */
export function leftToYou(base: BaseFlow, settings: Settings, say: Say): LeftToYou {
	const groups: Record<LeftGroupId, LeftItem[]> = { before: [], app: [], api: [], wrong: [] };
	let larger: string | null = null;
	for (const diagram of DIAGRAMS) {
		const view = speak(evaluate(base.diagrams[diagram], settings), say);
		for (const step of view.steps) {
			const item = { diagram, step: step.id, title: step.plain };
			if (step.largerJob) larger = step.largerJob;
			const text = step.inPractice?.replace(step.largerJob ?? '', '').trim();
			if (text) groups[jobOf(step, diagram)].push({ ...item, text });
			if (step.pitfall) {
				groups.wrong.push({ ...item, title: step.pitfall.title, text: step.pitfall.text });
			}
		}
	}
	return {
		larger,
		groups: (Object.keys(TITLES) as LeftGroupId[])
			.map((id) => ({ id, title: TITLES[id], items: groups[id] }))
			.filter(({ items }) => items.length)
	};
}
