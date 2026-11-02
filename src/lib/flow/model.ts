import {
	defaultSettings,
	holds,
	settingsIn,
	type Condition,
	type SettingId,
	type Settings
} from '#lib/flow/settings.ts';
import type { ArtifactId, Channel, LifelineIcon, ShotId } from '#lib/flow/vocabulary.ts';
import type { SourceId, SourceRef } from '#lib/sources/sources.ts';

/** Text that varies with the settings. The first case that holds wins. */
export type Text = string | readonly { when?: Condition; text: string }[];

/** A name this goes by, who calls it that, and where they say so. */
export interface KnownAs {
	word: string;
	by: string;
	source: SourceRef;
}

export interface LifelineDef {
	id: string;
	/** What it is called in plain words, which need no explaining first. */
	plainName: string;
	plainRole: string;
	/** What the docs will call it, with what it is in plain words under that. */
	name: Text;
	role: Text;
	knownAs?: readonly KnownAs[];
	concept: Text;
	icon: LifelineIcon;
	/** Messages to or from this lifeline travel through the browser. */
	front?: boolean;
	/** What it knows before the diagram starts. */
	startsWith?: readonly { artifact: ArtifactId; when?: Condition }[];
	when?: Condition;
}

export interface GroupDef {
	id: string;
	plain: string;
	label: string;
	when?: Condition;
}

export type StepKind = 'request' | 'response' | 'internal' | 'human' | 'time';

export interface FieldDef {
	name: string;
	place: 'query' | 'header' | 'body' | 'token' | 'setting' | 'path' | 'memory';
	note?: string;
	/** The credential or token this field carries, which the diagram draws on the message. */
	artifact?: ArtifactId;
	/** Drawn on the message under this name, for what looks like one of those and is not. */
	chip?: string;
	when?: Condition;
}

export type DiagramId = 'flow' | 'setup';

/** A way from a step to a related one in the other diagram. */
export interface StepLink {
	diagram: DiagramId;
	step: string;
	text: string;
	/** When the step it points at is only there with some settings. */
	when?: Condition;
}

/** What goes wrong here, for a message people actually run into trouble with. */
export interface PitfallDef {
	title: string;
	text: Text;
	/** The page someone gets when this goes wrong. */
	shot?: ShotId;
	shows?: string;
}

export interface Pitfall {
	title: string;
	text: string;
	shot?: ShotId;
	shows?: string;
}

/** What a person sees in their browser at this step, which is what "through the browser" means. */
export interface PageDef {
	/** The step whose request put this address in the address bar, as it was recorded. */
	address: string;
	/** What is on the page, for where there is no picture of it and for whoever cannot see one. */
	shows: string;
	/** A picture of the real page, which is only ever of one server's look (ADR-015). */
	shot?: ShotId;
	/** The part of the address that matters here. */
	marks?: readonly string[];
}

/** This step sends something, and what comes back is used later, so running it adds something. */
export interface ExecuteDef {
	/** The step the answer is on. */
	answer: string;
	when?: Condition;
}

/** A library or gateway someone can look at, and what it does about a step. */
export interface PracticeExample {
	name: string;
	url: string;
	/** Whether it does what the line says, or leaves it to whoever uses it. */
	does: boolean;
	text: string;
	when?: Condition;
}

/** Where something a step says comes from, because a claim about a spec has to say which one. */
export interface CiteDef extends SourceRef {
	when?: Condition;
}

export interface StepDef {
	id: string;
	from: string;
	to: string;
	kind: StepKind;
	/** What simple mode says, where `label` is what is on the wire. */
	plain: Text;
	label: Text;
	concept: Text;
	group?: string;
	pitfall?: PitfallDef;
	page?: PageDef;
	cites?: readonly CiteDef[];
	/** How it travels, where its lifelines alone would not say: someone's own browser, say. */
	channel?: Channel;
	/** What stops existing here, so that nobody holds it any more. */
	ends?: readonly ArtifactId[];
	/** What this means for someone building an app: who writes this part, and what is left to them. */
	inPractice?: Text;
	/** What comes up here and is bigger than anything on the diagram. Said after that. */
	largerJob?: string;
	/** What is true of real libraries, so that a line about what they do has something behind it. */
	practice?: readonly PracticeExample[];
	links?: readonly StepLink[];
	fields?: readonly FieldDef[];
	execute?: ExecuteDef;
	/** Where this comes from, when a real Keycloak did not do it and so it could not be recorded. */
	specOnly?: string;
	/** How this got here, when it is not a message of its own in the recording. */
	recordedAs?: string;
	when?: Condition;
}

/**
 * A named stretch of a diagram, and the reason its steps are there. It runs until the next part
 * starts, and steps are one ordered list, so where a step sits is what places it in a part.
 */
export interface PartDef {
	label: string;
	why: string;
	/** Its first step, whether or not that step is there under the current settings. */
	from: string;
}

/** Steps are one ordered list, so a toggle can only add, remove or reword, never reorder. */
export interface DiagramDef {
	id: string;
	title: string;
	/** What the switch between diagrams calls it, where the default would not be true. */
	named?: string;
	/** What it is about, in a few words beside the switch between diagrams. */
	caption: string;
	summary: string;
	/** Where someone new starts: what this is for, in their words. */
	intro: string;
	/** The specs this diagram rests on, whatever the settings. */
	specs: readonly SourceId[];
	lifelines: readonly LifelineDef[];
	groups: readonly GroupDef[];
	parts: readonly PartDef[];
	steps: readonly StepDef[];
}

/** A set of settings that has a recording, which is one real run (ADR-005). */
export interface Preset {
	id: string;
	title: string;
	settings: Partial<Settings>;
}

/**
 * What a visitor picks, such as the authorization code flow. It has two diagrams, because nobody in
 * the user flow does the setup. Its recordings and settings are its own, so one base flow cannot
 * claim what was only ever true of another.
 */
export interface BaseFlow {
	id: string;
	diagrams: Readonly<Record<DiagramId, DiagramDef>>;
	settings: readonly SettingId[];
	/** Why the others are not here, because a setting that just vanishes says nothing. */
	notHere?: Readonly<Partial<Record<SettingId, string>>>;
	presets: readonly Preset[];
}

export interface Lifeline {
	id: string;
	plainName: string;
	plainRole: string;
	name: string;
	role: string;
	knownAs: readonly KnownAs[];
	concept: string;
	icon: LifelineIcon;
	startsWith: ArtifactId[];
}

export interface Field {
	name: string;
	place: FieldDef['place'];
	note?: string;
	artifact?: ArtifactId;
	chip?: string;
	causes: SettingId[];
	/** Differs from the base flow, so the diagram shows it on the message itself. */
	changed: boolean;
}

export interface Step {
	id: string;
	from: string;
	to: string;
	kind: StepKind;
	channel: Channel;
	plain: string;
	label: string;
	concept: string;
	group?: string;
	pitfall?: Pitfall;
	page?: PageDef;
	cites: readonly SourceRef[];
	ends: readonly ArtifactId[];
	inPractice?: string;
	largerJob?: string;
	practice: readonly PracticeExample[];
	links: readonly StepLink[];
	fields: Field[];
	/** The step with the answer, when executing this one adds something. */
	execute?: string;
	specOnly?: string;
	recordedAs?: string;
	causes: SettingId[];
}

/** A part as it is under the current settings, with the steps that are there. */
export interface Part {
	label: string;
	why: string;
	steps: string[];
}

export interface DiagramView {
	lifelines: Lifeline[];
	steps: Step[];
	groups: GroupDef[];
	parts: Part[];
}

export function resolveText(text: Text, settings: Settings): string {
	if (typeof text === 'string') return text;
	const match = text.find((c) => !c.when || holds(c.when, settings));
	if (!match) throw new Error(`No text case holds: ${JSON.stringify(text)}`);
	return match.text;
}

function resolvePitfall(pitfall: PitfallDef, settings: Settings): Pitfall {
	return { ...pitfall, text: resolveText(pitfall.text, settings) };
}

const present = (when: Condition | undefined, settings: Settings) => !when || holds(when, settings);

/** What this is here because of: settings that were changed, and without which it would go. */
function causes(when: Condition | undefined, settings: Settings): SettingId[] {
	if (!when || holds(when, defaultSettings)) return [];
	const changed = settingsIn(when).filter((id) => settings[id] !== defaultSettings[id]);
	const needed = changed.filter((id) => !holds(when, { ...settings, [id]: defaultSettings[id] }));
	return needed.length ? needed : changed;
}

function channelOf(flow: DiagramDef, step: StepDef): Channel {
	if (step.channel) return step.channel;
	if (step.kind === 'human') return 'people';
	if (step.kind === 'internal' || step.kind === 'time') return 'internal';
	const front = flow.lifelines.some((l) => l.front && (l.id === step.from || l.id === step.to));
	return front ? 'front' : 'back';
}

function partsOf(flow: DiagramDef, steps: readonly Step[]): Part[] {
	const here = new Set(steps.map((step) => step.id));
	const parts: Part[] = [];
	for (const step of flow.steps) {
		const starts = flow.parts.find((part) => part.from === step.id);
		if (starts) parts.push({ label: starts.label, why: starts.why, steps: [] });
		if (!parts.length) throw new Error(`${step.id} comes before the first part of ${flow.id}`);
		if (here.has(step.id)) parts[parts.length - 1].steps.push(step.id);
	}
	return parts.filter((part) => part.steps.length);
}

export function evaluate(flow: DiagramDef, settings: Settings): DiagramView {
	const steps: Step[] = flow.steps
		.filter((step) => present(step.when, settings))
		.map((step) => ({
			id: step.id,
			from: step.from,
			to: step.to,
			kind: step.kind,
			ends: step.ends ?? [],
			channel: channelOf(flow, step),
			plain: resolveText(step.plain, settings),
			label: resolveText(step.label, settings),
			concept: resolveText(step.concept, settings),
			group: step.group,
			pitfall: step.pitfall && resolvePitfall(step.pitfall, settings),
			page: step.page,
			cites: (step.cites ?? []).filter((cite) => present(cite.when, settings)),
			inPractice:
				[step.inPractice && resolveText(step.inPractice, settings), step.largerJob]
					.filter(Boolean)
					.join(' ') || undefined,
			largerJob: step.largerJob,
			practice: (step.practice ?? []).filter((example) => present(example.when, settings)),
			links: (step.links ?? []).filter((link) => present(link.when, settings)),
			execute:
				step.execute && present(step.execute.when, settings) ? step.execute.answer : undefined,
			specOnly: step.specOnly,
			recordedAs: step.recordedAs,
			causes: causes(step.when, settings),
			fields: (step.fields ?? [])
				.filter((field) => present(field.when, settings))
				.map((field) => ({
					name: field.name,
					place: field.place,
					note: field.note,
					artifact: field.artifact,
					chip: field.chip,
					causes: causes(field.when, settings),
					changed: !present(field.when, defaultSettings)
				}))
		}));

	return {
		lifelines: flow.lifelines
			.filter((lifeline) => present(lifeline.when, settings))
			.map((lifeline) => ({
				id: lifeline.id,
				plainName: lifeline.plainName,
				plainRole: lifeline.plainRole,
				name: resolveText(lifeline.name, settings),
				role: resolveText(lifeline.role, settings),
				knownAs: lifeline.knownAs ?? [],
				concept: resolveText(lifeline.concept, settings),
				icon: lifeline.icon,
				startsWith: (lifeline.startsWith ?? [])
					.filter((held) => present(held.when, settings))
					.map((held) => held.artifact)
			})),
		steps,
		groups: flow.groups.filter((group) => present(group.when, settings)),
		parts: partsOf(flow, steps)
	};
}

/** What each lifeline has seen by the end of a step: what it started with, and what passed through it. */
export function holdingsAt(view: DiagramView, stepId: string): Record<string, ArtifactId[]> {
	const held = Object.fromEntries(view.lifelines.map((line) => [line.id, [...line.startsWith]]));
	const see = (line: string, artifact: ArtifactId) => {
		if (!held[line].includes(artifact)) held[line].push(artifact);
	};
	for (const step of view.steps) {
		for (const { artifact } of step.fields) {
			if (!artifact) continue;
			see(step.from, artifact);
			see(step.to, artifact);
		}
		for (const artifact of step.ends) {
			for (const line of Object.keys(held)) {
				held[line] = held[line].filter((seen) => seen !== artifact);
			}
		}
		if (step.id === stepId) break;
	}
	return held;
}

/** What a step adds to what each lifeline has seen, as `lifeline:artifact`. */
export function arrivalsAt(view: DiagramView, stepId: string): Set<string> {
	const at = view.steps.findIndex((step) => step.id === stepId);
	const before: Record<string, readonly ArtifactId[]> =
		at > 0
			? holdingsAt(view, view.steps[at - 1].id)
			: Object.fromEntries(view.lifelines.map((line) => [line.id, line.startsWith]));
	return new Set(
		Object.entries(holdingsAt(view, stepId)).flatMap(([line, held]) =>
			held.filter((artifact) => !before[line].includes(artifact)).map((a) => `${line}:${a}`)
		)
	);
}

export interface ViewDiff {
	addedSteps: string[];
	removedSteps: string[];
	addedLifelines: string[];
	removedLifelines: string[];
	renamedLifelines: string[];
	addedFields: { step: string; field: string }[];
	removedFields: { step: string; field: string }[];
	rewordedSteps: string[];
}

/** What a change of settings did to the diagram, which is what the transition has to show. */
export function diffViews(before: DiagramView, after: DiagramView): ViewDiff {
	const beforeSteps = new Map(before.steps.map((step) => [step.id, step]));
	const afterSteps = new Map(after.steps.map((step) => [step.id, step]));
	const beforeLines = new Map(before.lifelines.map((line) => [line.id, line]));
	const afterLines = new Map(after.lifelines.map((line) => [line.id, line]));
	const kept = after.steps.filter((step) => beforeSteps.has(step.id));
	const fieldsNotIn = (a: Step, b: Step) =>
		a.fields
			.filter((field) => !b.fields.some((other) => other.name === field.name))
			.map((field) => ({ step: a.id, field: field.name }));

	return {
		addedSteps: after.steps.filter((s) => !beforeSteps.has(s.id)).map((s) => s.id),
		removedSteps: before.steps.filter((s) => !afterSteps.has(s.id)).map((s) => s.id),
		addedLifelines: after.lifelines.filter((l) => !beforeLines.has(l.id)).map((l) => l.id),
		removedLifelines: before.lifelines.filter((l) => !afterLines.has(l.id)).map((l) => l.id),
		renamedLifelines: after.lifelines
			.filter((l) => {
				const line = beforeLines.get(l.id);
				return line && (line.role !== l.role || line.name !== l.name);
			})
			.map((l) => l.id),
		addedFields: kept.flatMap((step) => fieldsNotIn(step, beforeSteps.get(step.id)!)),
		removedFields: kept.flatMap((step) => fieldsNotIn(beforeSteps.get(step.id)!, step)),
		rewordedSteps: kept.filter((s) => beforeSteps.get(s.id)?.label !== s.label).map((s) => s.id)
	};
}

export function isEmptyDiff(diff: ViewDiff): boolean {
	return Object.values(diff).every((part) => part.length === 0);
}

/** Every setting this diagram does anything with, wherever in it that is. */
export function settingsUsedBy(diagram: DiagramDef): Set<string> {
	const used = new Set<string>();
	JSON.stringify(diagram, (key, value) => {
		// What a link depends on is the other diagram, so it does not make a setting do something here.
		if (key === 'links') return undefined;
		if (key === 'setting') used.add(value);
		return value;
	});
	return used;
}

/** What simple mode shows of a diagram: who is on it, what is said, and what gets passed around. */
const plainShape = (view: DiagramView) =>
	JSON.stringify([
		view.lifelines.map((line) => line.id),
		view.steps.map((step) => [
			step.id,
			step.plain,
			step.fields.flatMap((field) => field.artifact ?? [])
		])
	]);

/** Whether someone in simple mode would see anything change on this diagram. */
export function changesInPlainWords(flow: DiagramDef, before: Settings, after: Settings): boolean {
	return plainShape(evaluate(flow, before)) !== plainShape(evaluate(flow, after));
}
