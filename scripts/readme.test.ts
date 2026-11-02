import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SITE_URL } from '#lib/site.ts';

const README = readFileSync('README.md', 'utf8');
const { scripts } = JSON.parse(readFileSync('package.json', 'utf8')) as {
	scripts: Record<string, string>;
};

const FORMS = /issues\/new\?template=([\w.-]+)/g;
const formsIn = (text: string) => [...text.matchAll(FORMS)].map((match) => match[1]);

describe('the README', () => {
	it('links to what is there', () => {
		const targets = [
			...[...README.matchAll(/\]\(([^)#]+)\)/g)].map((match) => match[1]),
			...[...README.matchAll(/(?:srcset|src)="([^"]+)"/g)].map((match) => match[1])
		].filter((target) => !target.startsWith('http'));
		expect(targets.length).toBeGreaterThan(0);
		expect(targets.filter((target) => !existsSync(target))).toEqual([]);
	});

	it('links to the site where it is', () => {
		expect(README).toContain(`[Open Authlines](${SITE_URL}/)`);
	});

	it('only names commands that are there', () => {
		const named = [...README.matchAll(/\bpnpm ([a-z][\w:-]*)/g)].map((match) => match[1]);
		const builtIn = ['install', 'exec'];
		expect(named.length).toBeGreaterThan(0);
		expect(named.filter((name) => !builtIn.includes(name) && !scripts[name])).toEqual([]);
	});

	it('says how the recordings are made and checked, as the home screen promises', () => {
		const headings = [...README.matchAll(/^#+ (.+)$/gm)].map((match) => match[1]);
		expect(headings).toEqual(
			expect.arrayContaining([
				'Where the recordings are',
				'How the recordings are made',
				'How the recordings are checked'
			])
		);
		expect(readFileSync('src/routes/+page.svelte', 'utf8')).toContain(
			'the code, the recordings and how they are checked'
		);
	});
});

describe('the forms a visitor is sent to', () => {
	it('are there', () => {
		const search = readFileSync('src/lib/components/SearchDialog.svelte', 'utf8');
		const forms = [...formsIn(README), ...formsIn(search)];
		expect(forms).toContain('suggest-a-question.yml');
		expect(forms.filter((form) => !existsSync(`.github/ISSUE_TEMPLATE/${form}`))).toEqual([]);
	});
});
