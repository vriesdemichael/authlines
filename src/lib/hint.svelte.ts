/**
 * A short explanation of what the pointer rests on, or the keyboard is on, right where it is (the
 * maintainer, 2026-11-10: "the danger is that too many things ask attention when we accidentally hover
 * over it"). So it waits until the pointer rests, goes the moment it leaves, and there is one at a time.
 * A click still opens the full explanation, and a tap on a phone does only that.
 */
export interface Hinted {
	text: string;
	/** Where what it explains is on screen, to put the hint beside it. */
	rect: DOMRect;
}

/** How long the pointer has to rest on something before it says what it is. */
export const REST_MS = 500;
export const HINT_ID = 'hint';

export const hinted = $state<{ current: Hinted | null }>({ current: null });

let owner: Element | null = null;
let waiting: ReturnType<typeof setTimeout> | undefined;
/** What described something before the hint did, which it adds to and puts back. */
let describedBefore: string | null = null;

function undescribe() {
	if (!owner) return;
	if (describedBefore) owner.setAttribute('aria-describedby', describedBefore);
	else owner.removeAttribute('aria-describedby');
}

function show(node: Element, text: string) {
	undescribe();
	owner = node;
	describedBefore = node.getAttribute('aria-describedby');
	node.setAttribute(
		'aria-describedby',
		describedBefore ? `${describedBefore} ${HINT_ID}` : HINT_ID
	);
	hinted.current = { text, rect: node.getBoundingClientRect() };
}

/** Takes the hint away: of this one thing, or whatever it is on. */
export function hideHint(node?: Element) {
	clearTimeout(waiting);
	if (node && node !== owner) return;
	undescribe();
	owner = null;
	hinted.current = null;
}

/** The first sentence of an explanation, which is all a hint has room for. */
export function firstSentence(text: string): string {
	const end = text.search(/[.!?](\s|$)/);
	return end < 0 ? text : text.slice(0, end + 1);
}

/** Makes something say what it is when the pointer rests on it, or the keyboard reaches it. */
export function hint(node: Element, text: string | undefined) {
	let said = text;
	const enter = (event: Event) => {
		if ((event as PointerEvent).pointerType === 'touch' || !said) return;
		clearTimeout(waiting);
		const now = said;
		waiting = setTimeout(() => show(node, now), REST_MS);
	};
	const leave = () => hideHint(node);
	// Only by the keyboard: a click opens the full explanation, and both at once is too much.
	const focus = () => {
		if (said && node.matches(':focus-visible')) show(node, said);
	};
	node.addEventListener('pointerenter', enter);
	node.addEventListener('pointerleave', leave);
	node.addEventListener('pointerdown', leave);
	node.addEventListener('focus', focus);
	node.addEventListener('blur', leave);
	return {
		update(next: string | undefined) {
			said = next;
			if (!next) hideHint(node);
		},
		destroy() {
			node.removeEventListener('pointerenter', enter);
			node.removeEventListener('pointerleave', leave);
			node.removeEventListener('pointerdown', leave);
			node.removeEventListener('focus', focus);
			node.removeEventListener('blur', leave);
			hideHint(node);
		}
	};
}
