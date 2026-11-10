<script lang="ts">
	interface Props {
		/** In pixels. Below 24 the lines are drawn heavier, so they still show. */
		size?: number;
	}

	let { size = 20 }: Props = $props();
</script>

<!-- Three lifelines and two messages: what has happened is quiet, and where you are stands out. -->
{#if size < 24}
	<svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
		<path class="lifeline" stroke-width="1.2" d="M2 1v14M8 1v14M14 1v14" />
		<path class="past" stroke-width="1.6" d="M2 5h3.5" />
		<path class="past-head" d="M5 2.4 8.2 5 5 7.6z" />
		<path class="now" stroke-width="2" d="M8 11h3.5" />
		<path class="now-head" d="M10.8 8 14.4 11l-3.6 3z" />
	</svg>
{:else}
	<svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
		<path class="lifeline" stroke-width="1.5" d="M6 4v24M16 4v24M26 4v24" />
		<path class="past" stroke-width="2" d="M6 11h7" />
		<path class="past-head" d="M12 7.6 16 11l-4 3.4z" />
		<path class="now" stroke-width="2.6" d="M16 21h7" />
		<path class="now-head" d="M22 17.2 26.4 21 22 24.8z" />
	</svg>
{/if}

<style>
	svg {
		flex: none;
		align-self: center;
	}

	path {
		fill: none;
	}

	.lifeline {
		stroke: var(--strong-line);
	}

	.past {
		stroke: var(--fg);
	}

	.past-head {
		fill: var(--fg);
	}

	.now {
		stroke: var(--here);
	}

	.now-head {
		fill: var(--here);
	}
</style>
