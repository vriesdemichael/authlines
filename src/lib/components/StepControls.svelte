<script lang="ts">
	import Execute from '#lib/components/Execute.svelte';

	interface Props {
		position: number;
		total: number;
		canGoBack: boolean;
		onback: () => void;
		onnext: () => void;
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
		answerAt = null,
		onexecute = () => {},
		onwardHref = null,
		onwardLabel = 'Next question'
	}: Props = $props();

	const atStart = $derived(!canGoBack);
	const atEnd = $derived(position >= total);
</script>

<!-- Beside what someone is reading, because that is where they are looking when they want more. -->
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
	<span class="position" data-testid="position">Step {position} of {total}</span>
	{#if answerAt !== null}
		<Execute {answerAt} {onexecute} />
	{/if}
</div>

<style>
	.controls {
		display: flex;
		flex-wrap: wrap;
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
		margin-left: 4px;
		color: var(--muted);
		font-size: 12.5px;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
</style>
