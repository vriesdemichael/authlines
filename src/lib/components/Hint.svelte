<script lang="ts">
	import { HINT_ID, hideHint, hinted, type Hinted } from '#lib/hint.svelte.ts';

	interface Props {
		/** One to show whatever the pointer does, which is what a story needs. */
		preview?: Hinted | null;
	}

	let { preview = null }: Props = $props();
	const current = $derived(preview ?? hinted.current);

	// The one hint on the page, in the browser's top layer, so it is above an open dialog too. It cannot
	// be pointed at, so it never takes the pointer from what it explains, and it moves nothing.
	let element = $state<HTMLElement | null>(null);
	let height = $state(0);
	let width = $state(0);
	const GAP = 6;
	const MARGIN = 8;

	const place = $derived.by(() => {
		const rect = current?.rect;
		if (!rect) return null;
		const below = rect.bottom + GAP + height <= window.innerHeight - MARGIN;
		const left = Math.min(
			Math.max(MARGIN, rect.left),
			Math.max(MARGIN, window.innerWidth - width - MARGIN)
		);
		return below ? { left, top: rect.bottom + GAP } : { left, top: rect.top - GAP - height };
	});

	$effect(() => {
		if (!element) return;
		// Shown again each time, so it goes above a dialog that opened after it.
		if (element.matches(':popover-open')) element.hidePopover();
		if (current) element.showPopover();
	});

	$effect(() => {
		const away = () => hideHint();
		const escape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') hideHint();
		};
		window.addEventListener('scroll', away, true);
		window.addEventListener('resize', away);
		window.addEventListener('keydown', escape);
		return () => {
			window.removeEventListener('scroll', away, true);
			window.removeEventListener('resize', away);
			window.removeEventListener('keydown', escape);
		};
	});
</script>

<div
	id={HINT_ID}
	role="tooltip"
	popover="manual"
	class="hint"
	data-testid="hint"
	bind:this={element}
	bind:clientHeight={height}
	bind:clientWidth={width}
	style:left={place ? `${place.left}px` : undefined}
	style:top={place ? `${place.top}px` : undefined}
>
	{current?.text ?? ''}
</div>

<style>
	/* Quiet, and only words: it says what something is, and the click says the rest. */
	.hint {
		position: fixed;
		inset: auto;
		max-width: min(300px, calc(100vw - 16px));
		margin: 0;
		padding: 6px 9px;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		color: var(--fg);
		background: var(--bg);
		box-shadow: 0 4px 14px rgb(0 0 0 / 0.16);
		font-size: var(--size-ui);
		line-height: 1.45;
		pointer-events: none;
	}
</style>
