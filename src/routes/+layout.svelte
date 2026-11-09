<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import '../app.css';
	import Hint from '#lib/components/Hint.svelte';
	import SearchDialog from '#lib/components/SearchDialog.svelte';
	import type { Result } from '#lib/search/search.ts';
	import { INDEXABLE } from '#lib/site.ts';

	// What app.html waits for, to tell the application not starting from it merely being slow.
	onMount(() => {
		document.documentElement.setAttribute('data-started', '');
	});

	let { children } = $props();

	const resultHref = (result: Result) => {
		// Asking what a word means is no reason to leave what is on screen.
		const explain = new URLSearchParams(result.query).get('explain');
		if (result.kind === 'word' && explain && page.params.flow) {
			const kept = [...page.url.searchParams].filter(([name]) => name !== 'explain');
			return `${page.url.pathname}?${new URLSearchParams([...kept, ['explain', explain]])}`;
		}
		return (
			resolve('/[flow]/[[view]]', { flow: result.flow, view: result.view }) +
			(result.query ? `?${result.query}` : '')
		);
	};
</script>

<svelte:head>
	{#if !INDEXABLE}
		<meta name="robots" content="noindex" />
	{/if}
</svelte:head>

{@render children()}

<SearchDialog hrefOf={resultHref} mapHref={resolve('/')} />
<Hint />
