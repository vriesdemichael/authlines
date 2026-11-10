<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** What it is about, for anything reading the page out. */
		label: string;
		/** For a whole document, which needs room to be read in. */
		wide?: boolean;
		/** The side to keep to, so that what it is about stays in view. Otherwise it is in the middle. */
		side?: 'left' | 'right' | null;
		/** It has a picture, which needs the room and is read as a whole, so it is in the middle. */
		picture?: boolean;
		onclose: () => void;
		children: Snippet;
	}

	let { label, wide = false, side = null, picture = false, onclose, children }: Props = $props();

	let dialog = $state<HTMLDialogElement>();

	// Open for as long as it exists, because whether it does comes from the address.
	$effect(() => {
		const element = dialog;
		if (!element) return;
		const opener = document.activeElement as HTMLElement | null;
		element.showModal();
		// Its heading, as a source's, and not the first button, which would say only "Close".
		element.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
		return () => {
			element.close();
			opener?.focus?.({ preventScroll: true });
		};
	});
</script>

<dialog
	bind:this={dialog}
	class:wide
	class:left={side === 'left' && !picture}
	class:right={side === 'right' && !picture}
	class:picture
	aria-label={label}
	data-testid="explain-dialog"
	oncancel={(event) => {
		event.preventDefault();
		onclose();
	}}
	onkeydown={(event) => {
		// Here too, because a browser only lets a page keep a dialog open so many times.
		if (event.key === 'Escape') {
			event.preventDefault();
			onclose();
		}
	}}
	onclick={(event) => {
		// A click on the backdrop lands on the dialog itself.
		if (event.target === dialog) onclose();
	}}
>
	{@render children()}
</dialog>

<style>
	dialog {
		box-sizing: border-box;
		width: min(480px, calc(100vw - 32px));
		max-height: calc(100dvh - 32px);
		padding: 0;
		overflow-y: auto;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--bg);
		color: var(--fg);
		box-shadow: 0 12px 40px rgb(0 0 0 / 0.18);
	}

	/* Light, so that what it lights up on the diagram can still be seen. */
	dialog::backdrop {
		background: rgb(0 0 0 / 0.14);
	}

	dialog.wide {
		width: min(780px, calc(100vw - 32px));
		height: calc(100dvh - 32px);
	}

	dialog.picture {
		width: min(780px, calc(100vw - 32px));
	}

	@media (min-width: 768px) {
		dialog.left,
		dialog.right {
			width: 400px;
		}

		dialog.left {
			margin-left: 16px;
		}

		dialog.right {
			margin-right: 16px;
		}
	}

	@media print {
		dialog {
			display: none;
		}
	}
</style>
