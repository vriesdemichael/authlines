import { flows } from '#lib/flow/index.ts';
import { evaluate } from '#lib/flow/model.ts';
import { normalize, type Settings } from '#lib/flow/settings.ts';
import { artifacts, type ArtifactId } from '#lib/flow/vocabulary.ts';
import { nameIn, type Say, type Wording } from '#lib/flow/wording.ts';
import { bottomOf, keyAt, markAt, opensAt, presetDrawing, textAt } from './build.ts';
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

/** What each is, for someone who has not met it before, in the words its explanation uses. */
const IS: Partial<Record<ArtifactId, string>> = {
	code: 'Brought back by the browser after the login, and traded once for tokens.',
	'access-token': 'What the app shows the API to be let in.',
	'id-token': 'Tells the app who logged in.',
	'refresh-token': 'Gets the app a new access token, without the user.',
	session: 'A cookie by which the identity provider remembers this browser.'
};

/**
 * Who makes each token, who it goes through, and who never sees it, worked out from the steps the
 * way "seen so far" is, so it cannot say anything the arrows do not. Beside it, who each is made for.
 * Token types are among the confusions people report most, and each one is explained apart.
 */
export function whichTokenIsForWhom(settings: Settings, say: Say, wording: Wording): Picture {
	// With OpenID Connect, which adds the ID token, unless that would turn something on screen off.
	const withIdToken = normalize({ ...settings, oidc: true });
	const adds = !settings.oidc && withIdToken.resets.length === 0;
	const shown = adds ? withIdToken.settings : settings;
	const view = evaluate(flows['authorization-code'].diagrams.flow, shown);
	const extra: Partial<Settings> = shown.oidc ? { oidc: true } : {};
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
	// A party that sees none of these has nothing to say here, such as an API behind the first.
	const parties = view.lifelines.filter(
		(line) => line.id !== 'attacker' && rows.some((token) => first.has(`${line.id}:${token}`))
	);

	const W = 800;
	const NAME = { left: 10, w: 200 };
	const FOR = { left: 220, w: 150 };
	const COLUMNS = { left: 380, right: 790 };
	const column = (COLUMNS.right - COLUMNS.left) / parties.length;

	// The key first, drawn with the circles below, so nothing has to be matched up from words.
	const key = keyAt('key', 10, 8, 780, [
		{ mark: 'full', says: say('Makes it') },
		{ mark: 'empty', says: say('Is sent it, or sends it on') },
		{ mark: 'none', says: say('Never sees it') }
	]);
	const parts: PicturePart[] = [...key.parts];
	const headTop = 8 + key.h + 12;
	const heads = [
		textAt('made-for-head', FOR.left, headTop, FOR.w, say('Made for'), { size: 'more' }),
		...parties.map((line, i) =>
			textAt(
				`head-${line.id}`,
				COLUMNS.left + i * column + 4,
				headTop,
				column - 8,
				nameIn(line, wording),
				{
					size: 'more',
					align: 'middle'
				}
			)
		)
	];
	// Every heading sits on the line under the headings, however many lines it takes.
	const headBottom = Math.max(...heads.map(bottomOf));
	parts.push(...heads.map((head) => ({ ...head, y: headBottom - head.h / 2 })));
	const lines: PictureLine[] = [];
	let top = headBottom + 8;
	lines.push({ d: `M10 ${top} H${W - 10}`, bare: true, faint: true });
	for (const token of rows) {
		const label = artifacts[token].label;
		const name = textAt(
			`name-${token}`,
			NAME.left,
			top + 8,
			NAME.w,
			label[0].toUpperCase() + label.slice(1),
			{
				opens: at(first.get(`${made.get(token)}:${token}`)!)
			}
		);
		const is = textAt(`is-${token}`, NAME.left, bottomOf(name) + 2, NAME.w, say(IS[token]!), {
			size: 'more'
		});
		const height = bottomOf(is) - top + 10;
		const y = top + height / 2;
		const madeFor = textAt(`for-${token}`, FOR.left, top + 8, FOR.w, say(MADE_FOR[token]!), {
			size: 'more'
		});
		parts.push(name, is, { ...madeFor, y: y });
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
		top += height;
		lines.push({ d: `M10 ${top} H${W - 10}`, bare: true, faint: true });
	}
	const bottom = top;
	const note = textAt(
		'note',
		10,
		bottom + 12,
		780,
		say(
			adds
				? 'Worked out from the steps for these settings, with OpenID Connect on, which adds the ID token.'
				: shown.oidc
					? 'Worked out from the steps for these settings.'
					: 'Worked out from the steps for these settings, where OpenID Connect would turn something off, so there is no ID token.'
		),
		{ size: 'more' }
	);
	parts.push(note);
	return {
		id: 'which-token-is-for-whom',
		title: say('Which token is for whom'),
		width: W,
		height: bottomOf(note) + 12,
		parts,
		lines
	};
}
