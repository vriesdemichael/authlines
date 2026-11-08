import type { Say } from '#lib/flow/wording.ts';
import { bottomOf, charAt, textAt, zone } from './build.ts';
import type { Picture, PictureLine, PicturePart } from './model.ts';

/**
 * What a one-time code looks like where someone meets it: in a text message, an email or an
 * authenticator app, and on the page that asks for it, often as one box for each digit. The
 * maintainer asked for this on 2026-11-08, because that look is what people recognise. They are
 * examples and not any one site's, and nothing on them is recorded. What a code works for, and that a
 * fake site can pass it on, is from NIST SP 800-63B revision 4 (section 3.2.5), and a new code every
 * thirty seconds is RFC 6238's default time step (section 5.2).
 */
export function whatACodeLooksLike(say: Say): Picture {
	const W = 800;
	const CODE = '482913';
	const parts: PicturePart[] = [];
	const lines: PictureLine[] = [];
	const lead = textAt(
		'lead',
		10,
		8,
		780,
		say('Where a one-time code comes from, and how a page often asks for it.')
	);
	parts.push(lead);

	const top = bottomOf(lead) + 14;
	const width = 250;
	const gap = 15;
	const sources = [
		{
			id: 'text-message',
			title: say('A text message'),
			before: null,
			after: say(
				'Your sign-in code. It works for a few minutes. Nobody from us will ask you for it.'
			)
		},
		{
			id: 'email',
			title: say('An email'),
			before: say('Subject: Your sign-in code'),
			after: say('If you did not ask for it, someone else is trying to log in as you.')
		},
		{
			id: 'authenticator-app',
			title: say('An authenticator app'),
			before: null,
			after: say(
				'A new one every 30 seconds, made on the phone from a secret it shares with the site. Nothing is sent.'
			)
		}
	];
	const inside = sources.map((source, i) => {
		const left = 10 + i * (width + gap);
		const held: PicturePart[] = [];
		let y = top + 30;
		if (source.before) {
			const before = textAt(`${source.id}.before`, left + 14, y, width - 28, source.before, {
				size: 'more'
			});
			held.push(before);
			y = bottomOf(before) + 6;
		}
		const code = source.id === 'authenticator-app' ? `${CODE.slice(0, 3)} ${CODE.slice(3)}` : CODE;
		const shown = textAt(`${source.id}.code`, left + 14, y, width - 28, code, { size: 'code' });
		const after = textAt(
			`${source.id}.after`,
			left + 14,
			bottomOf(shown) + 6,
			width - 28,
			source.after,
			{
				size: 'more'
			}
		);
		held.push(shown, after);
		return { left, held, bottom: bottomOf(after) + 12 };
	});
	// Side by side, so each is as tall as the tallest.
	const bottom = Math.max(...inside.map((source) => source.bottom));
	sources.forEach((source, i) => {
		parts.push(zone(source.id, inside[i].left, top, width, bottom - top, source.title));
		parts.push(...inside[i].held);
	});

	// The page that asks for it, with one box for each digit, four typed and the cursor in the fifth.
	const pageTop = bottom + 44;
	const asks = textAt('page.asks', 20, pageTop + 32, 760, say('Enter the code'), {
		size: 'title',
		align: 'middle'
	});
	const boxesTop = bottomOf(asks) + 10;
	const boxesLeft = W / 2 - (6 * 40 + 5 * 10) / 2;
	const boxes = [...CODE].map((digit, i) =>
		charAt(`page.box-${i + 1}`, boxesLeft + i * 50, boxesTop, i < 4 ? digit : '', i === 4)
	);
	const under = textAt(
		'page.under',
		20,
		boxesTop + 48 + 12,
		760,
		say('Often one box for each digit, moving on to the next as you type.'),
		{ size: 'more', align: 'middle' }
	);
	parts.push(zone('page', 10, pageTop, 780, bottomOf(under) + 12 - pageTop, say('The login page')));
	parts.push(asks, ...boxes, under);
	inside.forEach(({ left }) => {
		lines.push({ d: `M${left + width / 2} ${bottom + 4} V${pageTop - 4}` });
	});

	const note = textAt(
		'note',
		10,
		bottomOf(under) + 26,
		780,
		say(
			'A fake site can show the same boxes and pass the code on while it works, so a code proves you got it, and not which site asked. These are examples, and not any one site’s.'
		),
		{ size: 'more' }
	);
	parts.push(note);
	return {
		id: 'what-a-code-looks-like',
		title: say('What a one-time code looks like'),
		width: W,
		height: bottomOf(note) + 12,
		parts,
		lines
	};
}
