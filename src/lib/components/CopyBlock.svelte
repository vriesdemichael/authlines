<script lang="ts">
	interface Props {
		text: string;
		/** What it is, for a screen reader and for what the button says. */
		label: string;
	}

	let { text, label }: Props = $props();

	let copied = $state<'yes' | 'no' | null>(null);
	async function copy() {
		try {
			await navigator.clipboard.writeText(text);
			copied = 'yes';
		} catch {
			copied = 'no';
		}
	}
</script>

<div class="block" data-testid="copy-block">
	<!-- Long enough to scroll, which a keyboard can only do to something it can focus. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<pre tabindex="0" aria-label={label}>{text}</pre>
	<p>
		<button type="button" data-testid="copy" onclick={copy}>Copy {label}</button>
		<span role="status">
			{#if copied === 'yes'}Copied.{:else if copied === 'no'}This browser would not copy it, so
				select it above.{/if}
		</span>
	</p>
</div>

<style>
	.block {
		margin: 8px 0 16px;
	}

	pre {
		max-height: 260px;
		margin: 0 0 6px;
		padding: 8px 10px;
		overflow: auto;
		border-radius: var(--radius);
		background: var(--panel);
		font-family: var(--mono);
		font-size: var(--size-small);
		line-height: 1.5;
	}

	pre:focus-visible {
		outline: 2px solid var(--here);
	}

	p {
		margin: 0;
	}

	button {
		font-size: var(--size-small);
	}

	span {
		margin-left: 6px;
		color: var(--muted);
		font-size: var(--size-small);
	}
</style>
