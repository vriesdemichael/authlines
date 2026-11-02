import type { DiagramDef, DiagramView, ViewDiff } from '#lib/flow/model.ts';

/**
 * Both states on one diagram, for showing what a setting would do without doing it. Steps are one
 * ordered list (ADR-013), so what is in either has one place to go, and nothing has to be worked out.
 */
export function bothOf(flow: DiagramDef, before: DiagramView, after: DiagramView): DiagramView {
	const merged = <T extends { id: string }>(
		order: readonly { id: string }[],
		a: readonly T[],
		b: readonly T[]
	): T[] =>
		// One place each, though a lifeline can be there twice, with a different name in each state.
		[...new Set(order.map(({ id }) => id))].flatMap(
			(id) => b.find((item) => item.id === id) ?? a.find((item) => item.id === id) ?? []
		);
	return {
		steps: merged(flow.steps, before.steps, after.steps),
		lifelines: merged(flow.lifelines, before.lifelines, after.lifelines),
		groups: merged(flow.groups, before.groups, after.groups),
		parts: after.parts
	};
}

const count = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** What a setting would do, in the words of the diagram it would do it to. */
export function whatItWouldDo(diff: ViewDiff): string {
	const changed = new Set([
		...diff.addedFields.map(({ step }) => step),
		...diff.removedFields.map(({ step }) => step),
		...diff.rewordedSteps
	]);
	const parts = [
		diff.addedLifelines.length && `adds ${count(diff.addedLifelines.length, 'lifeline')}`,
		diff.removedLifelines.length && `removes ${count(diff.removedLifelines.length, 'lifeline')}`,
		diff.addedSteps.length && `adds ${count(diff.addedSteps.length, 'step')}`,
		diff.removedSteps.length && `removes ${count(diff.removedSteps.length, 'step')}`,
		changed.size && `changes ${count(changed.size, 'message')}`
	].filter(Boolean);
	if (!parts.length) return 'Changes nothing on this diagram.';
	const said = parts.join(', ');
	return `${said[0].toUpperCase()}${said.slice(1)}.`;
}
