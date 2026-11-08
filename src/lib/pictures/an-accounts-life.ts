import type { Say } from '#lib/flow/wording.ts';
import { opensAsRecorded, opensAt, textAt } from './build.ts';
import {
	heightFor,
	type Opens,
	type Picture,
	type PictureLine,
	type PicturePart
} from './model.ts';
import { keepAll, type Keep } from './simple.ts';

/**
 * An account's life at the identity provider (#200): made at a first login through another
 * provider, found again at each one after, linked to an account somewhere else, and left on when
 * someone's company turns theirs off, as the recorded runs found. Deleting one is not drawn.
 */
export function anAccountsLife(say: Say, keep: Keep = keepAll): Picture {
	const W = 760;
	const L = 250; // its life, down the left
	const R = 590; // what can happen beside it
	const MAIN_W = 340;
	const SIDE_W = 300;
	const broker = (step: string) => opensAt('flow', step, 'broker', { broker: true });
	const leaves = (step: string) =>
		opensAsRecorded('flow', step, 'companies-leaves', {
			broker: true,
			companies: true,
			customerSpeaks: 'saml',
			leaves: true
		});
	const linked = opensAt('flow', 'link-store', 'link-account', { linkAccount: true });

	const parts: PicturePart[] = [];
	const lines: PictureLine[] = [];
	// The bottom of the last box down the left, where the next line starts, and of anything beside it.
	let y = 8;
	let clear = 8;
	// One box after another down the left, each joined to the last.
	const next = (
		id: string,
		shape: 'ends' | 'step',
		says: string[],
		more: string[],
		opens?: Opens
	) => {
		const h = heightFor(says.length, more.length);
		const top = parts.length ? Math.max(y + 36, clear + 20) : y;
		if (parts.length) lines.push({ d: `M${L} ${y} V${top}` });
		parts.push({ id, shape, x: L, y: top + h / 2, w: MAIN_W, h, says, more, opens });
		y = top + h;
		clear = y;
	};
	// Beside the last box, joined to it from the right.
	const beside = (id: string, says: string[], more: string[], opens: Opens) => {
		if (!keep(opens)) return;
		const at = parts.filter((part) => part.x === L).at(-1)!;
		const h = heightFor(says.length, more.length);
		parts.push({ id, shape: 'step', x: R, y: at.y, w: SIDE_W, h, says, more, opens });
		lines.push({ d: `M${L + MAIN_W / 2} ${at.y} H${R - SIDE_W / 2}` });
		clear = Math.max(clear, at.y + h / 2);
	};

	next(
		'first-login',
		'ends',
		['Their first login,', 'through another provider'],
		[],
		broker('upstream-callback')
	);
	next(
		'made',
		'step',
		['An account is made for them here'],
		['From what the other provider', 'sent about them'],
		broker('match-user')
	);
	next(
		'found-again',
		'step',
		['Each login after finds it again'],
		['Whether their details are copied', 'again is a setting for that provider'],
		broker('match-user')
	);
	beside(
		'linked',
		['They link another account'],
		['Logged in already, they add one', 'at another provider, whose', 'tokens are kept with it'],
		linked
	);
	if (keep(leaves('company-turns-off'))) {
		next(
			'turned-off',
			'step',
			['Their company turns theirs off'],
			['At its own provider. Nothing here', 'was set up to hear about it.'],
			leaves('company-turns-off')
		);
		next(
			'stays-on',
			'ends',
			['Here, the account stays on'],
			[
				'The token the app has works until it runs out.',
				'A refresh and a new login work while the',
				'session lasts. Without one, their company',
				'refuses them.'
			],
			leaves('left-refresh-response')
		);
	}

	const note = textAt(
		'note',
		10,
		clear + 16,
		740,
		say('Each part is from a recorded run, and opens it. Deleting an account is not drawn.'),
		{ size: 'more' }
	);
	parts.push(note);
	return {
		id: 'an-accounts-life',
		title: say('An account’s life'),
		width: W,
		height: note.y + note.h / 2 + 12,
		parts: parts.map((part) =>
			part.shape === 'text'
				? part
				: { ...part, says: part.says.map(say), more: part.more?.map(say) }
		),
		lines
	};
}
