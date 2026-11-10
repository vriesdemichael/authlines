<script lang="ts">
	/**
	 * The edge between the diagram and the step, which someone can drag to give the step more room, as
	 * the maintainer asked on 2026-11-09 because the raw traffic was too narrow to read. It is a
	 * separator a keyboard can move too, by the arrow keys, and Home puts it back.
	 */
	import { hint } from '#lib/hint.svelte.ts';

	interface Props {
		/** How wide the panel on its right is, in pixels. */
		width: number;
		min: number;
		max: number;
		/** Where Home puts it back to. */
		initial: number;
		onresize: (width: number) => void;
		label?: string;
	}

	let { width, min, max, initial, onresize, label = 'Width of the step panel' }: Props = $props();

	const STEP = 16;
	const clamp = (value: number) => Math.round(Math.min(max, Math.max(min, value)));
	let from: { x: number; width: number } | null = $state(null);

	function down(event: PointerEvent) {
		if (event.button !== 0) return;
		event.preventDefault();
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		from = { x: event.clientX, width };
	}

	function move(event: PointerEvent) {
		// The panel is on the right, so moving the edge left makes it wider.
		if (from) onresize(clamp(from.width + from.x - event.clientX));
	}

	function up() {
		from = null;
	}

	function key(event: KeyboardEvent) {
		const next =
			event.key === 'ArrowLeft'
				? width + STEP
				: event.key === 'ArrowRight'
					? width - STEP
					: event.key === 'Home'
						? initial
						: event.key === 'End'
							? max
							: null;
		if (next === null) return;
		event.preventDefault();
		onresize(clamp(next));
	}
</script>

<!-- A separator that takes focus and has a value is a widget in WAI-ARIA, which this check does not know. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
	class="divider"
	class:dragging={from !== null}
	role="separator"
	aria-orientation="vertical"
	aria-label={label}
	aria-valuemin={min}
	aria-valuemax={max}
	aria-valuenow={width}
	tabindex="0"
	data-testid="panel-divider"
	use:hint={'Drag to make the step wider or narrower. Double-click to put it back.'}
	onpointerdown={down}
	onpointermove={move}
	onpointerup={up}
	onpointercancel={up}
	ondblclick={() => onresize(clamp(initial))}
	onkeydown={key}
>
	<span class="grip" aria-hidden="true">⋮</span>
</div>

<style>
	/* Wider than it looks, so it is easy to take hold of, and drawn only as the line it sits on. */
	.divider {
		position: relative;
		width: 9px;
		height: 100%;
		min-height: 48px;
		margin-left: -5px;
		cursor: col-resize;
		touch-action: none;
	}

	.divider::after {
		display: block;
		width: 3px;
		height: 100%;
		margin-left: 3px;
		content: '';
	}

	.divider:hover::after,
	.divider:focus-visible::after,
	.dragging::after {
		background: var(--here);
	}

	.divider:focus-visible {
		outline: none;
	}

	/* A grip in the middle, so the edge looks like something to take hold of. */
	.grip {
		position: absolute;
		top: 50%;
		left: 0;
		width: 9px;
		padding: 4px 0;
		border-radius: var(--radius);
		color: var(--muted);
		background: var(--bg);
		font-size: var(--size-small);
		line-height: 1;
		text-align: center;
		transform: translateY(-50%);
	}

	.divider:hover .grip,
	.divider:focus-visible .grip,
	.dragging .grip {
		color: var(--here);
	}
</style>
