<script lang="ts">
	import type { Segment } from '#lib/flow/glossary.ts';

	interface Props {
		segments: readonly Segment[];
		onterm?: (id: string) => void;
	}

	let { segments, onterm }: Props = $props();

	const PUNCTUATION = /^[.,;:!?)]+/;
	const marked = (index: number) => Boolean(segments[index]?.term && onterm);
	/** A button can end a line, so what follows it straight away has to stay with it. */
	const stuckTo = (index: number) =>
		marked(index) && !marked(index + 1)
			? (PUNCTUATION.exec(segments[index + 1]?.text ?? '')?.[0] ?? '')
			: '';
</script>

{#each segments as segment, index (index)}
	{#if segment.term && onterm}
		{@const id = segment.term.id}
		<span class="together"
			><button type="button" class="term" data-term={id} onclick={() => onterm(id)}>
				{segment.text}
			</button>{stuckTo(index)}</span
		>
	{:else}
		{segment.text.slice(stuckTo(index - 1).length)}
	{/if}
{/each}

<style>
	.together {
		white-space: nowrap;
	}

	/* Quiet, because a step can have several, and what it says matters more. */
	.term {
		display: inline;
		margin: 0;
		padding: 0;
		border: 0;
		border-radius: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-decoration: underline dotted var(--strong-line);
		text-underline-offset: 3px;
		cursor: help;
	}

	.term:hover {
		color: var(--accent);
		text-decoration-color: var(--accent);
	}

	@media print {
		.term {
			text-decoration: none;
		}
	}
</style>
