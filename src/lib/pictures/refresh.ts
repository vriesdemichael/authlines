import type { Settings } from '#lib/flow/settings.ts';
import type { Say } from '#lib/flow/wording.ts';
import {
	heightFor,
	type Opens,
	type Picture,
	type PictureLine,
	type PicturePart
} from './model.ts';

/**
 * What an app goes through each time it wants the API for a user: use the token it has, refresh it,
 * or log the user in again. The maintainer asked for this one on 2026-11-06, as "the refresh vs
 * initial connection flow". Each part is a stretch of steps that "When the token runs out" draws.
 */
export function refreshPicture(settings: Settings, say: Say): Picture {
	const noSecret = settings.clientType === 'public';
	const broker = settings.broker;
	// The site draws a used refresh token ending things only with no other provider, so far.
	const reuseEnds = settings.reuse === 'ends' && !broker;
	const preset = broker
		? 'refresh-broker-pkce'
		: noSecret
			? reuseEnds
				? 'refresh-public-ends'
				: 'refresh-public'
			: reuseEnds
				? 'refresh-ends'
				: 'refresh';
	const opens = (step: string): Opens => ({
		diagram: 'flow',
		step,
		settings: { refresh: true, ...(reuseEnds ? { reuse: 'ends' as const } : {}) },
		preset
	});

	const W = 720;
	const L = 200; // the app's own questions, down the left
	const R = 590; // logging the user in, on the right
	const E = 440; // where it ends well
	const STEP_W = 260;
	const ASK_W = 200;
	const ASK_H = 84;
	const RIGHT_W = 230;

	const loginSays = broker
		? [
				'Log the user in,',
				'through the browser, at the',
				'other provider, by way of',
				'the identity provider'
			]
		: ['Log the user in,', 'through the browser, at', 'the identity provider'];
	const loginMore = ['With a session there, they may not', 'be asked for a password.'];
	const loginH = heightFor(loginSays.length, loginMore.length);
	const loginY = Math.min(140, 200 - loginH / 2);
	const tradeH = heightFor(1, 1);

	const refreshMore = noSecret
		? [
				'On a direct call, with no secret,',
				'so a copy of the token is all',
				'someone else would need.'
			]
		: broker
			? [
					'With its secret, on a direct call.',
					'The user sees nothing, and only',
					'the identity provider is asked.'
				]
			: ['With its secret, on a direct call.', 'The user sees nothing.'];
	const refreshH = heightFor(1, refreshMore.length);
	const refreshTop = 590 - refreshH / 2;
	const failed = reuseEnds
		? ['No, once the session at the identity provider', 'is over, or when this one was used twice']
		: ['No, once the session at the identity provider', 'is over'];

	const parts: PicturePart[] = [
		{
			id: 'wants',
			shape: 'ends',
			x: L,
			y: 40,
			w: 280,
			h: heightFor(2),
			says: ['The app wants the API', 'for the user'],
			opens: opens('open-app')
		},
		{
			id: 'has-token',
			shape: 'ask',
			x: L,
			y: 140,
			w: ASK_W,
			h: ASK_H,
			says: ['Has it an access', 'token for them?'],
			opens: opens('token-response')
		},
		{
			id: 'calls',
			shape: 'step',
			x: L,
			y: 245,
			w: STEP_W,
			h: heightFor(2),
			says: ['It calls the API', 'with its token'],
			travels: 'direct',
			opens: opens('api-request')
		},
		{
			id: 'taken',
			shape: 'ask',
			x: L,
			y: 345,
			w: ASK_W,
			h: ASK_H,
			says: ['Did the call', 'go through?'],
			opens: opens('api-refused')
		},
		{
			id: 'done',
			shape: 'ends',
			x: E,
			y: 345,
			w: 150,
			h: 48,
			says: ['It has what it', 'came for'],
			opens: opens('api-response')
		},
		{
			id: 'has-refresh',
			shape: 'ask',
			x: L,
			y: 470,
			w: ASK_W,
			h: ASK_H,
			says: ['Has it a', 'refresh token?'],
			opens: opens('token-response')
		},
		{
			id: 'refreshes',
			shape: 'step',
			x: L,
			y: 590,
			w: STEP_W,
			h: refreshH,
			says: ['It trades the refresh token'],
			more: refreshMore,
			travels: 'direct',
			opens: opens('refresh-request')
		},
		{
			id: 'refreshed',
			shape: 'ask',
			x: L,
			y: 700,
			w: ASK_W,
			h: ASK_H,
			says: ['Did that', 'work?'],
			opens: opens(reuseEnds ? 'refresh-newest-response' : 'refresh-response')
		},
		{
			id: 'logs-in',
			shape: 'step',
			x: R,
			y: loginY,
			w: RIGHT_W,
			h: loginH,
			says: loginSays,
			more: loginMore,
			travels: 'browser',
			opens: opens('redirect-to-idp')
		},
		{
			id: 'trades-code',
			shape: 'step',
			x: R,
			y: 245,
			w: RIGHT_W,
			h: tradeH,
			says: ['It trades the code for tokens'],
			more: ['and keeps the refresh token'],
			travels: 'direct',
			opens: opens('token-request')
		}
	];

	const left = R - RIGHT_W / 2;
	const right = R + RIGHT_W / 2;
	const AROUND = W - 6;
	const lines: PictureLine[] = [
		{ d: `M${L} ${40 + heightFor(2) / 2} V98` },
		{
			d: `M${L + ASK_W / 2} 140 H${left}`,
			label: { lines: ['No'], x: L + ASK_W / 2 + 12, y: 132, anchor: 'start' }
		},
		{
			d: `M${L} 182 V${245 - heightFor(2) / 2}`,
			label: { lines: ['Yes'], x: L + 8, y: 204, anchor: 'start' }
		},
		{ d: `M${R} ${loginY + loginH / 2} V${245 - tradeH / 2}` },
		{
			d: `M${left} 245 H${L + STEP_W / 2}`,
			label: {
				lines: ['Then call', 'the API'],
				x: (left + L + STEP_W / 2) / 2,
				y: 223,
				anchor: 'middle'
			}
		},
		{ d: `M${L} ${245 + heightFor(2) / 2} V303` },
		{
			d: `M${L + ASK_W / 2} 345 H${E - 75}`,
			label: { lines: ['Yes'], x: L + ASK_W / 2 + 12, y: 337, anchor: 'start' }
		},
		{
			d: `M${L} 387 V428`,
			label: {
				lines: ['No: it ran out,', 'and the API said 401'],
				x: L + 8,
				y: 403,
				anchor: 'start'
			}
		},
		{
			d: `M${L} 512 V${refreshTop}`,
			label: { lines: ['Yes'], x: L + 8, y: (512 + refreshTop) / 2 + 4, anchor: 'start' }
		},
		{ d: `M${L} ${refreshTop + refreshH} V658` },
		{
			d: `M${L - ASK_W / 2} 700 H24 V245 H${L - STEP_W / 2}`,
			label: { lines: ['Yes, with the', 'new token'], x: 30, y: 676, anchor: 'start' }
		},
		{
			d: `M${L + ASK_W / 2} 470 H${AROUND} V${loginY} H${right}`,
			label: { lines: ['No'], x: L + ASK_W / 2 + 12, y: 462, anchor: 'start' }
		},
		{
			d: `M${L + ASK_W / 2} 700 H${AROUND} V470`,
			bare: true,
			label: { lines: failed, x: L + ASK_W / 2 + 12, y: 678, anchor: 'start' }
		}
	];

	return {
		id: 'refresh',
		title: say('Refresh, or log in again'),
		width: W,
		height: 760,
		parts: parts.map((part) => ({
			...part,
			says: part.says.map(say),
			more: part.more?.map(say)
		})),
		lines: lines.map((line) =>
			line.label ? { ...line, label: { ...line.label, lines: line.label.lines.map(say) } } : line
		)
	};
}
