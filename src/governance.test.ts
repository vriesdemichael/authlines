import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function filesUnder(folder: string): string[] {
	return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
		const path = join(folder, entry.name);
		return entry.isDirectory() ? filesUnder(path) : [path];
	});
}

describe('components (ADR-007, ADR-012)', () => {
	const components = filesUnder('src/lib').filter((file) => file.endsWith('.svelte'));

	it('exist, or these tests prove nothing', () => {
		expect(components.length).toBeGreaterThan(0);
	});

	it.each(components)('%s has stories', (component) => {
		expect(existsSync(component.replace(/\.svelte$/, '.stories.ts'))).toBe(true);
	});

	it('leave SvelteKit to the route files, because Storybook cannot render $app imports', () => {
		const offenders = filesUnder('src/lib').filter((file) =>
			/from ['"]\$app\//.test(readFileSync(file, 'utf8'))
		);
		expect(offenders).toEqual([]);
	});
});

describe('the screenshot baselines (ADR-006)', () => {
	it('come from the image for the version of Playwright in use', () => {
		const image = readFileSync('.github/workflows/ci.yml', 'utf8').match(/playwright:v([\d.]+)/);
		const lock = readFileSync('pnpm-lock.yaml', 'utf8').match(/'@playwright\/test@([\d.]+)'/);
		expect(image?.[1]).toBe(lock?.[1]);
	});
});

describe('the check branch protection requires (ADR-006)', () => {
	const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
	const job = (name: string) =>
		workflow.match(new RegExp(`name: ${name}\\n[\\s\\S]*?(\\n\\n|$)`))?.[0];

	it('runs whatever happened before it, because a skipped check counts as passed', () => {
		expect(job('CI Complete')).toContain('if: always()');
	});

	it('says no unless every job before it passed', () => {
		expect(job('CI Complete')).toContain('needs: [checks, click-through]');
		expect(job('CI Complete')).toContain('test "$RESULTS" = "success success"');
	});

	it('is what a deploy waits for', () => {
		expect(job('Deploy')).toContain('needs: complete');
	});
});

describe('the click-through jobs (ADR-006)', () => {
	const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
	const jobs = [...workflow.matchAll(/- \{ browser: (\w+), part: (\d+), parts: (\d+) \}/g)].map(
		([, browser, part, parts]) => ({ browser, part: Number(part), parts: Number(parts) })
	);

	it('take every part of each browser between them, because a part no job takes is tests nobody runs', () => {
		const browsers = [...new Set(jobs.map((job) => job.browser))];
		expect(browsers.sort()).toEqual(['chromium', 'firefox', 'phone', 'webkit']);
		for (const browser of browsers) {
			const mine = jobs.filter((job) => job.browser === browser);
			const parts = mine[0].parts;
			expect(mine.map((job) => job.parts)).toEqual(mine.map(() => parts));
			expect(mine.map((job) => job.part).sort((a, b) => a - b)).toEqual(
				Array.from({ length: parts }, (_, index) => index + 1)
			);
		}
	});

	it('run the list written for that part, and are not split a second way', () => {
		expect(workflow).toContain(
			'node tests/support/shard.mjs ${{ matrix.browser }} ${{ matrix.part }} ${{ matrix.parts }} tests-of-this-job.txt'
		);
		expect(workflow).toContain(
			'pnpm test:e2e --project=${{ matrix.browser }} --test-list=tests-of-this-job.txt'
		);
		expect(workflow).not.toContain('--shard=');
	});
});

describe('decision records (ADR-002)', () => {
	const folder = 'docs/adr';
	const index = readFileSync(join(folder, 'index.md'), 'utf8');
	const records = readdirSync(folder).filter((name) => name !== 'index.md');

	it.each(records)('%s has the right shape and is in the index', (name) => {
		expect(name).toMatch(/^\d{3}-[a-z0-9]+(-[a-z0-9]+)*\.md$/);
		const text = readFileSync(join(folder, name), 'utf8');
		const title = text.split('\n')[0];
		expect(title).toMatch(new RegExp(`^# ADR-${name.slice(0, 3)}: \\S`));
		expect(index).toContain(`[${title.slice(2)}](${name})`);
		expect(text.endsWith('\n') && !text.endsWith('\n\n')).toBe(true);
		for (const line of text
			.split('\n')
			.filter((l) => l.startsWith('#'))
			.slice(1)) {
			expect(line).toBe('## Not chosen');
		}
	});

	it('are all mentioned by number only if they exist', () => {
		const numbers = new Set(records.map((name) => name.slice(0, 3)));
		const sources = [
			'CLAUDE.md',
			'docs/premise.md',
			...records.map((name) => join(folder, name)),
			...filesUnder('src'),
			...filesUnder('tests')
		];
		const mentioned = sources.flatMap((file) =>
			[...readFileSync(file, 'utf8').matchAll(/ADR-(\d{3})/g)].map((match) => match[1])
		);
		expect(mentioned.filter((number) => !numbers.has(number))).toEqual([]);
	});
});
