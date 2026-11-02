<script lang="ts">
	import { onMount, tick, type Component } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import LearningMap from '#lib/components/LearningMap.svelte';
	import Mark from '#lib/components/Mark.svelte';
	import { mapNodes, mapTracks, type MapNode } from '#lib/map/tracks.ts';
	import { searchState } from '#lib/search/open.svelte.ts';
	import { sharingTags, SITE_NAME } from '#lib/site.ts';

	// The query string does not exist while prerendering, so where someone came from is marked after.
	let mounted = $state(false);
	let Living = $state<Component<{ node: MapNode; step?: string | null; href: string }>>();
	const nodeNamed = (id: string) => mapNodes.find((node) => node.id === id);
	const THE_PLAIN_FLOW = nodeNamed('how-access-works')!;
	const WITH_ONE_THING_ON = nodeNamed('who-logged-in')!;

	// The same step on both, so what moves is what that one setting does and nothing else.
	const SAME_STEP = 'token-response';
	const BY_ITSELF_AFTER_MS = 2000;
	const SETTLE_MS = 120;

	let showing = $state(THE_PLAIN_FLOW);
	let step = $state<string | null>(SAME_STEP);
	let pointed = false;
	let waiting: ReturnType<typeof setTimeout> | undefined;

	function point(node: MapNode) {
		pointed = true;
		clearTimeout(waiting);
		// So that passing over a question on the way to another does not set the diagram off.
		waiting = setTimeout(() => {
			showing = node;
			step = null;
		}, SETTLE_MS);
	}

	onMount(() => {
		mounted = true;
		const cameFrom = nodeNamed(page.url.searchParams.get('at') ?? '');
		if (cameFrom) {
			pointed = true;
			showing = cameFrom;
			step = null;
		}
		// After the page can be used, and not at all where there is no room for it beside the map.
		if (window.matchMedia('(min-width: 1100px)').matches) {
			import('#lib/components/LivingDiagram.svelte').then((module) => {
				Living = module.default as typeof Living;
				if (pointed || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
				// It moves once by itself, to show what this is, and then never again.
				waiting = setTimeout(() => {
					if (pointed) return;
					showing = WITH_ONE_THING_ON;
					step = null;
				}, BY_ITSELF_AFTER_MS);
			});
		}
		return () => clearTimeout(waiting);
	});

	const current = $derived(mounted ? page.url.searchParams.get('at') : null);
	const DESCRIPTION =
		"OAuth and OpenID Connect on one living diagram, with its messages recorded from a real Keycloak, a free identity provider you can run yourself. The specs are the same elsewhere, though the wording of errors, token formats and defaults are Keycloak's own. Pick a question and follow it, one message at a time.";
	const TITLE = `${SITE_NAME}: OAuth and OpenID Connect on one living diagram`;
	const sharing = sharingTags({
		title: TITLE,
		description: DESCRIPTION,
		path: '/'
	});
	const hrefOf = (node: MapNode) => resolve('/[flow]/[[view]]', { flow: node.flow, view: node.id });

	// After the navigation, which otherwise puts the page back at the top.
	afterNavigate(async () => {
		await tick();
		document.querySelector('[aria-current="location"]')?.scrollIntoView({ block: 'center' });
	});
</script>

<svelte:head>
	<title>{TITLE}</title>
	<meta name="description" content={DESCRIPTION} />
	{#each sharing as tag (tag.property ?? tag.name)}
		<meta {...tag} />
	{/each}
</svelte:head>

<main data-ready={mounted}>
	<div class="home">
		<div class="questions">
			<h1><Mark size={24} />{SITE_NAME}</h1>
			<p class="headline">Flip one thing. Watch the login change.</p>
			<p class="lead">
				OAuth and OpenID Connect on one living diagram, with its messages recorded from a real
				Keycloak, a free identity provider you can run yourself. The specs are the same elsewhere,
				though the wording of errors, token formats and defaults are Keycloak's own. Pick a question
				and follow it, one message at a time. New to this? Start with the first one.
			</p>
			<button
				type="button"
				class="search"
				data-testid="open-search"
				onclick={() => (searchState.open = true)}
			>
				Search for a word, a question, or an error
				<kbd>/</kbd>
			</button>
			<LearningMap
				tracks={mapTracks}
				{hrefOf}
				{current}
				showing={Living ? showing.id : null}
				onpoint={point}
			/>
			<p class="source" data-testid="source-link">
				Open source. See
				<a href="https://github.com/vriesdemichael/authlines" rel="external"
					>the code, the recordings and how they are checked</a
				>.
			</p>
		</div>
		{#if Living}
			<div class="beside">
				<Living node={showing} {step} href={hrefOf(showing)} />
			</div>
		{/if}
	</div>
</main>

<style>
	.source {
		margin: 24px 0 0;
		color: var(--muted);
		font-size: 12.5px;
	}

	main {
		max-width: 1360px;
		margin: 24px auto;
		padding: 0 24px;
	}

	.home {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 40px;
		align-items: start;
	}

	/* The room is only there on a wide screen, and the map is a plain list on anything else. */
	@media (min-width: 1100px) {
		.home {
			grid-template-columns: 420px minmax(0, 1fr);
		}
	}

	.questions {
		min-width: 0;
		max-width: 680px;
	}

	.beside {
		position: sticky;
		top: 16px;
		height: calc(100vh - 40px);
		min-width: 0;
	}

	h1 {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 0 0 14px;
		font-size: 17px;
		font-weight: 600;
	}

	.headline {
		margin: 0 0 6px;
		font-size: 24px;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.search {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		box-sizing: border-box;
		width: 100%;
		margin: 0 0 20px;
		padding: 8px 12px;
		color: var(--muted);
		text-align: left;
	}

	kbd {
		padding: 0 6px;
		border: 1px solid var(--line);
		border-radius: 4px;
		font: inherit;
		font-size: 12px;
	}

	.lead {
		max-width: 680px;
		margin: 0 0 16px;
		color: var(--muted);
		font-size: 14.5px;
	}
</style>
