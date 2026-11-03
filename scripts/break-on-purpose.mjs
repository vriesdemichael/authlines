// Breaks the code on purpose, one way at a time, and checks that a test notices. A review did this by
// hand once and 24 of 68 breakages went unnoticed, so a green suite meant less than it sounded like.
//
//   pnpm test:breakages             runs them all, and exits 1 if one goes unnoticed or no longer applies
//   pnpm test:breakages keys        only those whose name has that word in it
//   pnpm test:breakages --part=2/3  only every third one, so that CI can run them side by side
//
// Each one has to be a real mistake someone could make. A new test that exists to catch one adds it here.
// Only the unit tests run here, because a browser for each would take hours, so a breakage that only a
// browser test notices does not belong in the list. Two went in on that mistake, and CI said so.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { breakages } from './breakages.mjs';

const args = process.argv.slice(2);
const part = args.find((arg) => arg.startsWith('--part='))?.slice('--part='.length);
const only = args.find((arg) => !arg.startsWith('--'));
const [which, of] = part ? part.split('/').map(Number) : [1, 1];
const chosen = breakages
	.filter((breakage) => !only || breakage.name.includes(only))
	.filter((_, index) => index % of === which - 1);

// This one reads the list and the files it names, so it would notice every breakage and prove nothing.
const NOT_THIS_ONE = '**/breakages.test.ts';

function failed(...vitest) {
	try {
		execFileSync(
			'pnpm',
			['exec', 'vitest', ...vitest, '--bail=1', '--passWithNoTests', '--exclude', NOT_THIS_ONE],
			{ stdio: 'ignore', shell: true }
		);
		return false;
	} catch {
		return true;
	}
}
// A test that imports the broken file is the likely one to notice, and takes a fraction of the whole
// suite. Only a pass there needs the rest, so the answer is the same as running everything each time.
const noticed = (file) => failed('related', file, '--run') || failed('run');

if (failed('run')) {
	console.error('The tests fail before anything has been broken, so this would say nothing.');
	process.exit(1);
}

const unnoticed = [];
const stale = [];
for (const { name, file, from, to } of chosen) {
	const original = readFileSync(file, 'utf8');
	if (original.split(from).length !== 2) {
		stale.push(name);
		console.log(`? ${name}: that text is not in ${file} exactly once any more`);
		continue;
	}
	writeFileSync(
		file,
		original.replace(from, () => to)
	);
	try {
		const caught = noticed(file);
		if (!caught) unnoticed.push(name);
		console.log(`${caught ? 'ok' : 'UNNOTICED'} ${name}`);
	} finally {
		writeFileSync(file, original);
	}
}

console.log(
	`\n${chosen.length - unnoticed.length - stale.length} of ${chosen.length} noticed, ${unnoticed.length} unnoticed, ${stale.length} no longer apply.`
);
for (const name of unnoticed) console.log(`Unnoticed: ${name}`);
for (const name of stale) console.log(`No longer applies: ${name}`);
process.exit(unnoticed.length || stale.length ? 1 : 0);
