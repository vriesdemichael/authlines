<script lang="ts">
	import { splitRfc } from '#lib/sources/rfc.ts';
	import { originalUrl, type SourceDef } from '#lib/sources/sources.ts';

	interface Props {
		source: SourceDef;
		why: string;
		section?: string | null;
		loadText: (file: string) => Promise<string>;
		onsection: (section: string | null) => void;
		onclose: () => void;
	}

	let { source, why, section = null, loadText, onsection, onclose }: Props = $props();

	let text = $state<string | null>(null);
	let failed = $state(false);
	let title = $state<HTMLElement>();
	let document = $state<HTMLElement>();

	const split = $derived(text === null ? null : splitRfc(text));

	// Each state change passes new props, so these keep a step forward from reloading or scrolling.
	const file = $derived(source.textFile);
	const target = $derived(section);

	$effect(() => {
		title?.focus({ preventScroll: true });
	});

	// Only here does the text download, so it costs nothing until someone opens it.
	$effect(() => {
		text = null;
		failed = false;
		if (!file) return;
		let wanted = true;
		loadText(file).then(
			(loaded) => {
				if (wanted) text = loaded;
			},
			() => {
				if (wanted) failed = true;
			}
		);
		return () => {
			wanted = false;
		};
	});

	$effect(() => {
		if (!split || !target) return;
		const part = document?.querySelector(`[data-section="${CSS.escape(target)}"]`);
		part?.scrollIntoView({ block: 'start' });
		// WebKit puts a dialog back at its top the first time it draws it, which is too late if the
		// text was there first, as it is for anyone who has read this source before.
		const drawn = requestAnimationFrame(() =>
			requestAnimationFrame(() => part?.scrollIntoView({ block: 'start' }))
		);
		return () => cancelAnimationFrame(drawn);
	});
</script>

<aside aria-label={`Source: ${source.label}`} data-testid="source-panel">
	<div class="bar">
		{#if split?.sections.length}
			<label>
				Section
				<select
					value={section ?? ''}
					data-testid="source-sections"
					onchange={(event) => onsection(event.currentTarget.value || null)}
				>
					<option value="">Start of the document</option>
					{#each split.sections as option (option.id)}
						<option value={option.id}>{option.id}. {option.title}</option>
					{/each}
				</select>
			</label>
		{/if}
		<button type="button" data-testid="source-close" onclick={onclose}>Close</button>
	</div>

	<div class="intro">
		<p class="label">{source.label}</p>
		<h2 tabindex="-1" bind:this={title}>{source.title}</h2>
		<p class="status">{source.status}</p>
		<p data-testid="source-summary">{source.summary}</p>
		<h3>What it means here</h3>
		<p data-testid="source-why">{why}</p>
		<p>
			<!-- eslint-disable svelte/no-navigation-without-resolve -- an outside address -->
			<a
				href={originalUrl(source, section)}
				target="_blank"
				rel="noopener noreferrer"
				data-testid="source-original"
			>
				Read the original
			</a>
		</p>
	</div>

	{#if source.textFile}
		{#if failed}
			<p class="note" data-testid="source-failed">
				The text could not be loaded. The link above opens the original.
			</p>
		{:else if split}
			<pre
				bind:this={document}
				data-testid="source-text">{#each split.parts as part (part.section ?? 'start')}<span
						data-section={part.section}><b>{part.heading}</b>{part.body}</span
					>{/each}</pre>
		{:else}
			<p class="note">Loading the text…</p>
		{/if}
	{/if}
</aside>

<style>
	aside {
		min-height: 100%;
		background: var(--bg);
	}

	.bar {
		position: sticky;
		top: 0;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 12px;
		padding: 8px 16px;
		background: var(--panel);
		border-bottom: 1px solid var(--line);
	}

	label {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--muted);
		font-size: var(--size-small);
	}

	select {
		flex: 1;
		min-width: 0;
		font: inherit;
		color: var(--fg);
		background: var(--bg);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		padding: 3px 6px;
	}

	.intro {
		padding: 14px 16px;
		border-bottom: 1px solid var(--line);
	}

	.label,
	.status,
	.note {
		color: var(--muted);
		font-size: var(--size-small);
	}

	.note {
		padding: 0 16px;
	}

	p {
		margin: 0 0 8px;
	}

	h2 {
		margin: 2px 0;
		font-size: var(--size-title);
	}

	h2:focus {
		outline: none;
	}

	h3 {
		margin: 12px 0 4px;
		font-size: var(--size-small);
		color: var(--muted);
	}

	pre {
		margin: 0;
		padding: 14px 16px;
		font-family: var(--mono);
		font-size: var(--size-small);
		line-height: 1.45;
	}

	/* The bar stays on top, so a section it scrolls to must not end up behind it. */
	span {
		scroll-margin-top: 56px;
	}
</style>
