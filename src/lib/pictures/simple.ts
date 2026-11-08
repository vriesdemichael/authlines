import { flows } from '#lib/flow/index.ts';
import {
	defaultSettings,
	normalize,
	settingDefs,
	settingIds,
	simpleSettingIds,
	type Settings
} from '#lib/flow/settings.ts';
import { mapNodes, nodeSettings } from '#lib/map/nodes.ts';
import type { Opens } from './model.ts';

const pair = (id: string, value: unknown) => `${id}=${String(value)}`;

/**
 * What simple mode reaches: the settings it offers, with the options it keeps for advanced left out,
 * and what a question in simple mode turns on. Anything else is one press of Advanced away.
 */
const reached: ReadonlySet<string> = (() => {
	const pairs = new Set<string>();
	for (const id of simpleSettingIds) {
		const def = settingDefs[id];
		if (def.kind === 'toggle') {
			pairs.add(pair(id, true));
			pairs.add(pair(id, false));
		} else {
			for (const option of def.options) if (!option.advanced) pairs.add(pair(id, option.value));
		}
	}
	for (const node of mapNodes) {
		if (node.mode !== 'simple' || node.flow !== 'authorization-code') continue;
		const settings = nodeSettings(node);
		for (const id of settingIds) {
			if (settings[id] !== defaultSettings[id]) pairs.add(pair(id, settings[id]));
		}
	}
	return pairs;
})();

/** The settings a part is about: its recorded preset's, with what it adds. */
function settingsOf(opens: Opens): Settings {
	const preset = flows['authorization-code'].presets.find(({ id }) => id === opens.preset);
	return normalize({ ...defaultSettings, ...preset?.settings, ...opens.settings }).settings;
}

/** Whether a picture keeps a part, which is every part outside simple mode. */
export type Keep = (opens: Opens | undefined) => boolean;
export const keepAll: Keep = () => true;

/**
 * Whether simple mode keeps a part of a picture. The maintainer decided on 2026-11-08 that simple
 * mode leaves out what is tied to advanced settings, as it does everywhere else, so a part that opens
 * on what simple mode cannot reach is left out, and a part that opens nothing stays. What is on screen
 * stays too, because a setting someone has on stays in simple mode as a chip (ADR-004).
 */
export function inSimpleMode(
	opens: Opens | undefined,
	screen: Settings = defaultSettings
): boolean {
	if (!opens) return true;
	const settings = settingsOf(opens);
	return settingIds.every(
		(id) =>
			settings[id] === defaultSettings[id] ||
			settings[id] === screen[id] ||
			reached.has(pair(id, settings[id]))
	);
}
