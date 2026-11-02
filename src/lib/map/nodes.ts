import { flows } from '#lib/flow/index.ts';
import { evaluate, type DiagramDef } from '#lib/flow/model.ts';
import { defaultSettings, normalize, settingIds, type Settings } from '#lib/flow/settings.ts';
import { resolveStep, serializeState, type AppState } from '#lib/flow/state.ts';
import { mapNodes, mapTracks, type MapNode, type MapTrack } from '#lib/map/tracks.ts';

export { mapNodes, mapTracks, type MapNode, type MapTrack };

export function nodeSettings(of: MapNode): Settings {
	const preset = flows[of.flow].presets.find((candidate) => candidate.id === of.preset);
	if (!preset) throw new Error(`No named state ${of.preset}`);
	return normalize({ ...defaultSettings, ...preset.settings }).settings;
}

const diagramOf = (of: MapNode): DiagramDef => flows[of.flow].diagrams[of.diagram];

export function nodeState(of: MapNode): AppState {
	const settings = nodeSettings(of);
	const flow = diagramOf(of);
	return {
		flow: of.flow,
		diagram: of.diagram,
		mode: of.mode,
		settings,
		step: resolveStep(flow, evaluate(flow, settings), of.step ?? null),
		source: null,
		explained: null,
		serverNotes: true,
		settingsHidden: false,
		eyes: of.eyes ?? null,
		follow: null,
		wording: null,
		list: false,
		labels: false,
		whole: false,
		raw: false
	};
}

export const nodeView = (of: MapNode) => evaluate(diagramOf(of), nodeSettings(of));

/** The question to go on to, in the order the map lays them out. */
export const nextQuestion = (of: MapNode): MapNode | null =>
	mapNodes[mapNodes.indexOf(of) + 1] ?? null;

/** The state as a query, which a query on the address itself adds to. */
export function nodeSearch(of: MapNode, added = ''): string {
	const search = new URLSearchParams(serializeState(flows[of.flow], nodeState(of)));
	for (const [name, value] of new URLSearchParams(added)) search.set(name, value);
	return search.toString();
}

const sameSettings = (a: Settings, b: Settings) => settingIds.every((id) => a[id] === b[id]);

/** Whether what is on screen still answers this question, wherever someone has stepped to. */
export const stillAnswers = (of: MapNode, state: AppState) =>
	state.flow === of.flow &&
	state.diagram === of.diagram &&
	(of.eyes ?? null) === state.eyes &&
	sameSettings(nodeSettings(of), state.settings);

/** The node someone is at, going by what is on screen. Stepping through it is still being at it. */
export function nodeMatching(state: AppState): MapNode | null {
	// Only in the mode someone is in, because a question in the other one is not where they are.
	const same = mapNodes.filter(
		(candidate) =>
			candidate.flow === state.flow &&
			candidate.diagram === state.diagram &&
			candidate.mode === state.mode &&
			(candidate.eyes ?? null) === state.eyes &&
			sameSettings(nodeSettings(candidate), state.settings)
	);
	return same.find((candidate) => nodeState(candidate).step === state.step) ?? same[0] ?? null;
}
