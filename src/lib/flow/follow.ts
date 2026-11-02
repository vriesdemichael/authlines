import type { DiagramView } from '#lib/flow/model.ts';
import { artifacts, type ArtifactId } from '#lib/flow/vocabulary.ts';

/** Two forms of one thing, which take different paths and only make sense together. */
const TOGETHER: Partial<Record<ArtifactId, readonly ArtifactId[]>> = {
	verifier: ['verifier', 'challenge'],
	challenge: ['verifier', 'challenge']
};

export const formsOf = (artifact: ArtifactId): readonly ArtifactId[] =>
	TOGETHER[artifact] ?? [artifact];

/**
 * Where something turns out to have been used up, which the fields cannot say. Only what a recording
 * backs goes here, and a test holds each one to it.
 */
export const USED_UP: Partial<Record<ArtifactId, { step: string; says: string }>> = {
	code: { step: 'real-app-refused', says: 'Refused here: a real server counted it as used' }
};

/** A step on the way, and what happens to the thing there. */
export interface Stop {
	step: string;
	says: string;
}

const named = (forms: readonly ArtifactId[], here: readonly ArtifactId[], says: string) => {
	if (here.length === forms.length) return says;
	const label = artifacts[here[0]].label;
	return `${label[0].toUpperCase()}${label.slice(1)}: ${says.toLowerCase()}`;
};

/** The path of one thing through a diagram, from the fields on its steps and never written by hand. */
export function pathOf(view: DiagramView, artifact: ArtifactId): Stop[] {
	const forms = formsOf(artifact);
	const usedUp = USED_UP[artifact];
	const seen = new Set<ArtifactId>();
	const stops: Stop[] = [];
	for (const step of view.steps) {
		const here = forms.filter((form) => step.fields.some((field) => field.artifact === form));
		const ended = forms.filter((form) => step.ends.includes(form));
		if (step.id === usedUp?.step) {
			stops.push({ step: step.id, says: usedUp.says });
		} else if (ended.length) {
			stops.push({ step: step.id, says: named(forms, ended, 'Ends here') });
		} else if (here.length) {
			const isNew = here.some((form) => !seen.has(form));
			const inside = step.kind === 'internal';
			const says = inside
				? isNew
					? 'Made here'
					: 'Checked here'
				: isNew
					? 'First sent here'
					: 'Sent here';
			stops.push({ step: step.id, says: named(forms, here, says) });
		}
		for (const form of here) seen.add(form);
	}
	return stops;
}
