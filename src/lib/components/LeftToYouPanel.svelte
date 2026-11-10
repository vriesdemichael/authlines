<script lang="ts">
	import { onMount } from 'svelte';
	import Worded from '#lib/components/Worded.svelte';
	import { markTerms } from '#lib/flow/glossary.ts';
	import type { LeftItem, LeftToYou } from '#lib/flow/left-to-you.ts';

	interface Props {
		list: LeftToYou;
		serverNamed?: boolean;
		onstep?: (item: LeftItem) => void;
		onterm?: (id: string) => void;
		onclose: () => void;
	}

	let { list, serverNamed = true, onstep, onterm, onclose }: Props = $props();

	let heading = $state<HTMLElement>();
	onMount(() => heading?.focus());

	const texts = $derived(list.groups.flatMap(({ items }) => items.map(({ text }) => text)));
	const worded = $derived(markTerms(texts, { serverNamed }));
	const offsets = $derived(
		list.groups.map((_, index) =>
			list.groups.slice(0, index).reduce((sum, { items }) => sum + items.length, 0)
		)
	);
</script>

<aside aria-label="What is left to you" data-testid="left-to-you">
	<header>
		<h2 tabindex="-1" bind:this={heading}>What is left to you</h2>
		<button type="button" data-testid="left-close" onclick={onclose}>Close</button>
	</header>
	<p class="with">All the steps say about it, with the settings as they are.</p>
	{#if list.larger}
		<p class="larger" data-testid="left-larger">
			<strong>The largest part is not on the diagram.</strong>
			{list.larger}
		</p>
	{/if}
	{#each list.groups as group, at (group.id)}
		<section data-group={group.id}>
			<h3>{group.title}</h3>
			<ul>
				{#each group.items as item, index (`${item.step}:${item.title}`)}
					<li data-left={item.step}>
						<button type="button" class="step" onclick={() => onstep?.(item)}>{item.title}</button>
						<span><Worded segments={worded[offsets[at] + index]} {onterm} /></span>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</aside>

<style>
	aside {
		overflow-y: auto;
		height: 100%;
		padding: 14px 16px;
		background: var(--bg);
		font-size: var(--size-ui);
	}

	header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
	}

	h2 {
		margin: 0;
		font-size: var(--size-title);
	}

	h2:focus {
		outline: none;
	}

	h3 {
		margin: 16px 0 6px;
		font-size: var(--size-ui);
	}

	.with {
		margin: 2px 0 10px;
		color: var(--muted);
		font-size: var(--size-ui);
	}

	.larger {
		margin: 0;
		padding: 8px 10px;
		border-radius: var(--radius);
		background: var(--here-soft);
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		margin-bottom: 10px;
	}

	.step {
		display: block;
		padding: 0;
		border: 0;
		background: none;
		color: var(--link, var(--here));
		font: inherit;
		font-weight: 600;
		text-align: left;
		text-decoration: underline;
		cursor: pointer;
	}

	@media print {
		aside {
			overflow: visible;
			height: auto;
			padding: 0;
		}

		[data-testid='left-close'] {
			display: none;
		}

		.step {
			color: inherit;
			text-decoration: none;
		}

		li {
			break-inside: avoid;
		}
	}
</style>
