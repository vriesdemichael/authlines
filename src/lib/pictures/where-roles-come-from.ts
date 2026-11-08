import type { Settings } from '#lib/flow/settings.ts';
import type { Say } from '#lib/flow/wording.ts';
import { bottomOf, opensAt, partyBox, textAt } from './build.ts';
import type { Picture, PictureLine, PicturePart } from './model.ts';

/**
 * What the recorded runs had at each hop (#183): the group in the other provider's ID token, the
 * role it became, and the roles and audience of the app's access token, with every role and with
 * only those given to the app. A test holds these to the recordings.
 */
export const ROLES_RECORDED = {
	group: 'sales',
	role: 'reads-orders',
	every: {
		roles: ['reads-orders', 'default-roles-demo-brokered', 'offline_access', 'uma_authorization'],
		accountRoles: ['manage-account', 'manage-account-links', 'view-profile'],
		aud: 'account'
	},
	given: { roles: ['reads-orders'], accountRoles: [], aud: 'demo-api' }
} as const;

/**
 * Where a token's roles come from (#183): a group at the other provider, said in its ID token, made
 * a role here, put in the app's token with every other role or alone, and left to the API to decide
 * what it allows. Neither OAuth nor OpenID Connect says what a role is, which the note says.
 */
export function whereRolesComeFrom(settings: Settings, say: Say): Picture {
	const given = settings.rolesReach === 'given';
	const preset = given ? 'broker-groups-given' : 'broker-groups';
	const reach: Partial<Settings> = given ? { rolesReach: 'given' } : {};
	const at = (step: string, diagram: 'flow' | 'setup' = 'flow') =>
		opensAt(diagram, step, preset, { broker: true, groupRoles: true, ...reach });
	const token = given ? ROLES_RECORDED.given : ROLES_RECORDED.every;
	const others = token.roles.length - 1 + token.accountRoles.length;

	const W = 720;
	const LEFT = 110;
	const BOX_W = 500;
	const GAP = 54;
	const parts: PicturePart[] = [];
	const lines: PictureLine[] = [];
	let top = 8;
	const boxes = [
		partyBox(
			'upstream',
			LEFT,
			top,
			BOX_W,
			say('The other provider'),
			say(`The user is in the group ${ROLES_RECORDED.group} there.`),
			{
				rows: [
					{
						id: 'groups',
						says: `groups: ${ROLES_RECORDED.group}`,
						more: say('In its ID token, sent to the identity provider'),
						opens: at('upstream-token-response')
					}
				],
				opens: at('ask-for-groups', 'setup')
			}
		),
		partyBox(
			'idp',
			LEFT,
			0,
			BOX_W,
			say('The identity provider'),
			say(`Gives a role of its own to anyone in ${ROLES_RECORDED.group}.`),
			{
				rows: [
					{
						id: 'role',
						says: ROLES_RECORDED.role,
						more: say('A role here, given at their first login'),
						opens: at('match-user')
					}
				],
				opens: at('map-group-to-role', 'setup')
			}
		),
		partyBox(
			'token',
			LEFT,
			0,
			BOX_W,
			say('The app’s access token'),
			say(given ? 'Only the role given to this app.' : 'Every role the user has here.'),
			{
				rows: [
					{
						id: 'roles',
						says: others ? `${ROLES_RECORDED.role}, and ${others} more` : ROLES_RECORDED.role,
						more: say(
							others
								? 'Some for the account service, under names this server chose'
								: 'Under a name this server chose for it'
						),
						opens: at('token-response')
					},
					{
						id: 'aud',
						says: `aud: ${token.aud}`,
						more: say(
							given
								? 'The API, which the app was set up to name'
								: 'The account service, because of the user’s roles there'
						),
						opens: at('token-response')
					}
				]
			}
		),
		partyBox(
			'api',
			LEFT,
			0,
			BOX_W,
			say('The API'),
			say(
				`Can decide, in its own code, what ${ROLES_RECORDED.role} lets this user do. Nothing in the token says what a role allows.`
			),
			{ opens: at('api-check-token') }
		)
	];
	const labels = [say('an ID token'), say('the token it makes'), say('sent with each call')];
	boxes.forEach((box, i) => {
		const placed = { ...box, y: top + box.h / 2 };
		parts.push(placed);
		if (i < boxes.length - 1) {
			lines.push({
				d: `M${LEFT + BOX_W / 2} ${bottomOf(placed)} V${bottomOf(placed) + GAP}`,
				label: {
					lines: [labels[i]],
					x: LEFT + BOX_W / 2 + 10,
					y: bottomOf(placed) + GAP / 2 + 4,
					anchor: 'start'
				}
			});
		}
		top = bottomOf(placed) + GAP;
	});
	const last = parts.at(-1)!;
	const note = textAt(
		'note',
		10,
		bottomOf(last) + 16,
		700,
		say(
			'Neither OAuth nor OpenID Connect says what a role or a group is. RFC 9068 names claims for both in an access token, roles and groups, and the server recorded put its roles under a name of its own. The other provider, the role and the token are from recorded runs, and the demo API there did not check the role.'
		),
		{ size: 'more' }
	);
	parts.push(note);
	return {
		id: 'where-roles-come-from',
		title: say('Where a token’s roles come from'),
		width: W,
		height: bottomOf(note) + 12,
		parts,
		lines
	};
}
