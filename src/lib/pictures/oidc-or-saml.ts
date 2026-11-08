import type { Say } from '#lib/flow/wording.ts';
import { bottomOf, opensAt, textAt } from './build.ts';
import type { Opens, Picture, PictureLine, PicturePart } from './model.ts';
import { keepAll, type Keep } from './simple.ts';

type Speaks = 'oidc' | 'saml';

interface Row {
	id: string;
	name: string;
	cells: Record<Speaks, { says: string; opens?: Opens }>;
}

/**
 * OpenID Connect or SAML, for a customer's own provider (#200). Both are recorded, with one
 * customer each, so each cell opens where its run has it: what comes back through the browser, what
 * is traded out of sight, what says who logged in, how our provider trusts it, and what each side
 * hands the other first. The app sees neither, because our provider is in the middle (#118).
 */
export function oidcOrSaml(say: Say, keep: Keep = keepAll): Picture {
	const W = 800;
	const NAME = { left: 10, w: 230 };
	const COLUMNS = { left: 250, right: 790 };
	const column = (COLUMNS.right - COLUMNS.left) / 2;
	const oidc = (step: string, diagram: 'flow' | 'setup' = 'flow') =>
		opensAt(diagram, step, 'companies', { broker: true, companies: true });
	const saml = (step: string, diagram: 'flow' | 'setup' = 'flow') =>
		opensAt(diagram, step, 'companies-saml', {
			broker: true,
			companies: true,
			customerSpeaks: 'saml'
		});

	const rows: Row[] = [
		{
			id: 'browser',
			name: 'What comes back through the browser',
			cells: {
				oidc: { says: 'A code, in the address', opens: oidc('upstream-redirect-back') },
				saml: {
					says: 'The signed answer itself, in a form that posts itself',
					opens: saml('upstream-redirect-back')
				}
			}
		},
		{
			id: 'traded',
			name: 'What is traded out of sight',
			cells: {
				oidc: {
					says: 'The code, for tokens, on a direct call with a secret',
					opens: oidc('upstream-token-request')
				},
				saml: {
					says: 'Nothing. All of it went through the browser',
					opens: saml('upstream-callback')
				}
			}
		},
		{
			id: 'says-who',
			name: 'What says who logged in',
			cells: {
				oidc: { says: 'An ID token, which is a JWT', opens: oidc('upstream-token-response') },
				saml: { says: 'An assertion, in SAML’s own format', opens: saml('upstream-callback') }
			}
		},
		{
			id: 'trust',
			name: 'Why our provider believes it',
			cells: {
				oidc: {
					says: 'It came on that direct call, from the issuer it was given, and it is signed too',
					opens: oidc('upstream-token-response')
				},
				saml: {
					says: 'It is signed with the certificate their metadata handed over',
					opens: saml('send-their-details', 'setup')
				}
			}
		},
		{
			id: 'setup',
			name: 'What each side hands the other first',
			cells: {
				oidc: {
					says: 'Where to send people back. They give an issuer, a client ID and a secret',
					opens: oidc('send-their-details', 'setup')
				},
				saml: {
					says: 'Metadata, each way: the name it goes by, where to send things, and a certificate',
					opens: saml('send-their-details', 'setup')
				}
			}
		}
	];
	const columns = (['oidc', 'saml'] as const).filter((speaks) =>
		rows.every((row) => keep(row.cells[speaks].opens))
	);

	const lead = textAt(
		'lead',
		10,
		8,
		780,
		say(
			'Two ways a customer’s own provider can tell ours who logged in. Our provider speaks both, so the app speaks neither: it gets tokens from ours as before.'
		),
		{ size: 'more' }
	);
	const parts: PicturePart[] = [lead];
	const lines: PictureLine[] = [];
	const HEADS: Record<Speaks, string> = { oidc: 'OpenID Connect', saml: 'SAML' };
	const heads = columns.map((speaks, i) =>
		textAt(
			`head-${speaks}`,
			COLUMNS.left + i * column + 4,
			bottomOf(lead) + 14,
			column - 8,
			say(HEADS[speaks]),
			{
				opens: speaks === 'oidc' ? oidc('upstream-callback') : saml('upstream-callback')
			}
		)
	);
	parts.push(...heads);
	let top = Math.max(...heads.map(bottomOf), bottomOf(lead) + 14) + 8;
	lines.push({ d: `M10 ${top} H${W - 10}`, bare: true, faint: true });
	for (const row of rows) {
		const name = textAt(`name-${row.id}`, NAME.left, top + 8, NAME.w, say(row.name));
		const cells = columns.map((speaks, i) =>
			textAt(
				`${row.id}.${speaks}`,
				COLUMNS.left + i * column + 4,
				top + 8,
				column - 16,
				say(row.cells[speaks].says),
				{ size: 'more', opens: row.cells[speaks].opens }
			)
		);
		parts.push(name, ...cells);
		top = Math.max(bottomOf(name), ...cells.map(bottomOf)) + 10;
		lines.push({ d: `M10 ${top} H${W - 10}`, bare: true, faint: true });
	}
	const note = textAt(
		'note',
		10,
		top + 12,
		780,
		say(
			'Both from recorded runs, with one customer’s provider each. The SAML one was set up to post its answers through the browser.'
		),
		{ size: 'more' }
	);
	parts.push(note);
	return {
		id: 'oidc-or-saml',
		title: say('OpenID Connect or SAML, for company logins'),
		width: W,
		height: bottomOf(note) + 12,
		parts,
		lines
	};
}
