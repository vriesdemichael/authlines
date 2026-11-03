// What only the maintainer can judge, as one list with a link for each, generated from the flow data so
// that it cannot drift. It goes in a GitHub issue: one link, works on a phone, and ticks and comments
// can be read back. Running it again keeps the ticks on what has not changed since (#140).
//
//   pnpm review-pack              prints it
//   pnpm review-pack --issue 153  writes it to that issue
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { terms } from '#lib/flow/glossary.ts';
import { authorizationCodeBase as base, flows } from '#lib/flow/index.ts';
import { diffViews, evaluate, introOf, type Step } from '#lib/flow/model.ts';
import {
	allValidSettings,
	defaultSettings,
	settingDefs,
	simpleSettingIds,
	type Settings
} from '#lib/flow/settings.ts';
import { mapNodes } from '#lib/map/tracks.ts';
import { wayIn } from '#lib/map/way-in.ts';
import { SITE_URL } from '#lib/site-url.ts';
import { sources } from '#lib/sources/sources.ts';

export interface Item {
	id: string;
	text: string;
}

export interface Section {
	title: string;
	intro: string;
	items: Item[];
}

const flow = base.diagrams.flow;
const FLOW = `${SITE_URL}/${base.id}/`;
const link = (text: string, search: string) => `[${text}](${FLOW}?${search})`;

const atStep = (step: Step, settings = 'mode=simple') =>
	link(step.plain.replace(/[[\]]/g, ''), `${settings}&step=${step.id}`);

/** Words that are false as soon as one case is left out, which is where audits keep finding things. */
const ABSOLUTE = /\b(only|never|always|nowhere|nobody|no one|the one place)\b/i;
const sentencesOf = (text: string) =>
	text.split(/(?<=[.?!])\s+/).filter((one) => ABSOLUTE.test(one));

function theFirstScreen(): Section {
	return {
		title: 'The first screen',
		intro: 'What someone who knows none of the words reads and does first.',
		items: [
			{ id: 'way-lead', text: `It says: "${wayIn.lead}"` },
			{ id: 'way-off', text: `Before the switch: **${wayIn.off.title}.** ${wayIn.off.says}` },
			{ id: 'way-on', text: `After it: **${wayIn.on.title}.** ${wayIn.on.says}` },
			{ id: 'way-flip', text: `[Flip it](${SITE_URL}/), and it reads as one thing changing.` },
			{
				id: 'way-newcomer',
				text: 'Show it to someone who knows nothing about OAuth, and they can say what the switch did. An agent cannot do this one.'
			}
		]
	};
}

function doesItLand(): Section {
	return {
		title: 'Does the transition land? (#5)',
		intro:
			'The moment the premise says the idea depends on. Press the switch named, on the live site, and judge it against [IdentiFlows](https://identiflows.dev/) on a comparable step.',
		items: [
			{
				id: 'land-oidc',
				text: `${link('OpenID Connect', 'mode=simple&step=token-response')}: turn on "Know who logged in". Most of the change is inside messages that are already there.`
			},
			{
				id: 'land-broker',
				text: `${link('Another provider', 'mode=simple&step=token-response')}: turn on "Log in with another provider". A lifeline and a nested flow arrive.`
			},
			{
				id: 'land-dpop',
				text: `${link('DPoP with a nonce', 'mode=advanced&binding=dpop&step=api-request')}: turn on the nonce. Several messages change, and a retry appears.`
			},
			{
				id: 'land-everything',
				text: `${link('Everything on', 'mode=advanced&oidc=1&pkce=1&binding=dpop&nonce=1&broker=1&upstream=v1')}: flip anything. It stays smooth on your machine.`
			},
			{
				id: 'land-identiflows',
				text: 'Beside IdentiFlows, this is at least as good, both on the look and on how little is on screen at each step.'
			},
			{
				id: 'land-calm',
				text: 'The application screen is not distracting, and simple mode is really emptier than advanced.'
			}
		]
	};
}

function theWords(): Section {
	const plainly = evaluate(flow, defaultSettings);
	const withOidc: Settings = { ...defaultSettings, oidc: true };
	const oidc = evaluate(flow, withOidc);
	const diff = diffViews(plainly, oidc);
	const changed = new Set([...diff.addedSteps, ...diff.rewordedSteps]);
	const inPractice = (step: Step) =>
		step.inPractice ? ` *What is left to you:* ${step.inPractice}` : '';
	return {
		title: 'The words of the default flow, and the OpenID Connect switch (#7)',
		intro: 'Everything simple mode says on them, in reading order. Tick what reads true and clear.',
		items: [
			{ id: 'words-intro', text: `It opens with: ${introOf(flow, defaultSettings)}` },
			...plainly.steps.map((step, at) => ({
				id: `words-${step.id}`,
				text: `**${at + 1}. ${atStep(step)}.** ${step.concept}${inPractice(step)}`
			})),
			{
				id: 'words-oidc-setting',
				text: `**The switch, "${settingDefs.oidc.simple?.label}".** ${settingDefs.oidc.simple?.summary} *Why:* ${settingDefs.oidc.why}`
			},
			...oidc.steps
				// A message can say something new with the same name, so go by what it says.
				.filter(
					(step) =>
						changed.has(step.id) ||
						plainly.steps.find(({ id }) => id === step.id)?.concept !== step.concept
				)
				.map((step) => ({
					id: `words-oidc-${step.id}`,
					text: `**With it on: ${atStep(step, 'mode=simple&oidc=1')}.** ${step.concept}${inPractice(step)}`
				}))
		]
	};
}

function theAbsolutes(): Section {
	const found = new Map<string, { where: string; backedBy: string }>();
	const note = (text: string | undefined, where: string, backedBy = 'nothing cited') => {
		for (const sentence of sentencesOf(text ?? '')) {
			if (!found.has(sentence)) found.set(sentence, { where, backedBy });
		}
	};
	for (const each of Object.values(flows)) {
		for (const diagram of Object.values(each.diagrams)) {
			for (const settings of allValidSettings(each.settings)) {
				for (const step of evaluate(diagram, settings).steps) {
					const backedBy =
						step.cites
							.map((cite) => `${sources[cite.source].label} ${cite.section ?? ''}`.trim())
							.join(', ') || undefined;
					const where = `\`${each.id}\` ${step.id}`;
					note(step.concept, where, backedBy);
					note(step.inPractice, where, backedBy);
					note(step.pitfall?.text, where, backedBy);
				}
			}
		}
	}
	for (const node of mapNodes) note(node.answer, `the question "${node.title}"`);
	for (const term of Object.values(terms)) note(term.explains, `the word "${term.name}"`);
	for (const id of simpleSettingIds) note(settingDefs[id].simple?.summary, `the setting ${id}`);
	return {
		title: 'Every absolute claim in plain words',
		intro:
			'Sentences saying "only", "never", "always", "nowhere", "nobody" or "no one". Audits have found false statements in these each time, so these are worth reading first.',
		items: [...found].map(([sentence, { where, backedBy }]) => ({
			id: `claim-${hash(sentence).slice(0, 8)}`,
			text: `"${sentence}" (${where}; ${backedBy})`
		}))
	};
}

function yoursToOverrule(): Section {
	const item = (id: string, text: string) => ({ id, text });
	return {
		title: 'Decided on your behalf, for you to overrule',
		intro:
			'Each is built that way now. The recommendation is to leave it, unless it says otherwise.',
		items: [
			item(
				'own-no-move',
				'The diagram on the first screen no longer moves by itself. It waits for the switch.'
			),
			item(
				'own-flip-first',
				'A flip goes to what it changed, ahead of the current step if the two do not fit, and Show them is gone (#137).'
			),
			item(
				'own-moved-questions',
				'Three questions moved out of "Start here" so that it fits. "How do an app and a provider get to know each other?" is one, and you may want it back.'
			),
			item(
				'own-trust',
				'The README has "How far to trust it", which says an AI agent writes the words and to check what you rely on (#132).'
			),
			item(
				'own-plain-names',
				'Advanced mode keeps plain names until someone picks otherwise, because three of four AI agents reading it were thrown when the names changed (#62).'
			),
			item(
				'own-notes',
				'One switch, Server notes, on by default, with notes in advanced mode only and closed until opened (premise 5.7).'
			),
			item(
				'own-map-home',
				'The map is the home screen, and a question is named for what someone brings and not for a feature (premise 5.9).'
			),
			item(
				'own-next-beside',
				'Back and Next are at the top of the step’s text, and stay there while it scrolls. The timeline and Play stay under the diagram (premise 5.9).'
			),
			item(
				'own-labels-ahead',
				'Every message says what happens, ahead and when seeing it as one party too. What is ahead is faint and carries nothing until it gets there, and Show every label is gone (ADR-014).'
			),
			item(
				'own-123',
				'**Recommendation: hold until people have tried it.** Simple mode as a different picture (#123).'
			),
			item(
				'own-147',
				'**Recommendation: pick nothing until #150 is judged, then session cookies first.** Which other ways of logging in get a flow (#147).'
			),
			item(
				'own-preview-image',
				'**Only you can do this.** Upload `static/social/home.png` under Settings, General, Social preview. No API can (#132).'
			),
			item(
				'own-screen-reader',
				'**Only a person can do this.** Twenty minutes with NVDA or Narrator (#51).'
			)
		]
	};
}

export const pack = (): Section[] => [
	theFirstScreen(),
	doesItLand(),
	theWords(),
	yoursToOverrule(),
	theAbsolutes()
];

function hash(text: string) {
	return createHash('sha256').update(text).digest('hex');
}

/** Ticks already there, by what each said, so that a change to the words asks again. */
export function ticksIn(body: string): Map<string, string> {
	const ticks = new Map<string, string>();
	for (const [, id, hashed] of body.matchAll(/- \[[xX]\] .*<!-- (\S+) (\S+) -->/g)) {
		ticks.set(id, hashed);
	}
	return ticks;
}

export function render(sections: readonly Section[], previous = ''): string {
	const ticks = ticksIn(previous);
	const known = new Set([...previous.matchAll(/<!-- (\S+) \S+ -->/g)].map(([, id]) => id));
	const lines = [
		'**One list of what only the maintainer can judge.** Generated by `pnpm review-pack` from the flow data, so it cannot drift. Tick what holds, and say what does not in a comment, with the words you would rather have. Running it again keeps your ticks, and asks again about anything that changed.',
		''
	];
	for (const { title, intro, items } of sections) {
		const open = title.startsWith('Every absolute') ? '<details>' : '<details open>';
		lines.push(
			open,
			`<summary><strong>${title}</strong> (${items.length})</summary>`,
			'',
			intro,
			''
		);
		for (const { id, text } of items) {
			const hashed = hash(text).slice(0, 12);
			const ticked = ticks.get(id) === hashed;
			const changed = ticks.has(id) && !ticked;
			const isNew = known.size > 0 && !known.has(id);
			const mark = changed ? '**Changed since you ticked it.** ' : isNew ? '**New.** ' : '';
			lines.push(`- [${ticked ? 'x' : ' '}] ${mark}${text} <!-- ${id} ${hashed} -->`);
		}
		lines.push('', '</details>', '');
	}
	return lines.join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	const issue = process.argv[process.argv.indexOf('--issue') + 1];
	if (process.argv.includes('--issue')) {
		const repo = ['--repo', 'vriesdemichael/authlines'];
		const before = execFileSync(
			'gh',
			['issue', 'view', issue, ...repo, '--json', 'body', '--jq', '.body'],
			{
				encoding: 'utf8'
			}
		);
		const body = render(pack(), before);
		execFileSync('gh', ['issue', 'edit', issue, ...repo, '--body-file', '-'], { input: body });
		console.log(`${body.length} characters, in issue ${issue}.`);
	} else {
		console.log(render(pack()));
	}
}
