<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { asset, resolve } from '$app/paths';
	import { page } from '$app/state';
	import Workspace from '#lib/components/Workspace.svelte';
	import { flows } from '#lib/flow/index.ts';
	import {
		parseState,
		presetSearch,
		serializeOnNode,
		serializeState,
		stateInFlow,
		type AppState
	} from '#lib/flow/state.ts';
	import type { Settings } from '#lib/flow/settings.ts';
	import {
		nextQuestion,
		nodeMatching,
		nodeSearch,
		stillAnswers,
		type MapNode
	} from '#lib/map/nodes.ts';
	import { sharingTags } from '#lib/site.ts';
	import type { Recording } from '#lib/recordings/format.ts';
	import { loadsOnce } from '#lib/recordings/load.ts';

	let { data } = $props();

	// The query string does not exist while prerendering, so the first render is the default state.
	let mounted = $state(false);
	let settled = $state(false);

	onMount(async () => {
		mounted = true;
		await tick();
		document.documentElement.classList.remove('pending');
		settled = true;
	});

	const base = $derived(flows[data.flowId]);
	const added = $derived(mounted ? page.url.search : '');
	const fromUrl = $derived(
		parseState(base, data.diagram, data.node ? nodeSearch(data.node, added) : added)
	);

	// The state changes at once and the URL catches up, so quick key presses are not lost.
	let ahead = $state.raw<AppState | null>(null);
	const appState = $derived(ahead ?? fromUrl);
	const flow = $derived(base.diagrams[appState.diagram]);

	const here = $derived(nodeMatching(appState));

	// The question someone came with stays until the settings no longer answer it, though the address
	// moves on from the node's own after the first step.
	let asked = $state.raw<MapNode | null>(null);
	$effect.pre(() => {
		if (data.node) asked = data.node;
	});
	const question = $derived.by(() => {
		const candidate = data.node ?? asked;
		return candidate && stillAnswers(candidate, appState) ? candidate : null;
	});
	// Someone exploring from a question should be able to get back to it.
	const nodeHref = (node: MapNode) =>
		resolve('/[flow]/[[view]]', { flow: node.flow, view: node.id });
	const leftQuestion = $derived(
		asked && !question ? { title: asked.title, href: nodeHref(asked) } : null
	);
	const onward = $derived.by(() => {
		const next = question && nextQuestion(question);
		return next
			? {
					title: next.title,
					summary: next.summary,
					href: resolve('/[flow]/[[view]]', { flow: next.flow, view: next.id })
				}
			: null;
	});

	const title = $derived(question?.title ?? flow.title);
	const description = $derived(data.node?.answer ?? flow.summary);
	const sharing = $derived(
		sharingTags({
			title,
			description,
			path: data.node
				? `/${data.flowId}/${data.node.id}/`
				: `/${data.flowId}/${data.diagram === 'setup' ? 'setup/' : ''}`,
			image: data.node?.id
		})
	);

	function hrefFor(state: AppState) {
		// The address of the question, for as long as the question still holds, so a reload or a link
		// keeps it.
		if (question && stillAnswers(question, state)) {
			const node = resolve('/[flow]/[[view]]', { flow: base.id, view: question.id });
			return `${node}?${serializeOnNode(base, state)}`;
		}
		const search = serializeState(base, state);
		const view = state.diagram === 'setup' ? 'setup' : undefined;
		return resolve('/[flow]/[[view]]', { flow: base.id, view }) + (search ? `?${search}` : '');
	}

	async function loadText(file: string) {
		const response = await fetch(asset(`/rfc/${file}` as Parameters<typeof asset>[0]));
		if (!response.ok) throw new Error(`${file}: ${response.status}`);
		return response.text();
	}

	const fetchRecording = loadsOnce(async (path) => {
		const response = await fetch(asset(path as Parameters<typeof asset>[0]));
		if (!response.ok) throw new Error(`${path}: ${response.status}`);
		return (await response.json()) as Recording;
	});
	const loadRecording = (preset: string) => fetchRecording(`/recordings/${base.id}/${preset}.json`);
	const pageImage = (shot: string) =>
		asset(`/recordings/pages/${shot}.jpg` as Parameters<typeof asset>[0]);

	const flowChoices = Object.values(flows).map((other) => ({
		id: other.id,
		title: other.diagrams.flow.title
	}));
	// So that what someone set up in one flow is still there when they come back to it. Only for as
	// long as they stay on the site, because the address of each flow says only what that flow has.
	const leftIn: Record<string, Settings> = {};
	$effect(() => {
		leftIn[appState.flow] = appState.settings;
	});
	function goToFlow(id: string) {
		const other = flows[id];
		const next = stateInFlow(other, base, appState, leftIn[id]);
		const search = serializeState(other, next);
		const there = resolve('/[flow]/[[view]]', { flow: id, view: undefined });
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved above
		return goto(search ? `${there}?${search}` : there);
	}

	async function navigate(next: AppState, history: 'push' | 'replace') {
		ahead = next;
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- hrefFor resolves it
		await goto(hrefFor(next), { replace: history === 'replace', reset: false });
		if (ahead === next) ahead = null;
	}

	// Older links name setup in the query, or a step from the other diagram (ADR-003).
	$effect(() => {
		if (!mounted) return;
		const outdated = fromUrl.diagram !== data.diagram || page.url.searchParams.has('setup');
		if (outdated) untrack(() => navigate(fromUrl, 'replace'));
	});
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	{#each sharing as tag (tag.property ?? tag.name)}
		<meta {...tag} />
	{/each}
</svelte:head>

<!-- Another flow is another diagram, so nothing here moves from one into the other. -->
{#key base.id}
	<Workspace
		{base}
		state={appState}
		animate={settled}
		question={question?.title ?? null}
		answer={question?.answer ?? null}
		questionFollows={question?.follows ?? null}
		{leftQuestion}
		{onward}
		runHref={base.id === 'authorization-code'
			? `${resolve('/run-it-yourself')}/?${presetSearch(base, appState.settings)}`
			: null}
		homeHref={resolve('/') + ((question ?? here) ? `?at=${(question ?? here)?.id}` : '')}
		{hrefFor}
		{loadText}
		{loadRecording}
		{pageImage}
		{flowChoices}
		questionOffersList={question?.offersList ?? false}
		onflow={goToFlow}
		onnavigate={navigate}
	/>
{/key}
