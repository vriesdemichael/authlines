<script lang="ts">
	import Execute from '#lib/components/Execute.svelte';
	import Timeline from '#lib/components/Timeline.svelte';
	import type { Part } from '#lib/flow/model.ts';

	interface Props {
		position: number;
		total: number;
		canGoBack: boolean;
		onback: () => void;
		onnext: () => void;
		/** The diagram's parts and where someone is in them, to go anywhere at a click. */
		parts: readonly Part[];
		current: string;
		onjump: (step: string) => void;
		/** Whether it is stepping by itself, and how long it stays on this step. */
		playing?: boolean;
		playingFor?: number;
		onplay?: () => void;
		/** The step's answer, when running this step adds something. */
		answerAt?: number | null;
		onexecute?: () => void;
		/** Where to go from the end, beside Next, so the last step is not a dead end. */
		onwardHref?: string | null;
		onwardLabel?: string;
	}

	let {
		position,
		total,
		canGoBack,
		onback,
		onnext,
		parts,
		current,
		onjump,
		playing = false,
		playingFor = 0,
		onplay = () => {},
		answerAt = null,
		onexecute = () => {},
		onwardHref = null,
		onwardLabel = 'Next question'
	}: Props = $props();

	const atStart = $derived(!canGoBack);
	const atEnd = $derived(position >= total);
</script>

<div class="controls">
	<!-- Not disabled, because that would drop the focus of whoever just pressed it. -->
	<button
		data-testid="back"
		aria-disabled={atStart}
		onclick={() => {
			if (!atStart) onback();
		}}
	>
		Back
	</button>
	<!-- Next stays Next, so that pressing it as often as someone likes never leaves the question. -->
	<button
		class="next"
		class:invite={position === 1}
		data-testid="next"
		aria-disabled={atEnd}
		onclick={() => {
			if (!atEnd) onnext();
		}}
	>
		Next
	</button>
	{#if atEnd && onwardHref}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the route resolves it -->
		<a class="next onward" href={onwardHref} data-testid="next-question">
			{onwardLabel}
		</a>
	{/if}
	<button class="play" data-testid="play" onclick={onplay}>{playing ? 'Stop' : 'Play'}</button>
	<span class="position" data-testid="position">Step {position} of {total}</span>
	<Timeline {parts} {current} {onjump} waiting={playing ? playingFor : null} />
	{#if answerAt !== null}
		<Execute {answerAt} {onexecute} />
	{/if}
</div>

<style>
	.controls {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	/* The same weight with nothing left to do, so that it stays exactly where it is. */
	.next {
		font-weight: 600;
	}

	.next:not([aria-disabled='true']) {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--on-tone);
	}

	.onward {
		padding: 5px 14px;
		border: 1px solid var(--accent);
		border-radius: 7px;
		white-space: nowrap;
		text-decoration: none;
	}

	/* On the first step, the one thing to do next should be obvious. */
	.invite {
		animation: invite 2.4s ease-in-out 3;
	}

	@keyframes invite {
		50% {
			box-shadow: 0 0 0 5px var(--accent-soft);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.invite {
			animation: none;
		}
	}

	.position {
		margin-left: 8px;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	/* Same width either way, so that what is beside it does not move when it changes. */
	.play {
		min-width: 3.6em;
	}

	@media (max-width: 767px) {
		.controls :global([data-testid='timeline']) {
			display: none;
		}

		.controls {
			flex-wrap: wrap;
		}
	}
</style>
