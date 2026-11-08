import type { Say } from '#lib/flow/wording.ts';
import { opensIn, textAt } from './build.ts';
import { heightFor, type Picture, type PictureLine, type PicturePart } from './model.ts';
import type { Keep } from './simple.ts';

/**
 * What the device answered in the recorded run: how many seconds to wait between asking, and how
 * long the codes last. A test holds these to the recording.
 */
export const ASKING = { interval: 5, expiresIn: 600, expiresInWhenTheyRunOut: 2 } as const;

/**
 * What an app on a device does while the user logs in somewhere else (#200, and a flowchart #167
 * proposed): it waits, asks with the device code, and goes by the answer. Not yet and too soon mean
 * ask again, and anything else means stop. Each answer is from a recorded run, and the ones a step
 * draws open it.
 */
export function theAppKeepsAsking(say: Say, keep: Keep): Picture {
	const L = 300; // the app's own steps, down the left
	const R = 620; // how it ends, on the right
	const ASK_W = 200;
	const ASK_H = 84;
	const END_W = 260;
	const parts: PicturePart[] = [];
	const lines: PictureLine[] = [];
	const minutes = ASKING.expiresIn / 60;

	const startH = heightFor(2);
	const start: PicturePart = {
		id: 'shows',
		shape: 'ends',
		x: L,
		y: 8 + startH / 2,
		w: 300,
		h: startH,
		says: ['The app shows the user code,', 'and keeps the device code'],
		opens: opensIn('device', 'device-show-code', 'on-a-device')
	};
	const waitH = heightFor(1, 1);
	const wait: PicturePart = {
		id: 'asks',
		shape: 'step',
		x: L,
		y: start.y + startH / 2 + 40 + waitH / 2,
		w: 300,
		h: waitH,
		says: [`It waits ${ASKING.interval} seconds, then asks`],
		more: ['with the device code'],
		travels: 'direct',
		opens: opensIn('device', 'device-poll', 'on-a-device')
	};
	const askY = wait.y + waitH / 2 + 50 + ASK_H / 2;
	const ask: PicturePart = {
		id: 'answer',
		shape: 'ask',
		x: L,
		y: askY,
		w: ASK_W,
		h: ASK_H,
		says: ['What is', 'the answer?']
	};
	parts.push(start, wait, ask);
	lines.push(
		{ d: `M${L} ${start.y + startH / 2} V${wait.y - waitH / 2}` },
		{ d: `M${L} ${wait.y + waitH / 2} V${askY - ASK_H / 2}` }
	);

	// Not yet: the user has not finished, so it asks again, as the recorded run did.
	lines.push({
		d: `M${L - ASK_W / 2} ${askY} H60 V${wait.y - 10} H${L - 150}`,
		label: {
			lines: ['authorization_pending:', say('not yet')],
			x: 68,
			y: askY - 26,
			anchor: 'start'
		}
	});

	// Too soon: asked sooner than the interval, which the recorded server answered with slow_down.
	const slowH = heightFor(1, 2);
	const slow: PicturePart = {
		id: 'slow-down',
		shape: 'step',
		x: L,
		y: askY + ASK_H / 2 + 40 + slowH / 2,
		w: 280,
		h: slowH,
		says: ['slow_down'],
		more: ['It asked too soon, so it waits', `${ASKING.interval} seconds longer from then on.`]
	};
	parts.push(slow);
	lines.push(
		{ d: `M${L} ${askY + ASK_H / 2} V${slow.y - slowH / 2}` },
		{ d: `M${L - 140} ${slow.y} H30 V${wait.y + 10} H${L - 150}` }
	);

	// Anything else ends it. How it ends is a choice in advanced mode, so simple mode keeps the tokens.
	const endings = [
		{
			id: 'tokens',
			says: ['Tokens'],
			more: ['The user agreed, and the app', 'has what it waited for.'],
			opens: opensIn('device', 'device-token-response', 'on-a-device')
		},
		{
			id: 'access-denied',
			says: ['access_denied'],
			more: ['The user said no. It stops.'],
			opens: opensIn('device', 'device-denied-response', 'on-a-device-says-no', {
				deviceEnds: 'says-no'
			})
		},
		{
			id: 'expired-token',
			says: ['expired_token'],
			more: ['The codes ran out before the', 'user finished. It stops.'],
			opens: opensIn('device', 'device-expired-response', 'on-a-device-runs-out', {
				deviceEnds: 'runs-out'
			})
		}
	].filter((ending) => keep(ending.opens));
	const endH = heightFor(1, 2);
	const firstY = askY - ((endings.length - 1) * (endH + 24)) / 2;
	endings.forEach((ending, i) => {
		const y = Math.max(firstY + i * (endH + 24), 8 + endH / 2 + i * (endH + 24));
		parts.push({
			id: ending.id,
			shape: 'ends',
			x: R,
			y,
			w: END_W,
			h: endH,
			says: ending.says,
			more: ending.more,
			opens: ending.opens
		});
		lines.push({ d: `M${L + ASK_W / 2} ${askY} H460 V${y} H${R - END_W / 2}` });
	});

	const bottom = Math.max(...parts.map((part) => part.y + part.h / 2));
	const note = textAt(
		'note',
		10,
		bottom + 16,
		740,
		say(
			`From recorded runs. The identity provider said to wait ${ASKING.interval} seconds between asking, and that the codes last ${minutes} minutes. In the run where they ran out, they were made to last ${ASKING.expiresInWhenTheyRunOut} seconds. Asking sooner got slow_down.`
		),
		{ size: 'more' }
	);
	parts.push(note);
	return {
		id: 'the-app-keeps-asking',
		title: say('The app keeps asking'),
		width: 760,
		height: note.y + note.h / 2 + 12,
		parts: parts.map((part) =>
			part.shape === 'text'
				? part
				: { ...part, says: part.says.map(say), more: part.more?.map(say) }
		),
		lines: lines.map((line) =>
			line.label ? { ...line, label: { ...line.label, lines: line.label.lines.map(say) } } : line
		)
	};
}
