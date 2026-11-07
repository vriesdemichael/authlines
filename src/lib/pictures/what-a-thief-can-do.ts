import type { Say } from '#lib/flow/wording.ts';
import { opensAsRecorded, opensAt } from './build.ts';
import { LIFETIMES } from './how-long-each-lasts.ts';
import type { Picture } from './model.ts';
import { DAY, timeline, type TimelineRow } from './timeline.ts';

/**
 * What someone can do with each thing they steal, and for how long: the maintainer's point of
 * 2026-11-07 that "a standing privilege without a mfa is a problem". A second factor is asked for at
 * the login, so a password alone is a way in with no end, and what the login hands out works without
 * the second factor for as long as it lasts (NIST SP 800-63B revision 4, section 5.1). That an admin's
 * account wants a second factor is SP 800-53's IA-2(1). No primary source found calls standing
 * privilege itself risky, so the picture shows it rather than says it. The lifetimes are the recorded ones, and what a refresh
 * token also needs is what the recording of a used refresh token showed.
 */
export function whatAThiefCanDo(say: Say): Picture {
	const logout = (step: string, keeps?: 'offline') =>
		opensAsRecorded('flow', step, keeps ? 'logout-offline' : 'logout', {
			oidc: true,
			logout: true,
			...(keeps ? { logoutKeeps: keeps } : {})
		});
	const rows: TimelineRow[] = [
		{
			id: 'password-alone',
			name: say('A password, and no second factor'),
			is: say(
				'What the user types to log in. With nothing else asked for, it is all anyone needs.'
			),
			opens: opensAt('flow', 'submit-credentials', 'oauth'),
			bars: [{ to: 60 * DAY, tone: 'open', says: say('Until it is changed') }],
			after: say('Until it is changed'),
			right: say('Nothing else'),
			rightSays: say('Nothing else')
		},
		{
			id: 'password-second-factor',
			name: say('A password, with a second factor'),
			is: say('The identity provider also asks for something the thief does not have.'),
			opens: opensAt('flow', 'submit-credentials', 'oauth'),
			bars: [],
			after: say('Not on its own'),
			right: say('The second factor too'),
			rightSays: say('The second factor too')
		},
		{
			id: 'session',
			name: say('The session at the identity provider'),
			is: say('Its cookie in the browser. The second factor was asked for when it began.'),
			opens: opensAsRecorded('flow', 'redirect-with-code', 'oauth'),
			bars: [
				{ to: LIFETIMES.most, tone: 'light', says: say('Ten hours at most') },
				{ to: LIFETIMES.idle, tone: 'solid', says: say('Thirty minutes unused') }
			],
			after: say('30 min unused, 10 h at most'),
			right: say('Nothing else'),
			rightSays: say('Nothing else')
		},
		{
			id: 'access-token',
			name: say('An access token'),
			is: say('What the app shows the API. Whoever holds a bearer token can use it.'),
			opens: opensAsRecorded('flow', 'api-request', 'oauth'),
			bars: [{ to: LIFETIMES.access, tone: 'solid', says: say('Five minutes') }],
			after: say('5 min'),
			right: say('Nothing else'),
			rightSays: say('Nothing else')
		},
		{
			id: 'refresh-token',
			name: say('A refresh token'),
			is: say('Gets new access tokens without the user.'),
			opens: opensAsRecorded('flow', 'refresh-again-response', 'refresh', { refresh: true }),
			bars: [
				{ to: LIFETIMES.most, tone: 'light', says: say('With the session, ten hours at most') },
				{ to: LIFETIMES.idle, tone: 'solid', says: say('With the session, thirty minutes unused') }
			],
			after: say('With the session'),
			right: say("The app's secret, if it has one"),
			rightSays: say("The app's secret, if it has one"),
			rightOpens: opensAsRecorded('flow', 'refresh-again', 'refresh', { refresh: true })
		},
		{
			id: 'offline-token',
			name: say('An offline token'),
			is: say('A refresh token for when the user is gone, such as a nightly import.'),
			opens: logout('refresh-after-logout-response', 'offline'),
			bars: [
				{ to: 60 * DAY, tone: 'open', says: say('No maximum, unless one is turned on') },
				{ to: LIFETIMES.offline, tone: 'solid', says: say('Thirty days unused') }
			],
			after: say('30 days unused'),
			right: say("The app's secret, if it has one"),
			rightSays: say("The app's secret, if it has one")
		}
	];
	const drawn = timeline({
		key: [
			{ tone: 'solid', says: say('How long a stolen one works') },
			{ tone: 'light', says: say('How long it can work at most') },
			{ tone: 'open', says: say('No fixed end') }
		],
		rightHead: say('What else a thief needs'),
		rightWidth: 170,
		rows,
		note: say(
			'A second factor is asked for at the login. After it, a cookie or token stands in for the user, and works for whoever holds it until it ends. An admin’s account with only a password is the first row, with an admin’s rights, which is why NIST’s security controls want a second factor on such accounts. Lifetimes are from the server recorded, by default.'
		)
	});
	return {
		id: 'what-a-thief-can-do',
		title: say('What a thief can do with each'),
		width: 800,
		height: drawn.height,
		parts: drawn.parts,
		lines: drawn.lines
	};
}
