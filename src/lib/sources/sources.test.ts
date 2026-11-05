import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { settingDefs, settingIds } from '#lib/flow/settings.ts';
import { splitRfc } from '#lib/sources/rfc.ts';
import { authorizationCodeBase, flows } from '#lib/flow/index.ts';
import {
	nameSources,
	originalUrl,
	refLabel,
	sourceIds,
	sources,
	type SourceRef
} from '#lib/sources/sources.ts';

const refs: { setting: string; ref: SourceRef }[] = [
	...settingIds.flatMap((setting) => settingDefs[setting].sources.map((ref) => ({ setting, ref }))),
	...nameSources.map((ref) => ({ setting: 'what things are called', ref })),
	...Object.values(flows).flatMap((base) =>
		Object.values(base.diagrams).flatMap(({ steps }) =>
			steps.flatMap((step) => (step.cites ?? []).map((ref) => ({ setting: step.id, ref })))
		)
	),
	...Object.values(authorizationCodeBase.diagrams).flatMap(({ lifelines }) =>
		lifelines.flatMap((line) =>
			(line.knownAs ?? []).map(({ source }) => ({ setting: line.id, ref: source }))
		)
	)
];
const rfcs = sourceIds.filter((id) => sources[id].textFile);
const textOf = (file: string) => readFileSync(`static/rfc/${file}`, 'utf8');

describe('the RFC files', () => {
	// Fetched from rfc-editor.org on 2026-10-31. The licence only covers them unmodified (ADR-009).
	const published: Record<string, string> = {
		'rfc6749.txt': 'f204fc8661d6c92d2ec6e0b54808f961a9ad26e792f57f312d9528335519bd71',
		'rfc6750.txt': '9dc385cf4ecdd85024e5a95e447ede9230e11700bf35251906b25b37557d604b',
		'rfc9449.txt': '3842c58e1f6043389416023b9bb8d765048266024982fbbd90640e05943f4e13',
		// These two on 2026-11-01.
		'rfc7636.txt': '1972e5d81cbaba7066cfd46374207bc2b4546b085ed5dd9b034e79e023e0ca31',
		'rfc9700.txt': '9919d061d40a97886ca866b51c69389b6c81c65cd4b979056c14fdbebfcf622a',
		// These two on 2026-11-02.
		'rfc8628.txt': 'ebd3c37415aa665b55b412fccd9571943e8dbd3f2bf0b18fee4924264252decd',
		'rfc10017.txt': 'ebbf745b69cb48390ed65b30b8d3e5badfec5b6f250979f7107dfa4684f82b7d',
		'rfc7617.txt': 'bc941321da9912fbb1bc92ad1820848ddfd3283dbfbc30f26ea2800bdaf541db',
		'rfc7591.txt': 'f9cd8b8eefdb2d1b1bd5734310f246926db0abb4ec1b2f933f358d58327964e3',
		// This one on 2026-11-04.
		'rfc9126.txt': 'a79d0e30fcc24a22b79c8e18aa82362f6e63a7b8a5d58b480e746360e97388db',
		'rfc8693.txt': '358d658014738bf4dc56c8aae2094ce716ede23b6d5a80488a7dc8e8d72da609',
		// This one on 2026-11-05.
		'rfc8252.txt': '4233c0650ec7e7918c20e0fde2dc565f85e2aa2d4c18123e3cd834295c2f68d0'
	};

	it.each(Object.entries(published))('%s is byte for byte what was published', (file, hash) => {
		const bytes = readFileSync(`static/rfc/${file}`);
		expect(createHash('sha256').update(bytes).digest('hex')).toBe(hash);
	});

	it.each(rfcs)('%s has its file, with its copyright notice', (id) => {
		const file = sources[id].textFile!;
		expect(existsSync(`static/rfc/${file}`)).toBe(true);
		expect(published[file]).toBeDefined();
		expect(textOf(file)).toContain('IETF Trust and the persons identified as the');
	});
});

describe('splitting an RFC', () => {
	it.each(rfcs)('%s comes back whole when its parts are joined', (id) => {
		const text = textOf(sources[id].textFile!);
		const joined = splitRfc(text)
			.parts.map((part) => part.heading + part.body)
			.join('');
		expect(joined).toBe(text);
	});

	it.each(rfcs)('%s has unique section IDs, in order, without its table of contents', (id) => {
		const { sections } = splitRfc(textOf(sources[id].textFile!));
		const ids = sections.map((section) => section.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids[0]).toBe('1');
		expect(sections[0].title).toBe('Introduction');
	});

	it('finds the sections and appendices by number', () => {
		const titleOf = (file: string, id: string) =>
			splitRfc(textOf(file)).sections.find((section) => section.id === id)?.title;
		expect(titleOf('rfc6749.txt', '2.1')).toBe('Client Types');
		expect(titleOf('rfc6749.txt', 'A')).toBe('Augmented Backus-Naur Form (ABNF) Syntax');
		expect(titleOf('rfc6749.txt', 'A.1')).toBe('"client_id" Syntax');
		expect(titleOf('rfc9449.txt', '8')).toBe('Authorization Server-Provided Nonce');
		expect(titleOf('rfc7636.txt', '4.6')).toBe(
			'Server Verifies code_verifier before Returning the Tokens'
		);
		expect(titleOf('rfc9700.txt', '2.1.1')).toBe('Authorization Code Grant');
	});

	it('leaves a text with no headings whole', () => {
		expect(splitRfc('Just text.\n')).toEqual({
			parts: [{ section: null, heading: '', body: 'Just text.\n' }],
			sections: []
		});
	});
});

describe('sources', () => {
	it.each(refs.map(({ setting, ref }) => [`${setting} to ${ref.source}`, ref] as const))(
		'%s says what it means for that setting',
		(_, ref) => {
			expect(ref.why).not.toBe('');
			expect(sources[ref.source]).toBeDefined();
		}
	);

	it('every setting has at least one', () => {
		for (const setting of settingIds) {
			expect(settingDefs[setting].sources.length, setting).toBeGreaterThan(0);
		}
	});

	it('every source is used, so nothing is summarised for no reason', () => {
		const used = new Set([
			...refs.map(({ ref }) => ref.source),
			...nameSources.map((ref) => ref.source)
		]);
		expect(sourceIds.filter((id) => !used.has(id))).toEqual([]);
	});

	it('every section named exists in the RFC', () => {
		for (const { ref } of refs.filter(({ ref }) => ref.section)) {
			const file = sources[ref.source].textFile;
			expect(file, `${ref.source} has a section but no text`).toBeDefined();
			const ids = splitRfc(textOf(file!)).sections.map((section) => section.id);
			expect(ids).toContain(ref.section);
		}
	});

	it('are all complete, and link to the original over HTTPS', () => {
		for (const id of sourceIds) {
			const source = sources[id];
			expect(source.title).not.toBe('');
			expect(source.status).not.toBe('');
			expect(source.summary).not.toBe('');
			expect(source.url).toMatch(/^https:\/\//);
		}
	});

	it('say which section they point at', () => {
		expect(refLabel({ source: 'rfc9449', section: '8', why: '' })).toBe('RFC 9449 §8');
		expect(refLabel({ source: 'rfc9449', why: '' })).toBe('RFC 9449');
	});

	it('link to the section of an RFC, and only an RFC has sections', () => {
		expect(originalUrl(sources.rfc9449, '8')).toBe(
			'https://www.rfc-editor.org/rfc/rfc9449.html#section-8'
		);
		expect(originalUrl(sources.rfc9449, null)).toBe(sources.rfc9449.url);
		expect(originalUrl(sources['oidc-core'], '8')).toBe(sources['oidc-core'].url);
	});
});
