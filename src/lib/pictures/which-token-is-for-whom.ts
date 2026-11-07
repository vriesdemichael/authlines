import { flows } from '#lib/flow/index.ts';
import { evaluate } from '#lib/flow/model.ts';
import { normalize, type Settings } from '#lib/flow/settings.ts';
import { artifacts, type ArtifactId } from '#lib/flow/vocabulary.ts';
import { nameIn, type Say, type Wording } from '#lib/flow/wording.ts';
import { markAt, opensAt, presetDrawing, textAt } from './build.ts';
import type { Picture, PictureLine, PicturePart } from './model.ts';

/** What each is made for, in the words its own explanation uses. */
const MADE_FOR: Partial<Record<ArtifactId, string>> = {
	code: 'The identity provider, which it goes back to once',
	'access-token': 'The API, to read',
	'id-token': 'The app, to read',
	'refresh-token': 'The identity provider, and nothing else',
	session: 'The identity provider, from this browser'
};
const TOKENS = Object.keys(MADE_FOR) as ArtifactId[];

/**
 * Who makes each token, who it goes through, and who never sees it, worked out from the steps the
 * way "seen so far" is, so it cannot say anything the arrows do not. Beside it, who each is made for.
 * Token types are among the confusions people report most, and each one is explained apart.
 */
export function whichTokenIsForWhom(settings: Settings, say: Say, wording: Wording): Picture {
	// With OpenID Connect, because the ID token is half of the question.
	const shown = normalize({ ...settings, oidc: true }).settings;
	const view = evaluate(flows['authorization-code'].diagrams.flow, shown);
	const parties = view.lifelines.filter((line) => line.id !== 'attacker');
	const extra: Partial<Settings> = { oidc: true };
	// Each cell opens the recording closest to the screen that draws its step.
	// Without OpenID Connect where nothing recorded has it with these settings.
	const at = (step: string) => {
		const withIt = presetDrawing(step, shown, extra);
		if (withIt) return opensAt('flow', step, withIt, extra);
		const without = presetDrawing(step, shown);
		return without ? opensAt('flow', step, without) : undefined;
	};

	const made = new Map<ArtifactId, string>();
	const first = new Map<string, string>();
	for (const step of view.steps) {
		for (const { artifact } of step.fields) {
			if (!artifact || !TOKENS.includes(artifact)) continue;
			if (!made.has(artifact)) made.set(artifact, step.from);
			for (const party of [step.from, step.to]) {
				if (!first.has(`${party}:${artifact}`)) first.set(`${party}:${artifact}`, step.id);
			}
		}
	}
	const rows = TOKENS.filter((token) => made.has(token));

	const W = 800;
	const NAME = { left: 10, w: 130 };
	const FOR = { left: 150, w: 210 };
	const COLUMNS = { left: 380, right: 790 };
	const column = (COLUMNS.right - COLUMNS.left) / parties.length;
	const HEAD = 52;
	const ROW = 44;
	const top = 14;

	// Every heading sits on the line under the headings, however many lines it takes.
	const onTheLine = (part: PicturePart): PicturePart => ({
		...part,
		y: top + HEAD - 8 - part.h / 2
	});
	const parts: PicturePart[] = [
		onTheLine(textAt('made-for-head', FOR.left, top, FOR.w, say('Made for'), { size: 'more' }))
	];
	parties.forEach((line, i) => {
		parts.push(
			onTheLine(
				textAt(
					`head-${line.id}`,
					COLUMNS.left + i * column + 4,
					top,
					column - 8,
					nameIn(line, wording),
					{
						size: 'more',
						align: 'middle'
					}
				)
			)
		);
	});
	const lines: PictureLine[] = [];
	rows.forEach((token, r) => {
		const y = top + HEAD + r * ROW + ROW / 2;
		lines.push({ d: `M10 ${y - ROW / 2} H${W - 10}`, bare: true, faint: true });
		const label = artifacts[token].label;
		parts.push(
			textAt(`name-${token}`, NAME.left, y - 9, NAME.w, label[0].toUpperCase() + label.slice(1), {
				opens: at(first.get(`${made.get(token)}:${token}`)!)
			}),
			textAt(`for-${token}`, FOR.left, y - 8, FOR.w, say(MADE_FOR[token]!), { size: 'more' })
		);
		parties.forEach((line, i) => {
			const x = COLUMNS.left + i * column + column / 2;
			const step = first.get(`${line.id}:${token}`);
			const who = nameIn(line, wording);
			if (made.get(token) === line.id) {
				parts.push(
					markAt(`${token}.${line.id}`, x, y, 'full', `${who} makes the ${label}`, at(step!))
				);
			} else if (step) {
				parts.push(
					markAt(
						`${token}.${line.id}`,
						x,
						y,
						'empty',
						`${who} is sent the ${label}, or sends it on`,
						at(step)
					)
				);
			} else {
				parts.push(markAt(`${token}.${line.id}`, x, y, 'none', `${who} never sees the ${label}`));
			}
		});
	});
	const bottom = top + HEAD + rows.length * ROW;
	lines.push({ d: `M10 ${bottom} H${W - 10}`, bare: true, faint: true });
	const legend = textAt(
		'legend',
		10,
		bottom + 14,
		780,
		say('Filled: makes it. Open: is sent it, or sends it on. A dash: never sees it.'),
		{ size: 'more' }
	);
	const note = textAt(
		'note',
		10,
		bottom + 32,
		780,
		say(
			settings.oidc
				? 'Worked out from the steps for these settings.'
				: 'Worked out from the steps for these settings, with OpenID Connect on, which adds the ID token.'
		),
		{ size: 'more' }
	);
	parts.push(legend, note);
	return {
		id: 'which-token-is-for-whom',
		title: say('Which token is for whom'),
		width: W,
		height: bottom + 60,
		parts,
		lines
	};
}
