import { error } from '@sveltejs/kit';
import { flows } from '#lib/flow/index.ts';
import type { DiagramId } from '#lib/flow/model.ts';
import { allNodes, type MapNode } from '#lib/map/nodes.ts';

const nodesOf = (flow: string) => allNodes.filter((node) => node.flow === flow);

export const entries = () =>
	Object.keys(flows).flatMap((flow) => [
		{ flow },
		{ flow, view: 'setup' },
		...nodesOf(flow).map((node) => ({ flow, view: node.id }))
	]);

interface Loaded {
	flowId: string;
	diagram: DiagramId;
	/** Set on the address of a named state, which is a state on this same screen (ADR-003). */
	node: MapNode | null;
}

export const load = ({ params }): Loaded => {
	if (!Object.hasOwn(flows, params.flow)) error(404);
	const flowId = params.flow;
	if (!params.view) return { flowId, diagram: 'flow', node: null };
	if (params.view === 'setup') return { flowId, diagram: 'setup', node: null };
	const node = nodesOf(flowId).find((candidate) => candidate.id === params.view);
	if (!node) error(404);
	return { flowId, diagram: node.diagram, node };
};
