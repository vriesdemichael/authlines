import type { Say } from '#lib/flow/wording.ts';
import { barAt, markAt, opensAsRecorded, textAt } from './build.ts';
import type { MarkKind, Opens, Picture, PictureLine, PicturePart } from './model.ts';

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How long each lasts on the server recorded, by default. A test holds the first two to a recording's
 * expires_in and refresh_expires_in, and the others to the server notes.
 */
export const LIFETIMES = {
	access: 5 * MINUTE,
	idle: 30 * MINUTE,
	most: 10 * HOUR,
	offline: 30 * DAY
} as const;

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
	const ROW = 52;
	const TOP = 40;

	interface Row {
		id: string;
		name: string;
		opens: Opens;
		bars: readonly { to: number; tone: 'solid' | 'light' | 'open'; says: string }[];
		after: string;
		/** Whether a logout ends it, or in words where a mark would mean something else. */
		logout: MarkKind | string;
		logoutSays: string;
		logoutOpens?: Opens;
	}
	const logout = (step: string, keeps?: 'offline') =>
		opensAsRecorded('flow', step, keeps ? 'logout-offline' : 'logout', {
			oidc: true,
			logout: true,
			...(keeps ? { logoutKeeps: keeps } : {})
		});
	const rows: Row[] = [
		{
			id: 'code',
			name: say('The code'),
			opens: opensAsRecorded('flow', 'redirect-with-code', 'oauth'),
			bars: [],
			after: say('One use, and soon'),
			logout: 'none',
			logoutSays: say('Used up long before')
		},
		{
			id: 'access-token',
			name: say('An access token'),
			opens: opensAsRecorded('flow', 'token-response', 'oauth'),
			bars: [{ to: LIFETIMES.access, tone: 'solid', says: say('Five minutes') }],
			after: say('5 min'),
			logout: 'half',
			logoutSays: say('Not at an API that only looks at the token'),
			logoutOpens: logout('token-after-logout-response')
		},
		{
			id: 'session',
			name: say('The session at the identity provider'),
			opens: opensAsRecorded('flow', 'redirect-with-code', 'oauth'),
			bars: [
				{ to: LIFETIMES.most, tone: 'light', says: say('Ten hours at most') },
				{ to: LIFETIMES.idle, tone: 'solid', says: say('Thirty minutes unused') }
			],
			after: say('30 min unused, 10 h at most'),
			logout: 'full',
			logoutSays: say('Yes'),
			logoutOpens: logout('session-ended')
		},
		{
			id: 'refresh-token',
			name: say('A refresh token'),
			opens: opensAsRecorded('flow', 'refresh-response', 'refresh', { refresh: true }),
			bars: [
				{ to: LIFETIMES.most, tone: 'light', says: say('With the session, ten hours at most') },
				{ to: LIFETIMES.idle, tone: 'solid', says: say('With the session, thirty minutes unused') }
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
				{ to: LIFETIMES.offline, tone: 'solid', says: say('Thirty days unused') }
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
			logout: say('Yours to end'),
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
				: textAt(`after-${row.id}`, PLOT.left + 8, y - 24, PLOT.right - PLOT.left, row.after, {
						size: 'more'
					})
		);
		const marks: readonly string[] = ['full', 'half', 'empty', 'dot', 'none'];
		parts.push(
			marks.includes(row.logout)
				? markAt(
						`logout-${row.id}`,
						ENDS.left + ENDS.w / 2,
						y,
						row.logout as MarkKind,
						`${row.name}: ${row.logoutSays}`,
						row.logoutOpens
					)
				: textAt(`logout-${row.id}`, ENDS.left, y - 8, ENDS.w, row.logout, {
						size: 'more',
						align: 'middle',
						opens: row.logoutOpens
					})
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
	const legend = textAt(
		'legend',
		10,
		axisY + 32,
		780,
		say(
			'Dark: how long it lasts. Light: how long it can last at most. Dashed: no fixed end. Filled: a logout ends it. Half: only where something asks the identity provider. Open: it does not.'
		),
		{ size: 'more' }
	);
	const note = textAt(
		'note',
		10,
		axisY + 32 + legend.h + 4,
		780,
		say(
			'On the server recorded, by default. Unused means nothing used it in that time, and a logout of the user ends their session there.'
		),
		{ size: 'more' }
	);
	parts.push(legend, note);
	return {
		id: 'how-long-each-lasts',
		title: say('How long each lasts'),
		width: W,
		height: axisY + 32 + legend.h + 4 + note.h + 12,
		parts,
		lines
	};
}
