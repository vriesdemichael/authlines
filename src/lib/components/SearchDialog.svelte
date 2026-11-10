<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { searchState } from '#lib/search/open.svelte.ts';
	import type { Found, Result, ResultKind } from '#lib/search/search.ts';
	import { resultKey } from '#lib/search/result-key.ts';

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
	let failed = $state(false);
	// Someone who pressed the browser's own key may want that back.
	let byFind = $state(false);
	let loading = false;

	const GIVE_UP_MS = 5000;

	function getReady() {
		if (run || loading) return;
		loading = true;
		failed = false;
		// Saying so does not stop it, and if it does arrive after all, it is used.
		const giveUp = setTimeout(() => (failed = true), GIVE_UP_MS);
		load()
			.then(
				(search) => {
					run = search;
					failed = false;
				},
				() => {
					failed = true;
				}
			)
			.finally(() => {
				clearTimeout(giveUp);
				loading = false;
			});
	}

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
			untrack(getReady);
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
		} else if (
			(event.ctrlKey || event.metaKey) &&
			!event.shiftKey &&
			!event.altKey &&
			event.key.toLowerCase() === 'f'
		) {
			// Pressed again it is the browser's, and so it is over a text with lines of its own to look through.
			if (searchState.open) {
				close();
			} else if (!document.querySelector('dialog[open]')) {
				event.preventDefault();
				byFind = true;
				searchState.open = true;
			}
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
		byFind = false;
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
			{#if failed}
				That did not load, which usually means the connection dropped or the site just changed.
				<button
					type="button"
					class="again"
					data-testid="search-again"
					onclick={() => window.location.reload()}>Try again</button
				>
				<!-- Safari holds on to a script that failed for as long as the tab is open. -->
				If it still does not load, a new tab will.
			{:else if !typed}
				For example: SSO, refresh token, or the error on your screen.
				{#if byFind}Press it again for the browser's own find.{/if}
			{:else if found.notHereYet}
				This does not cover {found.notHereYet} yet.
			{:else if !run}
				Getting ready.
			{:else if !found.results.length}
				Nothing here about that yet.
			{:else if found.closest}
				Nothing with all of those words. The closest:
			{:else}
				{found.results.length === 1 ? '1 result' : `${found.results.length} results`}
			{/if}
		</p>

		{#if typed && run && !found.results.length}
			<p class="nothing" data-testid="search-nothing">
				The <a href={mapHref} onclick={close}>map</a> lists every question, and
				<a
					href="https://github.com/vriesdemichael/authlines/issues/new?template=suggest-a-question.yml"
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
		border-radius: var(--radius);
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
		border-radius: var(--radius);
		background: var(--raised);
		color: var(--fg);
		font: inherit;
	}

	.count,
	.nothing {
		margin: 8px 2px;
		color: var(--muted);
		font-size: var(--size-ui);
	}

	.again {
		padding: 0 8px;
		font-size: var(--size-ui);
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li a {
		display: block;
		padding: 8px 10px;
		border-radius: var(--radius);
		color: inherit;
		text-decoration: none;
	}

	li a:hover,
	li a.active {
		background: var(--here-soft);
	}

	.kind {
		display: block;
		color: var(--muted);
		font-size: var(--size-small);
	}

	strong {
		display: block;
		font-weight: 600;
	}

	.says {
		display: block;
		color: var(--muted);
		font-size: var(--size-ui);
	}
</style>
