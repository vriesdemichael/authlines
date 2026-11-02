<script lang="ts">
	import Worded from '#lib/components/Worded.svelte';
	import { markTerms } from '#lib/flow/glossary.ts';

	interface Props {
		answer: string;
		onterm?: (id: string) => void;
		serverNamed?: boolean;
		/** Goes back to where the flow starts, when someone is not there already. */
		onrewind?: (() => void) | null;
		/** What to follow through the flow, when its path is the answer. */
		follows?: string | null;
		onfollow?: () => void;
		/** Opens all that is left to someone in one list, when that is what they came for. */
		onlist?: (() => void) | null;
	}

	let {
		answer,
		onrewind = null,
		onterm,
		serverNamed = true,
		follows = null,
		onfollow,
		onlist = null
	}: Props = $props();
	const segments = $derived(markTerms([answer], { serverNamed })[0]);
</script>

<section class="answer" data-testid="answer" aria-label="The short answer">
	<p><Worded {segments} {onterm} /></p>
	{#if onrewind}
		<button type="button" class="rewind" data-testid="how-we-got-here" onclick={onrewind}>
			Walk through it from the start
		</button>
	{/if}
	{#if follows}
		<button type="button" class="rewind" data-testid="follow-answer" onclick={onfollow}>
			Follow the {follows} through the flow
		</button>
	{/if}
	{#if onlist}
		<button type="button" class="rewind" data-testid="answer-list" onclick={onlist}>
			See all of it in one list
		</button>
	{/if}
</section>

<style>
	.answer {
		margin: 0 0 16px;
		padding: 0 0 14px;
		border-bottom: 1px solid var(--line);
	}

	p {
		margin: 0;
		font-size: 15px;
		line-height: 1.45;
	}

	.rewind {
		display: block;
		margin-top: 6px;
		padding: 0;
		border: 0;
		background: none;
		color: var(--muted);
		font-size: 12px;
		text-decoration: underline;
	}
</style>
