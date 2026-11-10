<script lang="ts">
	import { hint } from '#lib/hint.svelte.ts';
	import type { RunValue } from '#lib/recordings/wire.ts';

	interface Props {
		/** What the run has made up by the current step. */
		values: readonly RunValue[];
		numberOf: (step: string) => number | null;
		onstep?: (step: string) => void;
	}

	let { values, numberOf, onstep }: Props = $props();
</script>

<section class="values" data-testid="run-values">
	<h4>What this run has so far</h4>
	{#if values.length}
		<ul>
			{#each values as value (value.value)}
				<li data-value={value.name}>
					<code class="name">{value.name}</code>
					<code class="text" use:hint={value.value}>{value.value}</code>
					<button type="button" class="from" onclick={() => onstep?.(value.step)}>
						step {numberOf(value.step)}
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<p>Nothing yet.</p>
	{/if}
</section>

<style>
	.values {
		margin-top: 10px;
	}

	h4 {
		margin: 0 0 4px;
		font-size: var(--size-small);
		font-weight: 600;
	}

	p {
		margin: 0;
		color: var(--muted);
		font-size: var(--size-small);
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: grid;
		grid-template-columns: minmax(0, 15ch) minmax(0, 1fr) auto;
		gap: 8px;
		align-items: baseline;
		padding: 2px 0;
		border-top: 1px solid var(--line);
		font-size: var(--size-small);
	}

	code {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.name {
		font-weight: 500;
	}

	.text {
		color: var(--muted);
	}

	.from {
		padding: 0;
		border: 0;
		background: none;
		color: var(--here);
		font-size: var(--size-small);
		text-decoration: underline;
		white-space: nowrap;
	}
</style>
