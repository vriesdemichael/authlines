// Writes the list of tests one of CI's jobs runs: every nth of a browser's tests, in the order
// Playwright lists them. Playwright's own --shard cuts that list into runs of equal length, and the
// slow tests sit together in it, so one job took three times as long as another with as many tests.
//
// node tests/support/shard.mjs <project> <part> <parts> <file to write>
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

// What Playwright splits a line of a test list on.
const BETWEEN = '›';

const [project, partText, partsText, out] = process.argv.slice(2);
const part = Number(partText);
const parts = Number(partsText);
if (
	!project ||
	!out ||
	!Number.isInteger(part) ||
	!Number.isInteger(parts) ||
	part < 1 ||
	part > parts
)
	throw new Error('Usage: shard.mjs <project> <part> <parts> <file to write>');

/** The tests Playwright would run, as lines of a test list, without running them. */
function listed(...more) {
	const report = execFileSync(
		process.execPath,
		[
			'node_modules/@playwright/test/cli.js',
			'test',
			'--list',
			'--reporter=json',
			`--project=${project}`,
			...more
		],
		{ encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }
	);
	const lines = [];
	const walk = (suite, file, titles) => {
		for (const spec of suite.specs ?? []) {
			const path = [...titles, spec.title];
			// A list has no way to quote, so a title like this would match nothing and never run.
			const unlistable = path.find((title) => title.includes(BETWEEN) || title !== title.trim());
			if (unlistable !== undefined)
				throw new Error(`A test list cannot hold this title, in ${file}: "${unlistable}"`);
			for (const test of spec.tests)
				lines.push([`[${test.projectName}]`, file, ...path].join(` ${BETWEEN} `));
		}
		for (const child of suite.suites ?? []) walk(child, file, [...titles, child.title]);
	};
	for (const suite of JSON.parse(report).suites) walk(suite, suite.file, []);
	return lines;
}

const all = listed();
if (!all.length) throw new Error(`No tests in ${project}`);
const mine = all.filter((_, index) => index % parts === part - 1);
writeFileSync(out, `${mine.join('\n')}\n`);

// A line that matches nothing is a test no job runs, and nothing else would say so.
const found = listed(`--test-list=${out}`);
const missing = mine.filter((line) => !found.includes(line));
if (found.length !== mine.length || missing.length)
	throw new Error(
		`The list has ${mine.length} tests and Playwright found ${found.length} with it.` +
			(missing.length ? ` Not found: ${missing.slice(0, 5).join(' | ')}` : '')
	);

console.log(`${project} ${part} of ${parts}: ${mine.length} of ${all.length} tests`);
