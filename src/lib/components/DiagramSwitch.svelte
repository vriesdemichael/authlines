<script lang="ts">
	import type { DiagramId } from '#lib/flow/model.ts';

	interface Props {
		current: DiagramId;
		hrefs: Readonly<Record<DiagramId, string>>;
		caption: string;
		/** What to call the first one, where there is no user to name it after. */
		flowName?: string;
	}

	let { current, hrefs, caption, flowName = 'User flow' }: Props = $props();

	const diagrams: readonly { id: DiagramId; label: string }[] = $derived([
		{ id: 'flow', label: flowName },
		{ id: 'setup', label: 'Setup' }
	]);
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- the route resolves these -->
<nav aria-label="Which diagram" data-testid="diagram-switch">
	{#each diagrams as diagram (diagram.id)}
		<a
			href={hrefs[diagram.id]}
			aria-current={diagram.id === current ? 'page' : undefined}
			data-sveltekit-reset="false"
			data-diagram={diagram.id}
		>
			{diagram.label}
		</a>
	{/each}
	{#if caption}
		<p title={caption}>{caption}</p>
	{/if}
</nav>

<style>
	nav {
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
		padding: 6px 12px;
		border-bottom: 1px solid var(--line);
	}

	a {
		flex: none;
		padding: 3px 12px;
		border: 1px solid transparent;
		border-radius: 6px;
		color: var(--muted);
		font-weight: 600;
		text-decoration: none;
	}

	a:hover {
		border-color: var(--line);
	}

	a[aria-current='page'] {
		background: var(--accent-soft);
		color: var(--accent);
	}

	@media (forced-colors: active) {
		a[aria-current='page'] {
			background: Highlight;
			color: HighlightText;
			forced-color-adjust: none;
		}
	}

	/* What gives way when there is little room, because the switch is what it is there for. */
	p {
		overflow: hidden;
		min-width: 0;
		margin: 0 0 0 12px;
		color: var(--muted);
		font-size: 12px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
