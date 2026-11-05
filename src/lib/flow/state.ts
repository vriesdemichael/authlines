import { pathOf } from '#lib/flow/follow.ts';
import { terms } from '#lib/flow/glossary.ts';
import {
	evaluate,
	type BaseFlow,
	type DiagramId,
	type DiagramDef,
	type DiagramView
} from '#lib/flow/model.ts';
import {
	change,
	defaultSettings,
	normalize,
	settingDefs,
	settingIds,
	type Reset,
	type SettingDef,
	type SettingId,
	type Settings
} from '#lib/flow/settings.ts';
import { artifacts, type ArtifactId, type Mode } from '#lib/flow/vocabulary.ts';
import { DEFAULT_WORDING, wordings, type Wording } from '#lib/flow/wording.ts';
import {
	isVendorSource,
	nameSources,
	sources,
	type SourceId,
	type SourceRef
} from '#lib/sources/sources.ts';

/** A source someone opened from a setting, which is what says what it means here. */
export interface OpenSource {
	id: SourceId;
	/** None when it was opened from a party, which is about what it is called. */
	setting: SettingId | null;
	/** It was opened from what a step says, so that is what says what it means here. */
	fromStep?: boolean;
	section: string | null;
}

/** What someone asked to have explained, by clicking it. */
export type Explained =
	| { kind: 'lifeline'; id: string }
	| { kind: 'artifact'; id: ArtifactId }
	| { kind: 'setting'; id: SettingId }
	| { kind: 'term'; id: string };

export interface AppState {
	flow: string;
	diagram: DiagramId;
	mode: Mode;
	settings: Settings;
	step: string;
	source: OpenSource | null;
	explained: Explained | null;
	/** Whether to show what is specific to the server this was recorded from (ADR-015). */
	serverNotes: boolean;
	/** The settings put out of the way, to give the diagram the room, such as on a projector. */
	settingsHidden: boolean;
	/** The one party whose view to show, when it is not everyone's. */
	eyes: string | null;
	/** The one thing whose path through the diagram to light up. */
	follow: ArtifactId | null;
	/** Whose words to use, when someone chose. Otherwise the mode decides. */
	wording: Wording | null;
	/** All that is left to someone building this, in one list. */
	list: boolean;
	/** Every row at once, with the diagram given all the room, for a room full of people. */
	whole: boolean;
	/** Raw traffic large enough to read from the back of that room. */
	raw: boolean;
	/** On a phone, the diagram at its own size and moved sideways, instead of the strip (#15). */
	fullSize: boolean;
}

const diagramIds: readonly DiagramId[] = ['flow', 'setup'];
const SERVER_NOTES_PARAM = 'keycloak';
const SETTINGS_PANEL_PARAM = 'settings';
const EYES_PARAM = 'eyes';
const FOLLOW_PARAM = 'follow';
const WORDING_PARAM = 'say';
const FROM_A_STEP = 'step';
const LIST_PARAM = 'list';
const WHOLE_PARAM = 'whole';
const RAW_PARAM = 'raw';
const SIZE_PARAM = 'size';

/** One step can cite two sections of the same spec, which each say something different. */
export const refFor = (
	refs: readonly SourceRef[],
	source: string | null,
	section: string | null
): SourceRef | undefined =>
	refs.find((ref) => ref.source === source && ref.section === section) ??
	refs.find((ref) => ref.source === source);

const diagramOf = (base: BaseFlow, state: AppState) => base.diagrams[state.diagram];
const viewOf = (base: BaseFlow, state: AppState) =>
	evaluate(diagramOf(base, state), state.settings);
const onTheDiagram = (view: DiagramView, party: string | null) =>
	view.lifelines.some((line) => line.id === party) ? party : null;
const onTheWay = (view: DiagramView, thing: string | null): ArtifactId | null =>
	thing && Object.hasOwn(artifacts, thing) && pathOf(view, thing as ArtifactId).length
		? (thing as ArtifactId)
		: null;

/** The requested step if it is on screen, otherwise the nearest earlier one that is (ADR-003). */
export function resolveStep(flow: DiagramDef, view: DiagramView, requested: string | null): string {
	const visible = new Set(view.steps.map((step) => step.id));
	const index = flow.steps.findIndex((step) => step.id === requested);
	for (let i = index; i >= 0; i--) {
		if (visible.has(flow.steps[i].id)) return flow.steps[i].id;
	}
	return view.steps[0].id;
}

function parseValue(def: SettingDef, raw: string | null): boolean | string {
	if (raw === null) return def.default;
	if (def.kind === 'toggle') return raw === '1';
	return def.options.some((option) => option.value === raw) ? raw : def.default;
}

/** A step belongs to one diagram, wherever the link was pointing. `setup=1` is what older links say. */
function diagramFor(base: BaseFlow, onPath: DiagramId, params: URLSearchParams): DiagramId {
	const step = params.get('step');
	const holder = diagramIds.find((id) => base.diagrams[id].steps.some((s) => s.id === step));
	if (holder) return holder;
	return params.get('setup') === '1' ? 'setup' : onPath;
}

/** A link naming something that does not exist opens nothing, as other unknown values do. */
function parseSource(params: URLSearchParams, cited: readonly SourceRef[]): OpenSource | null {
	const asked = params.get('for');
	if (asked === FROM_A_STEP) {
		const ref = refFor(cited, params.get('source'), params.get('section'));
		if (!ref) return null;
		const section = sources[ref.source].textFile ? params.get('section') : null;
		return { id: ref.source, setting: null, section, fromStep: true };
	}
	const setting = settingIds.find((id) => settingDefs[id].param === asked) ?? null;
	if (asked && !setting) return null;
	const offered = setting ? settingDefs[setting].sources : nameSources;
	const ref = offered.find((r) => r.source === params.get('source'));
	if (!ref) return null;
	if (isVendorSource(ref.source) && params.get(SERVER_NOTES_PARAM) === 'off') return null;
	const section = sources[ref.source].textFile ? params.get('section') : null;
	return { id: ref.source, setting, section };
}

function parseExplained(base: BaseFlow, diagram: DiagramId, raw: string | null): Explained | null {
	const [kind, id] = (raw ?? '').split('.');
	if (kind === 'lifeline' && base.diagrams[diagram].lifelines.some((line) => line.id === id)) {
		return { kind, id };
	}
	if (kind === 'artifact' && Object.hasOwn(artifacts, id)) return { kind, id: id as ArtifactId };
	if (kind === 'setting' && settingIds.includes(id as SettingId)) {
		return { kind, id: id as SettingId };
	}
	if (kind === 'term' && Object.hasOwn(terms, id)) return { kind, id };
	return null;
}

/** With the server's notes left out, nothing here is about it, its words included (ADR-015). */
function parseWording(params: URLSearchParams): Wording | null {
	const asked = wordings.find((wording) => wording === params.get(WORDING_PARAM)) ?? null;
	return asked === 'keycloak' && params.get(SERVER_NOTES_PARAM) === 'off' ? null : asked;
}

/** A setting a link asked for that does not fit with the rest of it, so it was turned off (#177). */
export interface DroppedFromLink {
	setting: SettingId;
	/** What the link asked for, as a link writes it. */
	asked: string;
	because: string;
}

/**
 * What a link asked for and does not get, with why, read the way parseState reads it. Only what the
 * link itself named, because a setting it never mentioned was never asked for.
 */
export function droppedFromLink(base: BaseFlow, search: string): DroppedFromLink[] {
	const params = new URLSearchParams(search);
	const requested = Object.fromEntries(
		base.settings.map((id) => [id, parseValue(settingDefs[id], params.get(settingDefs[id].param))])
	) as Partial<Settings>;
	const { settings, resets } = normalize({ ...defaultSettings, ...requested });
	const said = new Set<SettingId>();
	return resets.flatMap(({ setting, because }) => {
		const param = settingDefs[setting].param;
		if (said.has(setting) || !params.has(param) || settings[setting] === requested[setting])
			return [];
		said.add(setting);
		return [{ setting, asked: `${param}=${params.get(param)}`, because }];
	});
}

export function parseState(base: BaseFlow, onPath: DiagramId, search: string): AppState {
	const params = new URLSearchParams(search);
	// A link can only ask for what this flow has, so the rest stay on their defaults.
	const requested = Object.fromEntries(
		base.settings.map((id) => [id, parseValue(settingDefs[id], params.get(settingDefs[id].param))])
	);
	const { settings } = normalize({ ...defaultSettings, ...requested });
	const diagram = diagramFor(base, onPath, params);
	const flow = base.diagrams[diagram];
	const view = evaluate(flow, settings);
	const step = resolveStep(flow, view, params.get('step'));
	return {
		flow: base.id,
		diagram,
		mode: params.get('mode') === 'advanced' ? 'advanced' : 'simple',
		settings,
		step,
		source: parseSource(params, view.steps.find(({ id }) => id === step)?.cites ?? []),
		explained: parseExplained(base, diagram, params.get('explain')),
		serverNotes: params.get(SERVER_NOTES_PARAM) !== 'off',
		settingsHidden: params.get(SETTINGS_PANEL_PARAM) === 'off',
		eyes: onTheDiagram(view, params.get(EYES_PARAM)),
		follow: onTheWay(view, params.get(FOLLOW_PARAM)),
		wording: parseWording(params),
		list: params.get(LIST_PARAM) === '1',
		whole: params.get(WHOLE_PARAM) === '1',
		raw: params.get(RAW_PARAM) === '1',
		fullSize: params.get(SIZE_PARAM) === 'full'
	};
}

/** Only what differs from the defaults goes in the URL, so links stay short. */
export function serializeState(base: BaseFlow, state: AppState): string {
	const params = new URLSearchParams();
	if (state.mode !== 'simple') params.set('mode', state.mode);
	for (const id of settingIds) {
		const value = state.settings[id];
		if (value === defaultSettings[id]) continue;
		params.set(settingDefs[id].param, typeof value === 'boolean' ? (value ? '1' : '0') : value);
	}
	if (state.step !== viewOf(base, state).steps[0].id) params.set('step', state.step);
	if (state.source) {
		params.set('source', state.source.id);
		if (state.source.fromStep) params.set('for', FROM_A_STEP);
		else if (state.source.setting) params.set('for', settingDefs[state.source.setting].param);
		if (state.source.section) params.set('section', state.source.section);
	}
	if (state.explained) params.set('explain', `${state.explained.kind}.${state.explained.id}`);
	if (!state.serverNotes) params.set(SERVER_NOTES_PARAM, 'off');
	if (state.settingsHidden) params.set(SETTINGS_PANEL_PARAM, 'off');
	if (state.eyes) params.set(EYES_PARAM, state.eyes);
	if (state.follow) params.set(FOLLOW_PARAM, state.follow);
	if (state.wording) params.set(WORDING_PARAM, state.wording);
	if (state.list) params.set(LIST_PARAM, '1');
	if (state.whole) params.set(WHOLE_PARAM, '1');
	if (state.raw) params.set(RAW_PARAM, '1');
	if (state.fullSize) params.set(SIZE_PARAM, 'full');
	return params.toString();
}

/** The same, on the address of a node, where what the node starts from would apply otherwise. */
export function serializeOnNode(base: BaseFlow, state: AppState): string {
	const params = new URLSearchParams(serializeState(base, state));
	params.set('mode', state.mode);
	params.set('step', state.step);
	return params.toString();
}

export function presetSearch(base: BaseFlow, settings: Partial<Settings>): string {
	const merged = normalize({ ...defaultSettings, ...settings }).settings;
	const flow = base.diagrams.flow;
	return serializeState(base, {
		flow: base.id,
		diagram: 'flow',
		mode: 'simple',
		settings: merged,
		step: resolveStep(flow, evaluate(flow, merged), null),
		source: null,
		explained: null,
		serverNotes: true,
		settingsHidden: false,
		eyes: null,
		follow: null,
		wording: null,
		list: false,
		whole: false,
		raw: false,
		fullSize: false
	});
}

export function withSetting<K extends SettingId>(
	base: BaseFlow,
	state: AppState,
	id: K,
	value: Settings[K]
): { state: AppState; resets: Reset[] } {
	const { settings, resets } = change(state.settings, id, value);
	const flow = diagramOf(base, state);
	const view = evaluate(flow, settings);
	const step = resolveStep(flow, view, state.step);
	return {
		state: {
			...state,
			settings,
			step,
			eyes: onTheDiagram(view, state.eyes),
			follow: onTheWay(view, state.follow)
		},
		resets
	};
}

/** Switching diagrams keeps the settings. A step only means something in its own diagram. */
export function withDiagram(
	base: BaseFlow,
	state: AppState,
	diagram: DiagramId,
	step: string | null = null
): AppState {
	const flow = base.diagrams[diagram];
	const view = evaluate(flow, state.settings);
	return {
		...state,
		diagram,
		step: resolveStep(flow, view, step),
		eyes: onTheDiagram(view, state.eyes),
		follow: onTheWay(view, state.follow),
		// A lifeline only means something in its own diagram.
		explained: state.explained?.kind === 'lifeline' ? null : state.explained
	};
}

export function withMode(state: AppState, mode: Mode): AppState {
	return { ...state, mode };
}

/** Leaving them out closes one product's own docs as well, so nothing about it stays on screen. */
export function withServerNotes(state: AppState, serverNotes: boolean): AppState {
	const closes = !serverNotes && state.source && isVendorSource(state.source.id);
	return {
		...state,
		serverNotes,
		source: closes ? null : state.source,
		wording: !serverNotes && state.wording === 'keycloak' ? null : state.wording
	};
}

export function withSettingsHidden(state: AppState, settingsHidden: boolean): AppState {
	return { ...state, settingsHidden };
}

export function withEyes(state: AppState, eyes: string | null): AppState {
	return { ...state, eyes };
}

export function withFollow(state: AppState, follow: ArtifactId | null): AppState {
	return { ...state, follow };
}

/**
 * The start of another flow, keeping what still applies and what was left there before. Where someone
 * was, whose view and what was open all belong to the flow they were in.
 */
export function stateInFlow(
	to: BaseFlow,
	from: BaseFlow,
	state: AppState,
	leftThere: Partial<Settings> = {}
): AppState {
	const shared = to.settings.filter((id) => from.settings.includes(id));
	const settings = normalize({
		...defaultSettings,
		...leftThere,
		...Object.fromEntries(shared.map((id) => [id, state.settings[id]]))
	}).settings;
	const flow = to.diagrams.flow;
	return {
		...state,
		flow: to.id,
		diagram: 'flow',
		settings,
		step: evaluate(flow, settings).steps[0].id,
		source: null,
		explained: null,
		eyes: null,
		follow: null
	};
}

export function withWhole(state: AppState, whole: boolean): AppState {
	return {
		...state,
		whole,
		raw: whole ? false : state.raw,
		fullSize: whole ? false : state.fullSize
	};
}

/** Every row fitted and the diagram at its own size are two ways out of the strip, so only one. */
export function withFullSize(state: AppState, fullSize: boolean): AppState {
	return { ...state, fullSize, whole: fullSize ? false : state.whole };
}

export function withRaw(state: AppState, raw: boolean): AppState {
	return { ...state, raw, whole: raw ? false : state.whole, source: raw ? null : state.source };
}

/** They both go beside the diagram, so only one is open. */
export function withList(state: AppState, list: boolean): AppState {
	return { ...state, list, source: list ? null : state.source };
}

export function withWording(state: AppState, wording: Wording | null): AppState {
	return { ...state, wording };
}

export const wordingOf = (state: Pick<AppState, 'mode' | 'wording'>): Wording =>
	state.wording ?? DEFAULT_WORDING;

export function withExplained(state: AppState, explained: Explained | null): AppState {
	return { ...state, explained };
}

export function withSourceOpen(
	state: AppState,
	setting: SettingId | null,
	ref: SourceRef,
	fromStep = false
): AppState {
	const section = ref.section ?? null;
	const source = { id: ref.source, setting, section };
	return { ...state, list: false, source: fromStep ? { ...source, fromStep } : source };
}

export function withSourceSection(state: AppState, section: string | null): AppState {
	return state.source ? { ...state, source: { ...state.source, section } } : state;
}

export function withSourceClosed(state: AppState): AppState {
	return { ...state, source: null };
}

export function nextStep(base: BaseFlow, state: AppState): AppState | null {
	const steps = viewOf(base, state).steps;
	const index = steps.findIndex((step) => step.id === state.step);
	return index < steps.length - 1 ? { ...state, step: steps[index + 1].id } : null;
}

export function previousStep(base: BaseFlow, state: AppState): AppState | null {
	const steps = viewOf(base, state).steps;
	const index = steps.findIndex((step) => step.id === state.step);
	return index > 0 ? { ...state, step: steps[index - 1].id } : null;
}
