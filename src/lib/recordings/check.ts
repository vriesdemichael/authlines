import { pageShots, type ShotId } from '#lib/flow/vocabulary.ts';
import { noteDefs, type NoteDef } from '#lib/keycloak/notes.ts';
import type { FlagStatus, Recording } from '#lib/recordings/format.ts';
import { shapeDifferences, shapeOf } from '#lib/recordings/shape.ts';

/** Where what a note says it shows is not what the server did. */
function notAsSaid(said: unknown, did: unknown, where: string): string[] {
	if (said === null || typeof said !== 'object' || Array.isArray(said)) {
		return JSON.stringify(said) === JSON.stringify(did)
			? []
			: [`${where}: said ${JSON.stringify(said)}, and the server did ${JSON.stringify(did)}`];
	}
	if (did === null || typeof did !== 'object') {
		return [`${where}: said ${JSON.stringify(said)}, and the server did ${JSON.stringify(did)}`];
	}
	return Object.entries(said).flatMap(([key, value]) =>
		notAsSaid(value, (did as Record<string, unknown>)[key], `${where}.${key}`)
	);
}

/**
 * Whether what each note says still holds on this server. A note names a setting and where it is, so
 * a release that moves one or changes what it does has made that note false.
 */
export function evidenceDifferences(
	answers: Readonly<Record<string, unknown>>,
	notes: readonly NoteDef[] = noteDefs
): string[] {
	const inConsole = (answers.console ?? {}) as Record<string, { missing: string[] } | undefined>;
	return notes.flatMap((note) => {
		const { question, shows } = note.backedBy;
		const looked = inConsole[note.id];
		return [
			...notAsSaid(shows, answers[question], `${note.id}: ${question}`),
			...(!note.place
				? []
				: !looked
					? [`${note.id}: nobody looked for it in the admin console`]
					: looked.missing.map(
							(label) => `${note.id}: the admin console no longer shows "${label}"`
						))
		];
	});
}

export interface WhatARunFound {
	/** Each recording made now, with the one committed for the same named state. */
	recordings: readonly { committed: Recording; now: Recording }[];
	flags: { committed: Record<string, FlagStatus>; now: Record<string, FlagStatus> };
	answers: Readonly<Record<string, unknown>>;
}

/** What a run on this server found that differs from what the screen says. Nothing means no drift. */
/** The pages a person gets that this server no longer showed. Their pixels are not compared. */
export function pagesGone(seen: readonly ShotId[]): string[] {
	return pageShots
		.filter((shot) => !seen.includes(shot))
		.map((shot) => `The page "${shot}" no longer appears.`);
}

const sorted = (flags: Record<string, FlagStatus>) =>
	JSON.stringify(Object.entries(flags).sort(([a], [b]) => a.localeCompare(b)));

export function whatChanged({ recordings, flags, answers }: WhatARunFound): string[] {
	return [
		...recordings.flatMap(({ committed, now }) => {
			const differences = shapeDifferences(shapeOf(committed), shapeOf(now));
			return differences.length ? [`${now.preset} changed:`, ...differences] : [];
		}),
		...(sorted(flags.committed) === sorted(flags.now)
			? []
			: [`Feature flags changed: ${JSON.stringify(flags.now)}`]),
		...evidenceDifferences(answers)
	];
}
