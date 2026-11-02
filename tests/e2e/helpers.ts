import { expect, type Page } from '@playwright/test';
import { authorizationCodeBase as base } from '../../src/lib/flow/index.ts';
import { evaluate, type BaseFlow, type DiagramId } from '../../src/lib/flow/model.ts';
import { parseState, wordingOf } from '../../src/lib/flow/state.ts';
import { sayer, speak } from '../../src/lib/flow/wording.ts';

export const FLOW_PATH = 'authorization-code/';
export const SETUP_PATH = 'authorization-code/setup/';

const pathOf = (diagram: DiagramId) => (diagram === 'setup' ? SETUP_PATH : FLOW_PATH);

/**
 * Opens a state and waits until the page has hydrated, so input is not lost. Advanced mode, because
 * it shows what most tests look at. Simple mode, the default, has its own spec.
 */
/** A question on the map, with its part of the map open, as someone would have to open it. */
export async function onTheMap(page: Page, id: string) {
	const node = page.getByTestId(`node-${id}`);
	const part = page.locator('.track details', { has: node });
	if ((await part.getAttribute('open')) === null) await part.locator('summary').click();
	return node;
}

export async function open(page: Page, search = '', diagram: DiagramId = 'flow') {
	const query = search.includes('mode=') ? search : `mode=advanced${search ? `&${search}` : ''}`;
	await page.goto(`${pathOf(diagram)}?${query}`);
	await page.locator('.workspace[data-ready="true"]').waitFor();
}

/**
 * Clicks a row where it is on screen. Firefox scrolls to the top when asked to bring something in an
 * SVG into view, which is what a plain click does first, so this measures and scrolls by hand.
 */
export async function pressRow(page: Page, step: string) {
	const box = await page.locator(`[data-step="${step}"]`).evaluate((row) => {
		const scroller = row.closest('.scroller') as HTMLElement;
		const measured = row.getBoundingClientRect();
		const view = scroller.getBoundingClientRect();
		scroller.scrollTop += measured.top + measured.height / 2 - (view.top + view.height / 2);
		const { left, right, top, bottom } = row.getBoundingClientRect();
		return { x: (left + right) / 2, y: (top + bottom) / 2 };
	});
	await page.mouse.click(box.x, box.y);
}

export const visibleStepIds = (page: Page) =>
	page.locator('[data-step]').evaluateAll((rows) => rows.map((r) => r.getAttribute('data-step')));

export const lifelineIds = (page: Page) =>
	page
		.locator('[data-lifeline]')
		.evaluateAll((lanes) => lanes.map((l) => l.getAttribute('data-lifeline')));

/** What the flow model says should be on screen for this query string. */
export function expectedFor(search: string, diagram: DiagramId = 'flow', flow: BaseFlow = base) {
	const state = parseState(flow, diagram, search);
	const view = speak(
		evaluate(flow.diagrams[state.diagram], state.settings),
		sayer(wordingOf(state))
	);
	return {
		state,
		view,
		steps: view.steps.map((step) => step.id),
		lifelines: view.lifelines.map((line) => line.id)
	};
}

/** The diagram on screen has to match the model, whichever way the page got there. */
export async function expectMatchesModel(
	page: Page,
	search: string,
	diagram: DiagramId = 'flow',
	flow: BaseFlow = base
) {
	const expected = expectedFor(search, diagram, flow);
	await expect(page.locator('.workspace')).toHaveAttribute('data-diagram', expected.state.diagram);
	await expect.poll(() => visibleStepIds(page)).toEqual(expected.steps);
	await expect.poll(() => lifelineIds(page)).toEqual(expected.lifelines);
	await expect(page.locator('[data-step][data-state="current"]')).toHaveAttribute(
		'data-step',
		expected.state.step
	);
}

/** The query, without the mode that `open` adds. */
export function currentSearch(page: Page) {
	const { searchParams } = new URL(page.url());
	searchParams.delete('mode');
	return searchParams.toString();
}

/** Where the page is, for tests about the address, without the mode that `open` adds. */
export function placeOf(page: Page) {
	const search = currentSearch(page);
	return new URL(page.url()).pathname + (search ? `?${search}` : '');
}

/** Fails the test on anything the page logs as an error. */
export function watchForErrors(page: Page) {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(String(error)));
	page.on('console', (message) => {
		// Firefox reports a font it stopped fetching because the test had already moved on.
		const leftBeforeItArrived = /downloadable font: download failed.*status=2152398850/;
		if (message.type() === 'error' && !leftBeforeItArrived.test(message.text())) {
			errors.push(message.text());
		}
	});
	return () => expect(errors).toEqual([]);
}
