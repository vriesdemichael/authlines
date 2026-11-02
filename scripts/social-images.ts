// Makes the image each named state shows when its link is shared, from the same model as its diagram.
//
//   pnpm social
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { layoutDiagram, WIDTH } from '#lib/diagram/layout.ts';
import type { DiagramView } from '#lib/flow/model.ts';
import { allNodes, mapNodes, nodeView } from '#lib/map/nodes.ts';
import { socialKey } from '#lib/map/social.ts';

const OUT = 'static/social';
const KEYS = 'src/lib/map/social.json';
const FONT = readFileSync(
	'node_modules/@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2'
).toString('base64');

const COLOURS: Record<string, string> = {
	front: '#b45309',
	back: '#0f766e',
	people: '#7a3fb5',
	internal: '#555d6c'
};

// The same drawing as components/Mark.svelte, with the colours written out as the rest of this is.
const MARK = `<svg width="30" height="30" viewBox="0 0 32 32">
	<path fill="none" stroke="#8b93a3" stroke-width="1.5" d="M6 4v24M16 4v24M26 4v24"/>
	<path fill="none" stroke="#141720" stroke-width="2" d="M6 11h7"/>
	<path fill="#141720" d="M12 7.6 16 11l-4 3.4z"/>
	<path fill="none" stroke="#3b37d6" stroke-width="2.6" d="M16 21h7"/>
	<path fill="#3b37d6" d="M22 17.2 26.4 21 22 24.8z"/>
</svg>`;

const escape = (text: string) =>
	text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

function diagram(view: DiagramView) {
	const { lanes, rows } = layoutDiagram(view);
	const scale = 420 / WIDTH;
	const gap = Math.min(30, 470 / Math.max(rows.length, 1));
	const height = rows.length * gap + 20;
	const lines = lanes.map(
		(lane) =>
			`<line x1="${lane.x * scale}" x2="${lane.x * scale}" y1="0" y2="${height}" stroke="#dcdfe7" stroke-width="2"/>`
	);
	const arrows = rows.map((row, i) => {
		const y = 12 + i * gap;
		const colour = COLOURS[row.channel];
		return row.self
			? `<circle cx="${row.x1 * scale}" cy="${y}" r="5" fill="${colour}"/>`
			: `<line x1="${row.x1 * scale}" x2="${row.x2 * scale}" y1="${y}" y2="${y}" stroke="${colour}" stroke-width="4" stroke-linecap="round"/>`;
	});
	return `<svg width="420" height="${height}" viewBox="0 0 420 ${height}">${lines.join('')}${arrows.join('')}</svg>`;
}

const page = (title: string, summary: string, view: DiagramView) => `<!doctype html>
<style>
	@font-face { font-family: Plex; src: url(data:font/woff2;base64,${FONT}) format('woff2'); font-weight: 100 700; }
	* { box-sizing: border-box; }
	body { margin: 0; width: 1200px; height: 630px; display: flex; align-items: center; gap: 56px;
		padding: 56px 64px; background: #fbfbfd; color: #141720; font-family: Plex, sans-serif; }
	main { flex: 1; }
	small { display: flex; align-items: center; gap: 10px; margin-bottom: 26px; font-size: 26px; font-weight: 600; }
	h1 { margin: 0 0 22px; font-size: 56px; font-weight: 600; line-height: 1.12; letter-spacing: -0.01em; }
	p { margin: 0; color: #555d6c; font-size: 28px; line-height: 1.35; }
	svg { flex: none; }
</style>
<main>
	<small>${MARK}Authlines</small>
	<h1>${escape(title)}</h1>
	<p>${escape(summary)}</p>
</main>
${diagram(view)}`;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const shot = await browser.newPage({ viewport: { width: 1200, height: 630 } });
const render = async (name: string, title: string, summary: string, view: DiagramView) => {
	await shot.setContent(page(title, summary, view));
	await shot.evaluate(() => document.fonts.ready);
	await shot.screenshot({ path: `${OUT}/${name}.png` });
};

const [first] = mapNodes;
await render(
	'home',
	'OAuth and OpenID Connect on one living diagram',
	'Checked against a real server. Pick a question, and follow it one message at a time.',
	nodeView(first)
);
for (const node of allNodes) await render(node.id, node.title, node.summary, nodeView(node));
await browser.close();

const keys = Object.fromEntries(allNodes.map((node) => [node.id, socialKey(node)]));
writeFileSync(KEYS, `${JSON.stringify(keys, null, '\t')}\n`);
console.log(`${allNodes.length + 1} images in ${OUT}`);
