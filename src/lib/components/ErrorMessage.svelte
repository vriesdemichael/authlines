<script lang="ts">
	interface Props {
		status: number;
		homeHref: string;
		/** Loads this address again. */
		onretry?: () => void;
	}

	let { status, homeHref, onretry }: Props = $props();
	const missing = $derived(status === 404);
</script>

<main data-testid="error-message" data-status={status}>
	{#if missing}
		<h1>There is no page here</h1>
		<p>The address may be mistyped, or what was here may have moved.</p>
		<p>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the route resolves it -->
			<a href={homeHref}>Go to the map</a>
		</p>
	{:else}
		<h1>That did not load</h1>
		<p>Part of this page could not be fetched, which usually means the connection dropped.</p>
		<p class="actions">
			<button type="button" class="again" data-testid="try-again" onclick={onretry}
				>Try again</button
			>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the route resolves it -->
			<a href={homeHref}>Go to the map</a>
		</p>
	{/if}
</main>

<style>
	main {
		max-width: 640px;
		margin: 48px auto;
		padding: 0 16px;
	}

	h1 {
		margin: 0 0 8px;
		font-size: var(--size-headline);
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.again {
		background: var(--here);
		border-color: var(--here);
		color: var(--on-tone);
		font-weight: 600;
	}
</style>
