import type { Say } from '#lib/flow/wording.ts';
import { opensAsRecorded } from './build.ts';
import type { Picture } from './model.ts';
import { DAY, HOUR, MINUTE, timeline, type TimelineRow } from './timeline.ts';

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
 * token, which a logout did not end. Each row says what it is, because the maintainer found on
 * 2026-11-07 that it otherwise took knowing already, and a key drawn with the same bars and circles
 * says what those mean.
 */
export function howLongEachLasts(say: Say): Picture {
	const logout = (step: string, keeps?: 'offline') =>
		opensAsRecorded('flow', step, keeps ? 'logout-offline' : 'logout', {
			oidc: true,
			logout: true,
			...(keeps ? { logoutKeeps: keeps } : {})
		});
	const rows: TimelineRow[] = [
		{
			id: 'code',
			name: say('The code'),
			is: say(
				'What the browser brings back after the login, for the app to trade once for tokens.'
			),
			opens: opensAsRecorded('flow', 'redirect-with-code', 'oauth'),
			bars: [],
			after: say('One use, and soon'),
			right: say('Used up first'),
			rightSays: say('Used up long before')
		},
		{
			id: 'access-token',
			name: say('An access token'),
			is: say('What the app shows the API to be let in.'),
			opens: opensAsRecorded('flow', 'token-response', 'oauth'),
			bars: [{ to: LIFETIMES.access, tone: 'solid', says: say('Five minutes') }],
			after: say('5 min'),
			right: 'half',
			rightSays: say('Not at an API that only looks at the token'),
			rightOpens: logout('token-after-logout-response')
		},
		{
			id: 'session',
			name: say('The session at the identity provider'),
			is: say('How it remembers this browser, so a second login needs no password.'),
			opens: opensAsRecorded('flow', 'redirect-with-code', 'oauth'),
			bars: [
				{ to: LIFETIMES.most, tone: 'light', says: say('Ten hours at most') },
				{ to: LIFETIMES.idle, tone: 'solid', says: say('Thirty minutes unused') }
			],
			after: say('30 min unused, 10 h at most'),
			right: 'full',
			rightSays: say('Yes'),
			rightOpens: logout('session-ended')
		},
		{
			id: 'refresh-token',
			name: say('A refresh token'),
			is: say('Gets the app a new access token, without the user. It belongs to the session.'),
			opens: opensAsRecorded('flow', 'refresh-response', 'refresh', { refresh: true }),
			bars: [
				{ to: LIFETIMES.most, tone: 'light', says: say('With the session, ten hours at most') },
				{ to: LIFETIMES.idle, tone: 'solid', says: say('With the session, thirty minutes unused') }
			],
			after: say('With the session'),
			right: 'full',
			rightSays: say('Yes'),
			rightOpens: logout('refresh-after-logout-response')
		},
		{
			id: 'offline-token',
			name: say('An offline token'),
			is: say(
				'A refresh token for when the user is gone, such as a nightly import. The app asks for offline access to get one, and it outlives the session.'
			),
			opens: logout('refresh-after-logout-response', 'offline'),
			bars: [
				{ to: 60 * DAY, tone: 'open', says: say('No maximum, unless one is turned on') },
				{ to: LIFETIMES.offline, tone: 'solid', says: say('Thirty days unused') }
			],
			after: say('30 days unused'),
			right: 'empty',
			rightSays: say('No'),
			rightOpens: logout('refresh-after-logout-response', 'offline')
		},
		{
			id: 'app-session',
			name: say("The app's own session"),
			is: say('How your app remembers the user, usually with a cookie of its own.'),
			opens: logout('app-forgets'),
			bars: [{ to: 60 * DAY, tone: 'open', says: say('As long as you make it') }],
			after: say('Up to you'),
			right: say('Yours to end'),
			rightSays: say('Only if your code ends it'),
			rightOpens: logout('app-forgets')
		}
	];

	const drawn = timeline({
		key: [
			{ tone: 'solid', says: say('How long it lasts') },
			{ tone: 'light', says: say('How long it can last at most') },
			{ tone: 'open', says: say('No fixed end') },
			{ mark: 'full', says: say('A logout ends it') },
			{ mark: 'half', says: say('Only where something asks the identity provider') },
			{ mark: 'empty', says: say('A logout does not end it') }
		],
		rightHead: say('Ends at a logout?'),
		rows,
		note: say(
			'On the server recorded, by default. Unused means nothing used it in that time, and a logout of the user ends their session there.'
		)
	});
	return {
		id: 'how-long-each-lasts',
		title: say('How long each lasts'),
		width: 800,
		height: drawn.height,
		parts: drawn.parts,
		lines: drawn.lines
	};
}
