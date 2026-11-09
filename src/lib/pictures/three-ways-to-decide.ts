import type { Say } from '#lib/flow/wording.ts';
import { bottomOf, opensAt, partyBox, textAt } from './build.ts';
import type { Picture, PicturePart, PictureRow } from './model.ts';
import { keepAll, type Keep } from './simple.ts';

/**
 * Three ways to decide whether someone may do something (#200's gap 3), on one question. Only roles
 * are recorded here, so only that box opens a step. The other two rest on the sources a separate
 * reader checked on 2026-11-09: NIST SP 800-162 for attributes, and Fong (2011) and Google's Zanzibar
 * paper (2019) for relationships. Each is in docs/research/followup-checks.md, with what is overstated.
 */
export function threeWaysToDecide(say: Say, keep: Keep = keepAll): Picture {
	const W = 800;
	const BOX_W = 250;
	const lead = textAt(
		'lead',
		10,
		8,
		780,
		say(
			'Three ways to decide whether Alice may see order 42. OAuth and OpenID Connect define none of them. A token can carry what is known about the user, such as their roles. The API still decides, and looks up the rest when it is asked.'
		),
		{ size: 'more' }
	);
	const boxes: { id: string; title: string; says: string; rows: PictureRow[] }[] = [
		{
			id: 'role',
			title: 'By role (RBAC)',
			says: 'Permissions are given to roles, and a user gets them only through a role they have. Alice may, because one of her roles may view orders. A token can say which roles she has, and not what each allows.',
			rows: [
				{
					id: 'in-token',
					says: 'Her role, in a token',
					more: 'reads-orders, recorded',
					opens: opensAt('flow', 'token-response', 'broker-groups', {
						broker: true,
						groupRoles: true
					})
				}
			]
		},
		{
			id: 'attributes',
			title: 'By attributes (ABAC)',
			says: 'A rule over what is known about the user, the thing and the moment. Alice may, if she is in the order’s department and it is office hours. A role can be one of those attributes.',
			rows: []
		},
		{
			id: 'relationship',
			title: 'By relationship (ReBAC)',
			says: 'Who is related to what, kept as a graph by an authorization service, which the app updates as things change. Alice may, because she manages the account order 42 belongs to, and a rule lets an account’s managers see its orders.',
			rows: []
		}
	];
	const top = bottomOf(lead) + 14;
	const drawn = boxes.map((box, i) =>
		partyBox(box.id, 10 + i * (BOX_W + 15), top, BOX_W, say(box.title), say(box.says), {
			rows: box.rows
				.filter((row) => keep(row.opens))
				.map((row) => ({ ...row, says: say(row.says), more: say(row.more) }))
		})
	);
	// The same height, so the three read as one row of answers to the same question.
	const tallest = Math.max(...drawn.map((box) => box.h));
	const parts: PicturePart[] = [
		lead,
		...drawn.map((box) => ({ ...box, h: tallest, y: top + tallest / 2 }))
	];
	const note = textAt(
		'note',
		10,
		top + tallest + 14,
		780,
		say(
			'One can be built on another: to NIST a role may be seen as one attribute among others, and to Fong a role is a relationship with only one party, where relationships can be chained. Only roles are recorded here. The other two rest on NIST’s guide to attribute-based access control, Special Publication 800-162, and for relationships on Fong’s paper of 2011 and Google’s Zanzibar paper of 2019.'
		),
		{ size: 'more' }
	);
	parts.push(note);
	return {
		id: 'three-ways-to-decide',
		title: say('Three ways to decide'),
		width: W,
		height: bottomOf(note) + 12,
		parts,
		lines: []
	};
}
