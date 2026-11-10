<script lang="ts">
	import type { Mode } from '#lib/flow/vocabulary.ts';

	interface Props {
		mode: Mode;
		onchange: (mode: Mode) => void;
	}

	let { mode, onchange }: Props = $props();

	const modes: readonly { id: Mode; label: string; hint: string }[] = [
		{ id: 'simple', label: 'Simple', hint: 'What happens and why, in plain words' },
		{ id: 'advanced', label: 'Advanced', hint: 'Every setting, and what is on the wire' }
	];
</script>

<div role="group" aria-label="How much to show" data-testid="mode-switch">
	{#each modes as option (option.id)}
		<button
			type="button"
			aria-pressed={mode === option.id}
			title={option.hint}
			data-mode={option.id}
			onclick={() => onchange(option.id)}
		>
			{option.label}
		</button>
	{/each}
</div>

<style>
	div {
		display: inline-flex;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		overflow: hidden;
	}

	button {
		padding: 2px 12px;
		border: 0;
		border-radius: 0;
		background: var(--raised);
		color: var(--muted);
		font-size: var(--size-ui);
		font-weight: 500;
	}

	button[aria-pressed='true'] {
		background: var(--here-soft);
		color: var(--here);
		font-weight: 600;
	}

	@media (forced-colors: active) {
		button[aria-pressed='true'] {
			background: Highlight;
			color: HighlightText;
			forced-color-adjust: none;
		}
	}
</style>
