import type { Say } from '#lib/flow/wording.ts';
import { barAt, markAt, opensAt, textAt } from './build.ts';
import type { MarkKind, Opens, Picture, PictureLine, PicturePart } from './model.ts';

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How long each thing lasts on the server recorded, by default, and whether a logout ends it. On a
 * scale where each step is ten times the last, because five minutes and thirty days have to fit on
 * one line. Each number is from a recording or a server note: an access token's expires_in of 300,
 * a refresh token's 1800, the session's thirty minutes and ten hours, and thirty days for an offline
 * token, which a logout did not end.
 */
export function howLongEachLasts(say: Say): Picture {
	const W = 800;
	const NAME = { left: 10, w: 170 };
	const PLOT = { left: 190, right: 610 };
	const ENDS = { left: 630, w: 160 };
	const FROM = Math.log10(MINUTE);
	const TO = Math.log10(60 * DAY);
	const at = (seconds: number) =>
		PLOT.left + ((Math.log10(seconds) - FROM) / (TO - FROM)) * (PLOT.right - PLOT.left);
	const ROW = 46;
	const TOP = 40;

	interface Row {
		id: string;
		name: string;
		opens: Opens;
		bars: readonly { to: number; tone: 'solid' | 'light' | 'open'; says: string }[];
		after: string;
		logout: MarkKind;
		logoutSays: string;
		logoutOpens?: Opens;
	}
	const logout = (step: string, keeps?: 'offline') =>
		opensAt('flow', step, keeps ? 'logout-offline' : 'logout', {
			oidc: true,
			logout: true,
			...(keeps ? { logoutKeeps: keeps } : {})
		});
	const rows: Row[] = [
		{
			id: 'code',
			name: say('The code'),
			opens: opensAt('flow', 'redirect-with-code', 'oauth'),
			bars: [],
			after: say('One use, and soon'),
			logout: 'none',
			logoutSays: say('Used up long before')
		},
		{
			id: 'access-token',
			name: say('An access token'),
			opens: opensAt('flow', 'token-response', 'oauth'),
			bars: [{ to: 5 * MINUTE, tone: 'solid', says: say('Five minutes') }],
			after: say('5 min'),
			logout: 'half',
			logoutSays: say('Not at an API that only looks at the token'),
			logoutOpens: logout('token-after-logout-response')
		},
		{
			id: 'session',
			name: say('The session at the identity provider'),
			opens: opensAt('flow', 'redirect-with-code', 'oauth'),
			bars: [
				{ to: 10 * HOUR, tone: 'light', says: say('Ten hours at most') },
				{ to: 30 * MINUTE, tone: 'solid', says: say('Thirty minutes unused') }
			],
			after: say('30 min unused, 10 h at most'),
			logout: 'full',
			logoutSays: say('Yes'),
			logoutOpens: logout('session-ended')
		},
		{
			id: 'refresh-token',
			name: say('A refresh token'),
			opens: opensAt('flow', 'refresh-response', 'refresh', { refresh: true }),
			bars: [
				{ to: 10 * HOUR, tone: 'light', says: say('With the session, ten hours at most') },
				{ to: 30 * MINUTE, tone: 'solid', says: say('With the session, thirty minutes unused') }
			],
			after: say('With the session'),
			logout: 'full',
			logoutSays: say('Yes'),
			logoutOpens: logout('refresh-after-logout-response')
		},
		{
			id: 'offline-token',
			name: say('An offline token'),
			opens: logout('refresh-after-logout-response', 'offline'),
			bars: [
				{ to: 60 * DAY, tone: 'open', says: say('No maximum, unless one is turned on') },
				{ to: 30 * DAY, tone: 'solid', says: say('Thirty days unused') }
			],
			after: say('30 days unused'),
			logout: 'empty',
			logoutSays: say('No'),
			logoutOpens: logout('refresh-after-logout-response', 'offline')
		},
		{
			id: 'app-session',
			name: say("The app's own session"),
			opens: logout('app-forgets'),
			bars: [{ to: 60 * DAY, tone: 'open', says: say('As long as you make it') }],
			after: say('Up to you'),
			logout: 'dot',
			logoutSays: say('Only if your code ends it'),
			logoutOpens: logout('app-forgets')
		}
	];

	const parts: PicturePart[] = [
		textAt('ends-head', ENDS.left, 10, ENDS.w, say('Ends at a logout?'), {
			size: 'more',
			align: 'middle'
		})
	];
	const lines: PictureLine[] = [];
	rows.forEach((row, r) => {
		const y = TOP + r * ROW + ROW / 2;
		lines.push({ d: `M10 ${y + ROW / 2} H${W - 10}`, bare: true, faint: true });
		parts.push(
			textAt(`name-${row.id}`, NAME.left, y - 9, NAME.w, row.name, {
				size: 'more',
				opens: row.opens
			})
		);
		const end = Math.max(...row.bars.map((bar) => at(bar.to)), PLOT.left);
		row.bars.forEach((bar, i) => {
			parts.push(barAt(`${row.id}.${i}`, PLOT.left, y, at(bar.to) - PLOT.left, bar.tone, bar.says));
		});
		// What it is in words, after the bar where there is room, and inside the chart where there is not.
		const room = PLOT.right + 10 - end;
		parts.push(
			room > 90
				? textAt(`after-${row.id}`, end + 8, y - 8, Math.min(room - 8, 200), row.after, {
						size: 'more'
					})
				: textAt(`after-${row.id}`, PLOT.left + 8, y - 26, PLOT.right - PLOT.left, row.after, {
						size: 'more'
					})
		);
		parts.push(
			markAt(
				`logout-${row.id}`,
				ENDS.left + ENDS.w / 2,
				y,
				row.logout,
				`${row.name}: ${row.logoutSays}`,
				row.logoutOpens
			)
		);
	});
	const axisY = TOP + rows.length * ROW + 6;
	lines.push({ d: `M${PLOT.left} ${axisY} H${PLOT.right}`, bare: true, faint: true });
	for (const [seconds, label] of [
		[5 * MINUTE, '5 min'],
		[30 * MINUTE, '30 min'],
		[10 * HOUR, '10 h'],
		[30 * DAY, '30 days']
	] as const) {
		const x = at(seconds);
		lines.push({ d: `M${x} ${TOP} V${axisY + 4}`, bare: true, faint: true });
		parts.push(
			textAt(`tick-${label}`, x - 26, axisY + 8, 52, label, { size: 'more', align: 'middle' })
		);
	}
	const note = textAt(
		'note',
		10,
		axisY + 32,
		780,
		say(
			'On the server recorded, by default. Unused means nothing used it in that time, and a logout of the user ends their session there.'
		),
		{ size: 'more' }
	);
	parts.push(note);
	return {
		id: 'how-long-each-lasts',
		title: say('How long each lasts'),
		width: W,
		height: axisY + 64,
		parts,
		lines
	};
}
