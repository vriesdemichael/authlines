import {
	evaluate,
	type BaseFlow,
	type DiagramDef,
	type Preset,
	type Step
} from '#lib/flow/model.ts';
import {
	defaultSettings,
	normalize,
	settingDefs,
	settingIds,
	type Settings
} from '#lib/flow/settings.ts';
import type { RecordingIndex } from '#lib/recordings/format.ts';
import recorded from '#lib/recordings/recorded.json' with { type: 'json' };
import { isVendorSource, sources } from '#lib/sources/sources.ts';

export const recordedIndex: RecordingIndex = recorded;

export const settingsOf = (preset: Preset) =>
	normalize({ ...defaultSettings, ...preset.settings }).settings;

const distance = (preset: Preset, settings: Settings) =>
	settingIds.filter((id) => settingsOf(preset)[id] !== settings[id]).length;

/** The one real run for exactly these settings, if there is one. A recording is never adapted. */
export function recordingFor(base: BaseFlow, settings: Settings): Preset | null {
	return base.presets.find((preset) => distance(preset, settings) === 0) ?? null;
}

/** What to look at instead, when these settings have no recording. */
export function nearestRecordings(base: BaseFlow, settings: Settings, count = 2): Preset[] {
	return [...base.presets]
		.sort((a, b) => distance(a, settings) - distance(b, settings))
		.slice(0, count);
}

const dateOf = (base: BaseFlow, settings: Settings) => {
	const preset = recordingFor(base, settings);
	return (preset && recordedIndex.recordedOn?.[preset.id]) ?? recordedIndex.recordedAt;
};

export type Known =
	| { kind: 'recorded'; by: 'server' | 'demo'; keycloak: string; date: string }
	| { kind: 'copied'; text: string }
	| { kind: 'other-settings' }
	| { kind: 'spec'; source: string }
	| { kind: 'unchecked' };

// The lifelines a real identity provider stands behind. Everything else in a recording is the demo.
const SERVERS: ReadonlySet<string> = new Set(['idp', 'upstream']);

/** How we know a message looks the way it does. Steps with nothing on the wire have nothing to check. */
export function knownFrom(base: BaseFlow, step: Step, settings: Settings): Known | null {
	if (step.channel !== 'front' && step.channel !== 'back') return null;
	if (step.specOnly) return { kind: 'spec', source: step.specOnly };
	if (!recordedIndex.flows[base.id]?.steps.includes(step.id)) return { kind: 'unchecked' };
	if (!recordingFor(base, settings)) return { kind: 'other-settings' };
	if (step.recordedAs) return { kind: 'copied', text: step.recordedAs };
	return {
		kind: 'recorded',
		by: SERVERS.has(step.from) || SERVERS.has(step.to) ? 'server' : 'demo',
		keycloak: recordedIndex.keycloak,
		date: dateOf(base, settings)
	};
}

/** The specs behind what is on screen, and which real server it was checked against, and when. */
export function provenance(base: BaseFlow, flow: DiagramDef, settings: Settings) {
	const fromSettings = settingIds
		.filter((id) => settings[id] !== defaultSettings[id])
		.flatMap((id) => settingDefs[id].sources.map((ref) => ref.source));
	const specs = [...new Set([...flow.specs, ...fromSettings])].filter((id) => !isVendorSource(id));
	return {
		specs: specs.map((id) => sources[id].label),
		recorded: recordingFor(base, settings) !== null,
		// People talking cannot be recorded, so a diagram with them can claim its HTTP and no more.
		onlyItsHttp: flow.steps.some((step) => step.kind === 'human'),
		// No identity provider has any part in it, so naming one would claim what it never did.
		noServer: !evaluate(flow, settings).lifelines.some((line) => SERVERS.has(line.id)),
		keycloak: recordedIndex.keycloak,
		date: dateOf(base, settings)
	};
}
