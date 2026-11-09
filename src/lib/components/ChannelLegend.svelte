<script lang="ts">
	import { channels, type Channel } from '#lib/flow/vocabulary.ts';
	import { hint } from '#lib/hint.svelte.ts';

	interface Props {
		present: readonly Channel[];
	}

	let { present }: Props = $props();

	const order: readonly Channel[] = ['front', 'back', 'people'];
	const shown = $derived(order.filter((channel) => present.includes(channel)));
</script>

<ul data-testid="channel-legend">
	{#each shown as channel (channel)}
		<li use:hint={channels[channel].explains}>
			<svg viewBox="0 0 28 8" aria-hidden="true" class={channel}>
				<line x1="1" x2="27" y1="4" y2="4" />
			</svg>
			{channels[channel].label}
		</li>
	{/each}
</ul>

<style>
	ul {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 2px 18px;
		margin: 0;
		padding: 6px 12px;
		list-style: none;
		color: var(--muted);
		font-size: 11.5px;
	}

	li {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.held {
		margin-left: auto;
	}

	svg {
		width: 28px;
		height: 8px;
	}

	line {
		stroke-width: 2.4;
	}

	.front line {
		stroke: var(--front);
	}

	.back line {
		stroke: var(--back);
	}

	.people line {
		stroke: var(--people);
		stroke-dasharray: 1.5 5;
		stroke-linecap: round;
	}
</style>
