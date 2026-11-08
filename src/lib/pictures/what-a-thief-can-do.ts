import type { Say } from '#lib/flow/wording.ts';
import { opensAsRecorded, opensAt } from './build.ts';
import { LIFETIMES } from './how-long-each-lasts.ts';
import type { Picture } from './model.ts';
import { keepAll, type Keep } from './simple.ts';
import { DAY, timeline, type TimelineRow } from './timeline.ts';

/**
 * What someone can do with each thing they steal, and for how long: the maintainer's point of
 * 2026-11-07 that "a standing privilege without a mfa is a problem". A second factor is asked for at
 * the login, so a password alone is a way in with no end, and what the login hands out works without
 * the second factor for as long as it lasts (NIST SP 800-63B revision 4, section 5.1). That an
 * account wants a second factor is SP 800-53's IA-2(1) for admins and IA-2(2) for everyone else. No
 * primary source found calls standing privilege itself risky, so the picture shows it, as an admin's
 * password beside anyone's, rather than says it.
 *
 * Each bar is how long a thief who keeps using it has, which a fresh reader's review found the first
 * version understated: using a session or a refresh token counts as using it, so it lasts up to its
 * maximum, and an offline token has none by default (the server notes, and research/followup-checks).
 */
export function whatAThiefCanDo(say: Say, keep: Keep = keepAll): Picture {
	const neverEnds = (says: string) => [{ to: 60 * DAY, tone: 'open' as const, says }];
	const rows: TimelineRow[] = [
		{
			id: 'password-alone',
			name: say('A password, and no second factor'),
			is: say(
				'What the user types to log in. With nothing else asked for, it is all anyone needs.'
			),
			opens: opensAt('flow', 'submit-credentials', 'oauth'),
			bars: neverEnds(say('Until it is changed')),
			after: say('Until it is changed'),
			right: say('Nothing else'),
			rightSays: say('Nothing else')
		},
		{
			id: 'admin-password',
			name: say('An admin’s password, and no second factor'),
			is: say(
				'The same, with every right the admin has, at any hour, because those rights are always there.'
			),
			bars: neverEnds(say('Until it is changed')),
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
				{ to: LIFETIMES.most, tone: 'solid', says: say('Ten hours, if used every thirty minutes') }
			],
			after: say('Up to 10 h, if used every 30 min'),
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
			is: say('Gets new access tokens without the user, for as long as the session lasts.'),
			opens: opensAsRecorded('flow', 'refresh-again-response', 'refresh', { refresh: true }),
			bars: [{ to: LIFETIMES.most, tone: 'solid', says: say('Ten hours, with the session') }],
			after: say('Up to 10 h, with the session'),
			right: say("The app's secret, if it has one"),
			rightSays: say("The app's secret, if it has one"),
			rightOpens: opensAsRecorded('flow', 'refresh-again', 'refresh', { refresh: true })
		},
		{
			id: 'offline-token',
			name: say('An offline token'),
			is: say('A refresh token for when the user is gone, such as a nightly import.'),
			opens: opensAsRecorded('flow', 'refresh-after-logout-response', 'logout-offline', {
				oidc: true,
				logout: true,
				logoutKeeps: 'offline'
			}),
			bars: neverEnds(say('No end by default, if used every thirty days')),
			after: say('No end, if used every 30 days'),
			right: say("The app's secret, if it has one"),
			rightSays: say("The app's secret, if it has one")
		}
	];
	const drawn = timeline({
		lead: say('If someone steals one of these: how long they can use it, and what else they need.'),
		key: [
			{ tone: 'solid', says: say('How long a thief who keeps using it has') },
			{ tone: 'open', says: say('No end') }
		],
		rightHead: say('What else a thief needs'),
		rightWidth: 170,
		rows: rows.filter((row) => keep(row.opens)),
		scale: say('Minutes are stretched and days squeezed, so both fit.'),
		note: say(
			'A second factor is asked for at the login. After it, a cookie or token stands in for the user, and works for whoever holds it until it ends. NIST’s security controls want a second factor on every account, and name admins’ accounts on their own. Lifetimes are from the server recorded, by default, where using a session or a refresh token keeps it going, up to its maximum.'
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
