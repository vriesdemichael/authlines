import type { Settings } from '#lib/flow/settings.ts';
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

interface Check {
	id: string;
	asks: string[];
	/** Where the answer that is not Yes leads, as the recorded demo API answered. */
	refused: { says: string[]; more: string[]; opens: Opens };
}

/**
 * What an API does with a request (#167's flowchart, and the start of #200's gap 2, where a decision
 * is made): each check the API makes on the token, each refusal as the recorded demo API answered,
 * and then what no token answers, which is your own code's. A 401 means a new token may help, and a
 * 403 that it usually will not, as the step's pitfall says.
 */
export function whatTheApiDoes(say: Say, keep: Keep = keepAll): Picture {
	const W = 760;
	const L = 250;
	const R = 590;
	const ASK_W = 250;
	const ASK_H = 74;
	const END_W = 280;
	const refused = (preset: string, apiToken: Settings['apiToken']) =>
		opensAsRecorded('flow', 'api-response', preset, { apiToken });
	const checks: Check[] = [
		{
			id: 'has-token',
			asks: ['Has it a token?'],
			refused: {
				says: ['401'],
				more: ['With WWW-Authenticate: Bearer,', 'and nothing more'],
				opens: refused('api-no-token', 'none')
			}
		},
		{
			id: 'signature',
			asks: ['Is its signature', 'right?'],
			refused: {
				says: ['401 invalid_token'],
				more: ['“bad signature”'],
				opens: refused('api-changed', 'changed')
			}
		},
		{
			id: 'in-time',
			asks: ['Has it time left?'],
			refused: {
				says: ['401 invalid_token'],
				more: ['“expired”'],
				opens: refused('api-expired', 'expired')
			}
		},
		{
			id: 'for-this-api',
			asks: ['Is it for', 'this API?'],
			refused: {
				says: ['401 invalid_token'],
				more: ['“not for this API”'],
				opens: refused('api-elsewhere', 'elsewhere')
			}
		},
		{
			id: 'scope',
			asks: ['Does its scope', 'allow this?'],
			refused: {
				says: ['403 insufficient_scope'],
				more: ['It names the scope it needed'],
				opens: refused('api-no-scope', 'noscope')
			}
		}
	];

	const parts: PicturePart[] = [];
	const lines: PictureLine[] = [];
	const startH = heightFor(1);
	parts.push({
		id: 'request',
		shape: 'ends',
		x: L,
		y: 8 + startH / 2,
		w: 280,
		h: startH,
		says: ['The app calls the API'],
		opens: opensAt('flow', 'api-request', 'oauth')
	});
	let from = 8 + startH;
	checks.forEach((check, i) => {
		const y = from + 30 + ASK_H / 2;
		lines.push({
			d: `M${L} ${from} V${y - ASK_H / 2}`,
			...(i
				? { label: { lines: [say('Yes')], x: L + 8, y: from + 19, anchor: 'start' as const } }
				: {})
		});
		parts.push({ id: check.id, shape: 'ask', x: L, y, w: ASK_W, h: ASK_H, says: check.asks });
		if (keep(check.refused.opens)) {
			const h = heightFor(check.refused.says.length, check.refused.more.length);
			parts.push({
				id: `${check.id}.refused`,
				shape: 'ends',
				x: R,
				y,
				w: END_W,
				h,
				says: check.refused.says,
				more: check.refused.more,
				opens: check.refused.opens
			});
			lines.push({
				d: `M${L + ASK_W / 2} ${y} H${R - END_W / 2}`,
				label: { lines: [say('No')], x: L + ASK_W / 2 + 8, y: y - 6, anchor: 'start' }
			});
		}
		from = y + ASK_H / 2;
	});

	// What no token can answer, which is the app's own code, as the step's practice says.
	const codeH = heightFor(2, 2);
	const codeY = from + 34 + codeH / 2;
	lines.push({
		d: `M${L} ${from} V${codeY - codeH / 2}`,
		label: { lines: [say('Yes')], x: L + 8, y: from + 21, anchor: 'start' }
	});
	parts.push({
		id: 'your-code',
		shape: 'step',
		x: L,
		y: codeY,
		w: 320,
		h: codeH,
		says: ['Your own code: may this', 'user see this thing?'],
		more: ['A valid token says who it is about,', 'and not whether they may.'],
		opens: opensAt('flow', 'api-check-token', 'oauth')
	});
	const doneH = heightFor(1, 1);
	const doneY = codeY + codeH / 2 + 34 + doneH / 2;
	lines.push({ d: `M${L} ${codeY + codeH / 2} V${doneY - doneH / 2}` });
	parts.push({
		id: 'answers',
		shape: 'ends',
		x: L,
		y: doneY,
		w: 280,
		h: doneH,
		says: ['200'],
		more: ['With what was asked for'],
		opens: opensAt('flow', 'api-response', 'oauth')
	});

	const note = textAt(
		'note',
		10,
		doneY + doneH / 2 + 16,
		740,
		say(
			'The answers are what the demo API recorded here said. A 401 means a new token may help, and a 403 that it usually will not. Checking who issued the token is one more check of the same kind, not drawn here.'
		),
		{ size: 'more' }
	);
	parts.push(note);
	return {
		id: 'what-the-api-does',
		title: say('What the API does with a request'),
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
