<script lang="ts">
	import type { DiagramId } from '#lib/flow/model.ts';
	import { hint } from '#lib/hint.svelte.ts';

	interface Props {
		current: DiagramId;
		hrefs: Readonly<Record<DiagramId, string>>;
		/** What the one on screen shows, said where the pointer rests on its name (#231). */
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
			use:hint={diagram.id === current && caption ? caption : undefined}
		>
			{diagram.label}
		</a>
	{/each}
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
		border-radius: var(--radius);
		color: var(--muted);
		font-weight: 600;
		text-decoration: none;
	}

	a:hover {
		border-color: var(--line);
	}

	a[aria-current='page'] {
		background: var(--here-soft);
		color: var(--here);
	}

	@media (forced-colors: active) {
		a[aria-current='page'] {
			background: Highlight;
			color: HighlightText;
			forced-color-adjust: none;
		}
	}
</style>
