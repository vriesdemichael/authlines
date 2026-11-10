<script lang="ts">
	import { untrack } from 'svelte';
	import Picture from '#lib/components/Picture.svelte';
	import type { Opens, Picture as PictureData } from '#lib/pictures/index.ts';
	import type { Term } from '#lib/flow/glossary.ts';
	import { LONGEST_NAME } from '#lib/flow/names.ts';
	import { artifacts, type ArtifactId } from '#lib/flow/vocabulary.ts';
	import { refLabel, type SourceRef } from '#lib/sources/sources.ts';

	interface Props {
		title: string;
		text: string;
		/** For a lifeline: what it has seen so far. */
		seen?: readonly ArtifactId[];
		/** For a credential or token: who has seen it so far. */
		seenBy?: readonly string[];
		sources?: readonly SourceRef[];
		alsoCalled?: readonly string[];
		/** The parts of the diagram to choose from. */
		parts?: readonly Term[];
		onpart?: (id: string) => void;
		/** Where this can be seen, when it is not on screen as things stand. */
		seeIt?: string | null;
		/** It is about the server, which someone can leave out. */
		onleaveout?: (() => void) | null;
		/** It is about a party, whose view can be shown, and whether it is. */
		onseeonly?: (() => void) | null;
		seeingOnly?: boolean;
		/** Who, as a sentence says it, so the button names whose view it shows. */
		seenAs?: string;
		/** It is about something with a path to follow, and whether that is being done. */
		onfollow?: (() => void) | null;
		following?: boolean;
		onexplainartifact?: (id: ArtifactId) => void;
		onopensource?: (ref: SourceRef) => void;
		onclose: () => void;
		/** It is about a party, which someone can give a name of their own (#168). */
		rename?: Rename | null;
		/** A picture, where one says it better than words (#167), and where a part of it goes. */
		picture?: PictureData | null;
		onopenpart?: (opens: Opens) => void;
	}

	interface Rename {
		/** What a link or someone gave it, if anything. */
		current: string | null;
		/** Puts the name on, or says what is wrong with it. */
		apply: (name: string) => string | null;
		reset: () => void;
		/** Opened for this, by a right-click or a long press, so the field is ready. */
		focus: boolean;
	}

	let {
		title,
		text,
		seen,
		seenBy,
		sources = [],
		alsoCalled = [],
		parts = [],
		onpart,
		seeIt = null,
		onleaveout = null,
		onseeonly = null,
		seeingOnly = false,
		seenAs = 'this party',
		onfollow = null,
		following = false,
		onexplainartifact,
		onopensource,
		onclose,
		rename = null,
		picture = null,
		onopenpart
	}: Props = $props();

	let typed = $state('');
	let refused = $state<string | null>(null);
	let field = $state<HTMLInputElement>();
	// Typing and pressing the button is what renames, so a stray click on the diagram cannot.
	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!rename) return;
		refused = rename.apply(typed);
		if (!refused) typed = '';
	}

	// From one word to the next is the same dialog, so whoever pressed it should be told where they are.
	let heading = $state<HTMLElement>();
	// Each state change passes new props, so this keeps anything else from taking the focus back here.
	const named = $derived(title);
	$effect(() => {
		void named;
		untrack(() => heading)?.focus({ preventScroll: true });
	});
	// After the heading, so that someone who asked to rename it can start typing.
	$effect(() => {
		if (rename?.focus) untrack(() => field)?.focus({ preventScroll: true });
	});
</script>

<section data-testid="explanation">
	<header>
		<h2 tabindex="-1" bind:this={heading}>{title}</h2>
		<button type="button" data-testid="explanation-close" onclick={onclose}>Close</button>
	</header>
	<p>{text}</p>
	{#if picture}
		<Picture {picture} onopen={onopenpart} />
		<!-- A picture from the standards alone, with nothing recorded to open, does not say it. -->
		{#if picture.parts.some((part) => part.opens)}
			<p class="seen" data-testid="picture-hint">Each part opens the steps it stands for.</p>
		{/if}
	{/if}
	{#if alsoCalled.length}
		<p class="seen" data-testid="explanation-also-called">Also called: {alsoCalled.join('; ')}.</p>
	{/if}
	{#if parts.length}
		<p class="parts" data-testid="explanation-parts">
			{#each parts as part (part.id)}
				<button type="button" class="chip" data-part={part.id} onclick={() => onpart?.(part.id)}>
					{part.name}
				</button>
			{/each}
		</p>
	{/if}
	{#if seeIt}
		<p class="seen">
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the route resolves it -->
			<a href={seeIt} data-sveltekit-reset="false" data-testid="explanation-see-it"
				>See it on the diagram</a
			>
		</p>
	{/if}
	{#if onleaveout}
		<p class="seen">
			<button type="button" class="chip" data-testid="leave-out-server" onclick={onleaveout}>
				Leave out what is only about Keycloak
			</button>
		</p>
	{/if}
	{#if onseeonly}
		<p class="seen">
			<button type="button" class="chip" data-testid="see-only" onclick={onseeonly}>
				{seeingOnly ? 'Show everything again' : `Grey out what ${seenAs} never saw`}
			</button>
		</p>
	{/if}
	{#if rename}
		<form class="rename" data-testid="rename" onsubmit={submit}>
			<label for="rename-field">Call it</label>
			<input
				id="rename-field"
				data-testid="rename-field"
				bind:this={field}
				bind:value={typed}
				maxlength={LONGEST_NAME}
				autocomplete="off"
				placeholder={rename.current ?? 'A name of your own'}
			/>
			<button type="submit" data-testid="rename-apply">Use this name</button>
			{#if rename.current}
				<button type="button" class="quiet" data-testid="rename-reset" onclick={rename.reset}>
					Back to the site's name
				</button>
			{/if}
			{#if refused}
				<p role="alert" data-testid="rename-refused">This name {refused}.</p>
			{/if}
			<p class="aside">Only on the diagram, and in the address after the #. Back undoes it.</p>
		</form>
	{/if}
	{#if onfollow}
		<p class="seen">
			<button type="button" class="chip" data-testid="follow-it" onclick={onfollow}>
				{following ? 'Stop following' : 'Follow it through the flow'}
			</button>
		</p>
	{/if}
	{#if seen}
		<p class="seen" data-testid="explanation-seen">
			{#if seen.length}
				Has seen so far:
				{#each seen as id (id)}
					<button
						type="button"
						class="token"
						data-artifact={id}
						onclick={() => onexplainartifact?.(id)}
					>
						{artifacts[id].label}
					</button>
				{/each}
			{:else}
				Has seen nothing so far.
			{/if}
		</p>
	{/if}
	{#if seenBy}
		<p class="seen" data-testid="explanation-seen-by">
			{#if seenBy.length}
				Seen so far by: {seenBy.join(', ')}.
			{:else}
				Nobody has seen this yet.
			{/if}
		</p>
	{/if}
	{#if sources.length}
		<p class="seen">
			Read more:
			{#each sources as ref (ref.source)}
				<button
					type="button"
					class="as-link source"
					data-name-source={ref.source}
					onclick={() => onopensource?.(ref)}
				>
					{refLabel(ref)}</button
				>
			{/each}
		</p>
	{/if}
</section>

<style>
	section {
		padding: 16px 18px;
	}

	header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
	}

	h2 {
		margin: 0 0 8px;
		font-size: var(--size-title);
		font-weight: 600;
	}

	h2:focus {
		outline: none;
	}

	p {
		margin: 0 0 8px;
		font-size: var(--size-body);
	}

	p:last-child {
		margin-bottom: 0;
	}

	.seen {
		color: var(--muted);
		font-size: var(--size-ui);
	}

	.rename {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 8px;
		align-items: center;
		margin: 12px 0 0;
		font-size: var(--size-ui);
	}

	.rename input {
		flex: 1 1 140px;
		min-width: 0;
		font: inherit;
	}

	.rename p {
		flex-basis: 100%;
		margin: 0;
	}

	.rename .aside {
		color: var(--muted);
	}

	.parts {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	button:not(.token, .as-link) {
		padding: 0 8px;
		font-size: var(--size-small);
	}

	.source {
		margin-right: 10px;
	}
</style>
