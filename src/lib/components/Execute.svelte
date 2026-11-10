<script lang="ts">
	interface Props {
		/** The number of the step the answer is on. */
		answerAt: number;
		onexecute: () => void;
	}

	let { answerAt, onexecute }: Props = $props();
</script>

<div class="execute">
	<button type="button" data-testid="execute" onclick={onexecute}>Execute</button>
	<p>Replays the answer from step {answerAt}. Nothing is really sent.</p>
</div>

<style>
	.execute {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	button {
		flex: none;
		border-color: var(--here);
		color: var(--here);
		font-weight: 600;
	}

	p {
		max-width: 190px;
		margin: 0;
		color: var(--muted);
		font-size: var(--size-small);
		line-height: 1.25;
	}

	@media (max-width: 767px) {
		p {
			max-width: none;
		}
	}
</style>
