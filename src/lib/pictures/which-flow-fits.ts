import type { Say } from '#lib/flow/wording.ts';
import { opensAt, opensIn, textAt, zone } from './build.ts';
import type { Keep } from './simple.ts';
import {
	heightFor,
	wrap,
	SIZE,
	type Opens,
	type Picture,
	type PictureLine,
	type PicturePart
} from './model.ts';

interface Outcome {
	id: string;
	branch: string;
	says: string[];
	more: string[];
	opens: Opens;
}

/**
 * Which flow fits an app (#200): whether it acts for a user, whether the user has a browser there,
 * and where the app runs, each answer opening the flow it leads to. Below, what current advice says
 * not to use, each drawn too. Every flow and every place an app runs here is recorded.
 */
export function whichFlowFits(say: Say, keep: Keep): Picture {
	const W = 800;
	const L = 400; // the questions, down the middle
	const R = 670; // where a question leads away from the code
	const ASK_W = 220;
	const ASK_H = 84;
	const SIDE_W = 240;
	const parts: PicturePart[] = [];
	const lines: PictureLine[] = [];
	const yes = (x: number, y: number) => ({ lines: [say('Yes')], x, y, anchor: 'start' as const });
	const no = (x: number, y: number) => ({ lines: [say('No')], x, y, anchor: 'start' as const });

	const wantsH = heightFor(1);
	parts.push({
		id: 'wants',
		shape: 'ends',
		x: L,
		y: 8 + wantsH / 2,
		w: 340,
		h: wantsH,
		says: ['Your app needs to call an API']
	});
	// Where the last question ends, for the line down from it, and below what is beside it, for room.
	let from = 8 + wantsH;
	let clear = from;

	// A question, the line down to it, and where its No leads, to the right of it.
	const ask = (id: string, says: string[], away: Outcome, afterYes: boolean) => {
		const y = Math.max(from + 40, clear + 20) + ASK_H / 2;
		lines.push({
			d: `M${L} ${from} V${y - ASK_H / 2}`,
			...(afterYes ? { label: yes(L + 8, from + 24) } : {})
		});
		parts.push({ id, shape: 'ask', x: L, y, w: ASK_W, h: ASK_H, says });
		const h = heightFor(away.says.length, away.more.length);
		parts.push({
			id: away.id,
			shape: 'step',
			x: R,
			y,
			w: SIDE_W,
			h,
			says: away.says,
			more: away.more,
			opens: away.opens
		});
		lines.push({
			d: `M${L + ASK_W / 2} ${y} H${R - SIDE_W / 2}`,
			label: no(L + ASK_W / 2 + 10, y - 8)
		});
		from = y + ASK_H / 2;
		clear = Math.max(from, y + h / 2);
	};

	ask(
		'for-a-user',
		['Does it act', 'for a user?'],
		{
			id: 'client-credentials',
			branch: '',
			says: ['Client credentials'],
			more: ['The app asks with its own', 'secret. No user, no browser.'],
			opens: opensIn('client-credentials', 'service-token-request', 'as-itself')
		},
		false
	);
	ask(
		'has-a-browser',
		['Has it a browser', 'the user can use?'],
		{
			id: 'device',
			branch: '',
			says: ['The device flow'],
			more: [
				'The user logs in on a phone',
				'with a short code, and the',
				'app asks until they have.'
			],
			opens: opensIn('device', 'device-request', 'on-a-device')
		},
		true
	);

	const codeH = heightFor(2, 2);
	const codeY = Math.max(from + 44, clear + 20) + codeH / 2;
	lines.push({
		d: `M${L} ${from} V${codeY - codeH / 2}`,
		label: yes(L + 8, from + 24)
	});
	parts.push({
		id: 'code',
		shape: 'step',
		x: L,
		y: codeY,
		w: 320,
		h: codeH,
		says: ['The authorization code flow,', 'with PKCE'],
		more: ['The user logs in at the identity provider,', 'and the app trades a one-time code.'],
		travels: 'browser',
		opens: opensAt('flow', 'redirect-with-code', 'pkce', { pkce: true })
	});

	const runsY = codeY + codeH / 2 + 40 + ASK_H / 2;
	lines.push({ d: `M${L} ${codeY + codeH / 2} V${runsY - ASK_H / 2}` });
	parts.push({
		id: 'runs',
		shape: 'ask',
		x: L,
		y: runsY,
		w: ASK_W,
		h: ASK_H,
		says: ['Where does', 'the app run?']
	});

	// Where it runs, each recorded. Simple mode leaves out what only advanced mode offers.
	const places: Outcome[] = [
		{
			id: 'server',
			branch: 'On a server',
			says: ['With a secret too'],
			more: ['It can keep one, and shows', 'it when it trades the code.'],
			opens: opensAt('flow', 'token-request', 'pkce', { pkce: true })
		},
		{
			id: 'page',
			branch: 'In the page',
			says: ['With no secret'],
			more: ['What is in a page can be', 'read, so a server behind it', 'can keep the tokens out.'],
			opens: opensAt('flow', 'token-request', 'in-the-page', {
				appRuns: 'page',
				clientType: 'public',
				pkce: true
			})
		},
		{
			id: 'program',
			branch: 'On their computer',
			says: ['With no secret'],
			more: ['The code comes back to', '127.0.0.1, on their computer.'],
			opens: opensAt('flow', 'redirect-with-code', 'on-their-computer', {
				appRuns: 'program',
				clientType: 'public',
				pkce: true
			})
		}
	].filter((place) => keep(place.opens));
	const placeH = Math.max(
		...places.map((place) => heightFor(place.says.length, place.more.length))
	);
	const fork = runsY + ASK_H / 2 + 22;
	const placeY = fork + 50 + placeH / 2;
	places.forEach((place, i) => {
		const x = L + (i - (places.length - 1) / 2) * 260;
		lines.push({
			d: `M${L} ${runsY + ASK_H / 2} V${fork} H${x} V${placeY - placeH / 2}`,
			label: { lines: [say(place.branch)], x: x + 8, y: fork + 30, anchor: 'start' }
		});
		parts.push({
			id: place.id,
			shape: 'step',
			x,
			y: placeY,
			w: SIDE_W,
			h: placeH,
			says: place.says,
			more: place.more,
			opens: place.opens
		});
	});

	// What current advice says not to use, drawn all the same, because people still meet it.
	const oldTop = placeY + placeH / 2 + 30;
	const oldH = heightFor(1, 2);
	const old = [
		{
			id: 'old.implicit',
			says: ['The implicit flow'],
			more: ['The token comes back in the', 'address, with no code.'],
			opens: opensAt('flow', 'redirect-with-token', 'implicit', {
				implicit: true,
				appRuns: 'page',
				clientType: 'public'
			})
		},
		{
			id: 'old.password',
			says: ['Giving the app the password'],
			more: ['Drawn here as the old way,', 'with no identity provider.'],
			opens: opensAt('flow', 'old-way-form', 'the-old-way', { oldWay: true })
		}
	].filter((one) => keep(one.opens));
	const titleH = wrap('What current advice says not to use', 760, SIZE.says).length * 17;
	const oldZone = zone(
		'old',
		10,
		oldTop,
		W - 20,
		titleH + oldH + 40,
		say('What current advice says not to use')
	);
	parts.push(oldZone);
	old.forEach((one, i) => {
		parts.push({
			id: one.id,
			shape: 'step',
			x: L + (i - (old.length - 1) / 2) * 340,
			y: oldTop + titleH + 24 + oldH / 2,
			w: 300,
			h: oldH,
			says: one.says,
			more: one.more,
			opens: one.opens
		});
	});
	const note = textAt(
		'note',
		10,
		oldTop + oldZone.h + 12,
		780,
		say(
			'Current advice is RFC 9700. It says to use PKCE with the code, that the implicit flow should not be used, and that the password must not be.'
		),
		{ size: 'more' }
	);
	parts.push(note);

	return {
		id: 'which-flow-fits',
		title: say('Which flow fits your app'),
		width: W,
		height: note.y + note.h / 2 + 12,
		parts: parts.map((part) =>
			part.shape === 'zone' || part.shape === 'text'
				? part
				: { ...part, says: part.says.map(say), more: part.more?.map(say) }
		),
		lines
	};
}
