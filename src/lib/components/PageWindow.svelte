<script lang="ts">
	import { terms } from '#lib/flow/glossary.ts';
	import { firstSentence, hint } from '#lib/hint.svelte.ts';
	import { readAddress } from '#lib/recordings/address.ts';
	import { keyWhy } from '#lib/recordings/key-why.ts';

	interface Props {
		/** As it was recorded. Nothing when these settings were not, and it is not made up. */
		address: string | null;
		/**
		 * Whether these settings have a recording, and whether it has come. Without one, the picture is
		 * from a run with other settings, and it says so (the maintainer, 2026-11-08).
		 */
		recorded?: 'loaded' | 'loading' | 'none' | 'failed';
		marks?: readonly string[];
		shows: string;
		/** A picture of the real page, which is only ever of one server. */
		image?: string | null;
		/** All of the address, for someone who asked for the detail. */
		everything?: boolean;
		/** The picture is the other provider's, which was a second realm on the same server (#182). */
		upstream?: boolean;
		onterm?: (id: string) => void;
	}

	let {
		address,
		recorded = 'loaded',
		marks = [],
		shows,
		image = null,
		everything = false,
		upstream = false,
		onterm
	}: Props = $props();

	const read = $derived(address ? readAddress(address, marks, { everything }) : null);
	// ? before the first of the query, # before the first of what the browser keeps, & between.
	const separator = (index: number) => {
		const parts = read?.parts ?? [];
		const part = parts[index];
		const before = parts[index - 1];
		if (part.fragment && !before?.fragment) return '#';
		return before ? '&' : '?';
	};
</script>

<figure data-testid="page-window">
	<div class="bar" data-testid="page-address">
		{#if read}
			<span class="where">{read.where}</span>{#each read.parts as part, index (part.name)}<span
					class="part"
					class:marked={part.marked}
					data-parameter={part.name}
					>{separator(index)}{#if part.term}<button
							type="button"
							use:hint={firstSentence(terms[part.term].explains)}
							onclick={() => onterm?.(part.term!)}>{part.name}</button
						>{:else}<span use:hint={keyWhy(part.name, { where: 'wire' })?.says}>{part.name}</span
						>{/if}=<span
						class="value"
						data-whole={part.whole}
						use:hint={part.whole !== part.value ? part.whole : undefined}>{part.value}</span
					></span
				>{/each}{#if read.left}<span class="left">{read.parts.length ? '&' : '?'}…</span>{/if}
		{:else}
			<span class="none" data-testid="page-no-address" data-recorded={recorded}>
				{#if recorded === 'loading'}
					Loading what was recorded.
				{:else if recorded === 'failed'}
					The recording did not load, so the address is not shown.
				{:else}
					Recorded with other settings, not these, so the address is not shown.
				{/if}
			</span>
		{/if}
	</div>
	{#if image}
		<img src={image} alt={shows} width="640" height="480" data-testid="page-picture" />
		<figcaption data-testid="page-caption">
			{#if recorded === 'none'}
				Keycloak’s own page, from a run with other settings, as it looks by default. Yours will look
				different.
			{:else if upstream}
				The other provider here is a second realm on the same Keycloak, so this is Keycloak’s own
				page too, as it looks by default. Yours will look different.
			{:else}
				Keycloak’s own page, as it looks by default. Yours will look different.
			{/if}
		</figcaption>
	{:else}
		<p data-testid="page-outline">{shows}</p>
	{/if}
</figure>

<style>
	figure {
		overflow: hidden;
		margin: 12px 0;
		border: 1px solid var(--line);
		border-radius: 8px;
		background: var(--panel);
	}

	.bar {
		padding: 6px 8px;
		border-bottom: 1px solid var(--line);
		font-family: var(--mono);
		font-size: 11.5px;
		line-height: 1.5;
		overflow-wrap: anywhere;
	}

	.where,
	.left,
	.none {
		color: var(--muted);
	}

	.none {
		font-family: var(--sans);
	}

	/* What this step is about. Everything else in the bar is what any address has. */
	.marked {
		padding: 0 2px;
		border-radius: 3px;
		background: var(--accent-soft);
		color: var(--fg);
		font-weight: 600;
	}

	button {
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-decoration: underline dotted;
		cursor: pointer;
	}

	img {
		display: block;
		width: 100%;
		height: auto;
	}

	figcaption,
	p {
		margin: 0;
		padding: 6px 8px;
		color: var(--muted);
		font-size: 12px;
	}

	figcaption {
		border-top: 1px solid var(--line);
	}
</style>
