<script lang="ts">
	import { untrack } from 'svelte';
	import Diagram from '#lib/components/Diagram.svelte';
	import { freshIds } from '#lib/diagram/fresh.ts';
	import { layoutDiagram } from '#lib/diagram/layout.ts';
	import { diffViews, holdingsAt } from '#lib/flow/model.ts';
	import { nodeState, nodeView, type MapNode } from '#lib/map/nodes.ts';
	import { wayIn } from '#lib/map/way-in.ts';

	interface Props {
		node: MapNode;
		/** A step to show in place of the question's own. */
		step?: string | null;
		href: string;
		/** The first thing someone sees: one switch, between the old way and what came after it. */
		flip?: { on: boolean; onflip: (on: boolean) => void } | null;
	}

	let { node, step = null, href, flip = null }: Props = $props();

	const SAYS_WHAT_CHANGED_MS = 2600;
	let width = $state(0);
	let height = $state(0);
	let fresh = $state<ReadonlySet<string>>(new Set());
	const view = $derived(nodeView(node));
	let shown = untrack(() => view);

	$effect.pre(() => {
		if (view === shown) return;
		fresh = freshIds(diffViews(shown, view));
		shown = view;
	});

	// Nothing moves after this, so what just changed should not go on saying so.
	$effect(() => {
		if (!fresh.size) return;
		const quiet = setTimeout(() => (fresh = new Set()), SAYS_WHAT_CHANGED_MS);
		return () => clearTimeout(quiet);
	});

	const current = $derived(
		step && view.steps.some(({ id }) => id === step) ? step : nodeState(node).step
	);
	// A question is shown whole, because it has to fit, however long it is, and the words go under it.
	const layout = $derived(
		layoutDiagram(
			view,
			node.mode,
			width && height ? { width, height } : undefined,
			'plain',
			flip === null
		)
	);
	const eyes = $derived(nodeState(node).eyes);
	// Nothing someone has not been told about yet, and the one thing they have.
	const holdings = $derived.by(() => {
		const held = holdingsAt(view, current);
		if (!flip) return held;
		return Object.fromEntries(
			Object.entries(held).map(([lane, things]) => [
				lane,
				things.filter((thing) => thing === 'password')
			])
		);
	});
	const words = $derived(flip?.on ? wayIn.on : wayIn.off);
</script>

<section class="living" data-testid="living" data-node={node.id}>
	<!-- To look at. What can be done with it is in the link under it, and on the map beside it. -->
	<div class="picture" inert bind:clientWidth={width} bind:clientHeight={height}>
		<Diagram {layout} currentStep={current} {fresh} {eyes} {holdings} />
	</div>
	<div class="words">
		{#if flip}
			<strong>{words.title}</strong>
			<p data-testid="living-answer">{words.says}</p>
			<label class="flip">
				<input
					type="checkbox"
					data-testid="way-in-switch"
					checked={flip.on}
					onchange={(event) => flip.onflip(event.currentTarget.checked)}
				/>
				{wayIn.switch}
			</label>
			{#if flip.on}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the page resolves it -->
				<a {href} data-testid="living-open">{wayIn.on.link}</a>
			{/if}
		{:else}
			<strong>{node.title}</strong>
			<p data-testid="living-answer">{node.answer}</p>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the page resolves it -->
			<a {href} data-testid="living-open">Open this question</a>
		{/if}
	</div>
</section>

<style>
	.living {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		border: 1px solid var(--line);
		border-radius: 10px;
		overflow: hidden;
		background: var(--bg);
	}

	.picture {
		flex: 1;
		min-height: 0;
	}

	.words {
		flex: none;
		padding: 12px 16px;
		border-top: 1px solid var(--line);
		font-size: 14px;
	}

	p {
		margin: 2px 0 6px;
		color: var(--muted);
	}

	/* The one thing on the first screen that asks to be pressed. */
	.flip {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 10px 0 6px;
		font-weight: 600;
	}

	.flip input {
		width: 18px;
		height: 18px;
		accent-color: var(--accent);
	}
</style>
