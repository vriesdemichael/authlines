<script lang="ts">
	import { tick } from 'svelte';
	import { searchState } from '#lib/search/open.svelte.ts';
	import type { Found, Result, ResultKind } from '#lib/search/search.ts';
	import { resultKey } from '#lib/search/search.ts';

	interface Props {
		hrefOf: (result: Result) => string;
		/** Where to look when there is nothing to find. */
		mapHref: string;
		/** Loads the search itself, on first use, so that it adds nothing to loading a page. */
		load?: () => Promise<(query: string) => Found>;
	}

	let {
		hrefOf,
		mapHref,
		load = async () => (await import('#lib/search/search.ts')).search
	}: Props = $props();

	let dialog = $state<HTMLDialogElement>();
	let input = $state<HTMLInputElement>();
	let query = $state('');
	let run = $state<((query: string) => Found) | null>(null);
	let active = $state(0);

	const found = $derived<Found>(
		run && query.trim() ? run(query) : { results: [], notHereYet: null }
	);
	const typed = $derived(query.trim().length >= 2);

	const kinds: Record<ResultKind, string> = {
		error: 'What a real server said',
		question: 'Question',
		word: 'Word',
		setting: 'Setting',
		step: 'Step',
		note: 'On the server'
	};

	$effect(() => {
		if (!dialog) return;
		if (searchState.open && !dialog.open) {
			dialog.showModal();
			tick().then(() => input?.focus());
			load().then((search) => {
				run = search;
			});
		} else if (!searchState.open && dialog.open) {
			dialog.close();
		}
	});

	$effect(() => {
		void found;
		active = 0;
	});

	function onwindowkey(event: KeyboardEvent) {
		const target = event.target as HTMLElement;
		const typing = target.closest('input:not([type="checkbox"]), select, textarea');
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			searchState.open = true;
		} else if (event.key === '/' && !typing && !event.altKey && !event.ctrlKey && !event.metaKey) {
			event.preventDefault();
			searchState.open = true;
		}
	}

	function oninputkey(event: KeyboardEvent) {
		const count = found.results.length;
		if (event.key === 'ArrowDown' && count) {
			event.preventDefault();
			active = (active + 1) % count;
		} else if (event.key === 'ArrowUp' && count) {
			event.preventDefault();
			active = (active - 1 + count) % count;
		} else if (event.key === 'Escape') {
			// At once, where a search box would first clear itself and stay open.
			event.preventDefault();
			close();
		} else if (event.key === 'Enter' && count) {
			event.preventDefault();
			dialog?.querySelector<HTMLAnchorElement>(`[data-result="${active}"]`)?.click();
		}
	}

	const close = () => {
		searchState.open = false;
		query = '';
	};

	// The browser says it closed a moment later, and by then someone may have opened it again.
	const closed = () => {
		if (!dialog?.open) close();
	};
</script>

<svelte:window onkeydown={onwindowkey} />

<!-- eslint-disable svelte/no-navigation-without-resolve -- the route resolves these, and one is another site -->
<dialog
	bind:this={dialog}
	data-testid="search"
	aria-label="Search"
	oncancel={close}
	onclose={closed}
	onclick={(event) => {
		// A click on the backdrop lands on the dialog itself.
		if (event.target === dialog) close();
	}}
>
	<div class="inside">
		<input
			bind:this={input}
			bind:value={query}
			type="search"
			data-testid="search-input"
			placeholder="A word, a question, or a pasted error"
			aria-label="A word, a question, or a pasted error"
			aria-controls="search-results"
			autocomplete="off"
			spellcheck="false"
			onkeydown={oninputkey}
		/>

		<p class="count" role="status" data-testid="search-status">
			{#if !typed}
				For example: SSO, refresh token, or the error on your screen.
			{:else if found.notHereYet}
				This does not cover {found.notHereYet} yet.
			{:else if !run}
				Getting ready.
			{:else if !found.results.length}
				Nothing here about that yet.
			{:else}
				{found.results.length === 1 ? '1 result' : `${found.results.length} results`}
			{/if}
		</p>

		{#if typed && run && !found.results.length}
			<p class="nothing" data-testid="search-nothing">
				The <a href={mapHref} onclick={close}>map</a> lists every question, and
				<a
					href="https://github.com/vriesdemichael/authlines/issues/new"
					target="_blank"
					rel="noreferrer">you can suggest this one</a
				>.
			</p>
		{/if}

		<ul id="search-results">
			{#each found.results as result, index (resultKey(result))}
				<li>
					<a
						href={hrefOf(result)}
						class:active={index === active}
						data-result={index}
						data-kind={result.kind}
						onclick={close}
					>
						<span class="kind">{kinds[result.kind]}</span>
						<strong>{result.title}</strong>
						<span class="says">{result.says}</span>
					</a>
				</li>
			{/each}
		</ul>
	</div>
</dialog>

<style>
	dialog {
		width: min(640px, calc(100vw - 32px));
		max-height: 70vh;
		margin: 10vh auto auto;
		padding: 0;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: var(--bg);
		color: var(--fg);
	}

	dialog::backdrop {
		background: rgb(0 0 0 / 0.3);
	}

	.inside {
		padding: 12px;
	}

	input {
		box-sizing: border-box;
		width: 100%;
		padding: 8px 10px;
		border: 1px solid var(--strong-line);
		border-radius: 7px;
		background: var(--raised);
		color: var(--fg);
		font: inherit;
	}

	.count,
	.nothing {
		margin: 8px 2px;
		color: var(--muted);
		font-size: 12.5px;
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li a {
		display: block;
		padding: 8px 10px;
		border-radius: 7px;
		color: inherit;
		text-decoration: none;
	}

	li a:hover,
	li a.active {
		background: var(--accent-soft);
	}

	.kind {
		display: block;
		color: var(--muted);
		font-size: 11.5px;
	}

	strong {
		display: block;
		font-weight: 600;
	}

	.says {
		display: block;
		color: var(--muted);
		font-size: 13px;
	}
</style>
