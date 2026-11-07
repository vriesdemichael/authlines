import { flows } from '#lib/flow/index.ts';
import { evaluate, holdingsAt } from '#lib/flow/model.ts';
import { defaultSettings, normalize, settingDefs, type Settings } from '#lib/flow/settings.ts';
import { artifacts, type ArtifactId } from '#lib/flow/vocabulary.ts';
import { nameIn, type Say, type Wording } from '#lib/flow/wording.ts';
import { bottomOf, opensAt, partyBox, textAt, zone } from './build.ts';
import type { Picture, PicturePart } from './model.ts';

/** What is worth keeping from someone, of everything a party has seen. */
const WORTH: readonly ArtifactId[] = [
	'secret',
	'access-token',
	'id-token',
	'refresh-token',
	'app-session',
	'code',
	'session'
];

const CASES = [
	{
		runs: 'server',
		preset: 'oidc',
		why: 'Of these, the browser only sees the code, and its session at the identity provider. The app’s own session with it is yours, and not drawn.'
	},
	{ runs: 'page', preset: 'browser-app', why: 'A script in the page can reach what the page has.' },
	{
		runs: 'bff',
		preset: 'behind-the-page',
		why: 'The page has a cookie that no script can read, and the server has the tokens.'
	},
	{
		runs: 'program',
		preset: 'on-their-computer-oidc',
		why: 'On some systems, another program may be able to take a code sent to it.'
	}
] as const;

/** Each preset's flow, and what each party has seen by its end, worked out once. */
const seen = new Map<string, ReturnType<typeof work>>();
function work(id: string) {
	const base = flows['authorization-code'];
	const preset = base.presets.find((candidate) => candidate.id === id)!;
	const view = evaluate(
		base.diagrams.flow,
		normalize({ ...defaultSettings, ...preset.settings }).settings
	);
	return { preset, view, held: holdingsAt(view, view.steps.at(-1)!.id) };
}
const worked = (id: string) => {
	if (!seen.has(id)) seen.set(id, work(id));
	return seen.get(id)!;
};

/**
 * Where the tokens end up, for each answer to where the app runs, side by side and worked out from
 * each one's own steps. The user's computer and the app's server are two zones, and the one on
 * screen is marked. What a script in the page can reach is the point of three of the four.
 */
export function whereTheTokensAre(settings: Settings, say: Say, wording: Wording): Picture {
	const W = 800;
	const COLUMN = 190;
	const GAP = 10;
	const options = settingDefs.appRuns.kind === 'choice' ? settingDefs.appRuns.options : [];
	const parts: PicturePart[] = [];
	let height = 0;

	CASES.forEach((c, i) => {
		const left = 10 + i * (COLUMN + GAP);
		const { preset, view, held } = worked(c.preset);
		const listed = (id: string) =>
			WORTH.filter((artifact) => held[id]?.includes(artifact))
				.map((artifact) => artifacts[artifact].label)
				.join(', ');
		const current = (settings.appRuns ?? 'server') === c.runs;
		const label = options.find((option) => option.value === c.runs)?.label ?? c.runs;
		const opens = opensAt('flow', 'token-response', c.preset, preset.settings);
		const head = textAt(`head-${c.runs}`, left, 10, COLUMN, say(label), { size: 'title', opens });
		parts.push(head);

		const named = (id: string) => {
			const line = view.lifelines.find((candidate) => candidate.id === id);
			return line ? nameIn(line, wording) : id;
		};
		// The user's computer, with the browser, and the program or the page where the app is there.
		const computerTop = bottomOf(head) + 10;
		const inside: PicturePart[] = [];
		const appHere = c.runs === 'program';
		const browserTitle =
			c.runs === 'page' ? say('Browser, with the app in its page') : say(named('browser'));
		inside.push(
			partyBox(
				`${c.runs}.browser`,
				left + 10,
				computerTop + 28,
				COLUMN - 20,
				browserTitle,
				`${say('Has seen')}: ${listed('browser')}`,
				{ opens }
			)
		);
		if (appHere) {
			inside.push(
				partyBox(
					`${c.runs}.app`,
					left + 10,
					bottomOf(inside[0]) + 10,
					COLUMN - 20,
					say(named('app')),
					`${say('Has seen')}: ${listed('app')}`,
					{ opens }
				)
			);
		}
		const computerBottom = bottomOf(inside.at(-1)!) + 10;
		parts.push(
			zone(
				`${c.runs}.computer`,
				left,
				computerTop,
				COLUMN,
				computerBottom - computerTop,
				say("The user's computer"),
				current
			)
		);
		parts.push(...inside);

		// The app's own server, where it has one.
		const serverTop = computerBottom + 14;
		const onServer = c.runs === 'server' || c.runs === 'bff';
		const server = onServer
			? partyBox(
					`${c.runs}.server-app`,
					left + 10,
					serverTop + 28,
					COLUMN - 20,
					say(named('app')),
					`${say('Has seen')}: ${listed('app')}`,
					{ opens }
				)
			: textAt(
					`${c.runs}.no-server`,
					left + 12,
					serverTop + 30,
					COLUMN - 24,
					say('Nothing of the app’s runs here.'),
					{ size: 'more' }
				);
		const serverBottom = bottomOf(server) + 10;
		parts.push(
			zone(
				`${c.runs}.server`,
				left,
				serverTop,
				COLUMN,
				serverBottom - serverTop,
				say("The app's server"),
				current
			)
		);
		parts.push(server);

		const why = textAt(`${c.runs}.why`, left, serverBottom + 10, COLUMN, say(c.why), {
			size: 'more'
		});
		parts.push(why);
		height = Math.max(height, bottomOf(why));
	});
	const note = textAt(
		'note',
		10,
		height + 14,
		780,
		say(
			'The API has the same in all four. Each column is worked out from its own steps, with OpenID Connect where it was recorded.'
		),
		{ size: 'more' }
	);
	parts.push(note);
	return {
		id: 'where-the-tokens-are',
		title: say('Where the tokens are'),
		width: W,
		height: bottomOf(note) + 12,
		parts,
		lines: []
	};
}
