<script lang="ts">
	import { onMount, tick, type Component } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import LearningMap from '#lib/components/LearningMap.svelte';
	import Mark from '#lib/components/Mark.svelte';
	import { mapNodes, mapTracks, type MapNode } from '#lib/map/tracks.ts';
	import { wayIn } from '#lib/map/way-in.ts';
	import { searchState } from '#lib/search/open.svelte.ts';
	import { sharingTags, SITE_NAME } from '#lib/site.ts';

	interface LivingProps {
		node: MapNode;
		step?: string | null;
		href: string;
		flip?: { on: boolean; onflip: (on: boolean) => void } | null;
		startHref?: string;
		onstart?: () => void;
	}

	// The query string does not exist while prerendering, so where someone came from is marked after.
	let mounted = $state(false);
	let Living = $state<Component<LivingProps>>();
	const nodeNamed = (id: string) => mapNodes.find((node) => node.id === id);
	// Someone who knows none of the words starts with this, and flips it themselves (#150).
	const THE_WAY_IN = nodeNamed(wayIn.node)!;
	const FLIPS_TO = nodeNamed(wayIn.flipsTo.node)!;

	// Resting the mouse on a question changes nothing here, because the diagram moving under it made
	// the steps hard to follow. A question someone came back from is on show, and this is the way back.
	let showing = $state.raw(THE_WAY_IN);
	let flipped = $state(false);
	const onTheWayIn = $derived(showing === THE_WAY_IN);

	function backToTheStart() {
		showing = THE_WAY_IN;
		flipped = false;
	}

	onMount(() => {
		mounted = true;
		// After the page can be used, and not at all where there is no room for it beside the map.
		if (window.matchMedia('(min-width: 1100px)').matches) {
			import('#lib/components/LivingDiagram.svelte').then((module) => {
				Living = module.default as typeof Living;
			});
		}
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
		// Where someone came from, or the start, including when Back brings them to it.
		showing = nodeNamed(page.url.searchParams.get('at') ?? '') ?? THE_WAY_IN;
		flipped = false;
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
			<h1>
				<a href={resolve('/')} data-testid="home-start" onclick={backToTheStart}>
					<Mark size={24} />{SITE_NAME}
				</a>
			</h1>
			<p class="headline">Flip one thing. Watch the login change.</p>
			<p class="lead">{wayIn.lead}</p>
			<button
				type="button"
				class="search"
				data-testid="open-search"
				onclick={() => (searchState.open = true)}
			>
				Search for a word, a question, or an error
				<kbd>/</kbd>
			</button>
			<LearningMap tracks={mapTracks} {hrefOf} {current} showing={Living ? showing.id : null} />
			<p class="source" data-testid="source-link">
				Recorded from Keycloak, a free identity provider
				<a href={resolve('/run-it-yourself')}>you can run yourself</a>. The specs are the same
				elsewhere, though the wording of errors, token formats and defaults are Keycloak's own. Open
				source: see
				<a href="https://github.com/vriesdemichael/authlines" rel="external"
					>the code, the recordings and how they are checked</a
				>. Your AI agent can link here too, with your names on the parties:
				<a href={resolve('/for-agents')} data-testid="agents-link">set it up</a>.
			</p>
		</div>
		{#if Living}
			<div class="beside">
				<Living
					node={onTheWayIn && flipped ? FLIPS_TO : showing}
					step={onTheWayIn ? (flipped ? wayIn.flipsTo.step : wayIn.step) : null}
					href={hrefOf(onTheWayIn ? FLIPS_TO : showing)}
					flip={onTheWayIn ? { on: flipped, onflip: (on) => (flipped = on) } : null}
					startHref={resolve('/')}
					onstart={backToTheStart}
				/>
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
			grid-template-columns: 440px minmax(0, 1fr);
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

	h1 a {
		display: flex;
		align-items: center;
		gap: 10px;
		color: inherit;
		text-decoration: none;
	}

	h1 {
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
		margin: 0 0 18px;
		color: var(--muted);
		font-size: 15.5px;
	}
</style>
