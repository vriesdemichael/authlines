<script lang="ts">
	import type { MapNode, MapTrack } from '#lib/map/tracks.ts';

	interface Props {
		tracks: readonly MapTrack[];
		hrefOf: (node: MapNode) => string;
		/** The node someone came back from, to mark where they were. */
		current?: string | null;
		/** The question the diagram beside it is showing. */
		showing?: string | null;
		/** Someone is pointing at a question, with a mouse or by moving to it with the keyboard. */
		onpoint?: (node: MapNode) => void;
	}

	let { tracks, hrefOf, current = null, showing = null, onpoint }: Props = $props();

	const holds = (track: MapTrack, id: string | null) =>
		track.chains.some((chain) => chain.some((node) => node.id === id));
	const count = (track: MapTrack) => track.chains.reduce((sum, chain) => sum + chain.length, 0);
	// One part open at a time, so that what is on screen can be read, and the rest says what is in it.
	const openAtFirst = $derived(tracks.find((track) => holds(track, current)) ?? tracks[0]);
</script>

<ol class="tracks" data-testid="map">
	{#each tracks as track (track.id)}
		<li class="track" id={track.id}>
			<details name="map" open={openAtFirst.id === track.id}>
				<summary>
					<h2>{track.title}</h2>
					<span class="count">{count(track)}</span>
					<span class="lead">{track.lead}</span>
				</summary>
				{#each track.chains as chain, c (c)}
					<ol class="chain">
						{#each chain as node (node.id)}
							<li>
								<!-- eslint-disable svelte/no-navigation-without-resolve -- hrefOf resolves it -->
								<a
									class="stop"
									class:showing={showing === node.id}
									href={hrefOf(node)}
									data-testid={`node-${node.id}`}
									aria-current={current === node.id ? 'location' : undefined}
									onpointermove={() => onpoint?.(node)}
									onfocus={() => onpoint?.(node)}
								>
									<span class="title">{node.title}</span>
									{#if node.mode === 'advanced'}
										<span class="tag">Advanced</span>
									{/if}
									<span class="summary">{node.summary}</span>
								</a>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
							</li>
						{/each}
					</ol>
				{/each}
			</details>
		</li>
	{/each}
</ol>

<style>
	ol {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.track {
		border-top: 1px solid var(--line);
		scroll-margin-top: 12px;
	}

	.track:last-child {
		border-bottom: 1px solid var(--line);
	}

	summary {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		column-gap: 12px;
		padding: 9px 0;
		cursor: pointer;
		list-style: none;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	h2 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
	}

	summary:hover h2 {
		color: var(--accent);
	}

	.count {
		color: var(--muted);
		font-size: 13px;
	}

	.lead {
		grid-column: 1 / -1;
		margin-top: 2px;
		color: var(--muted);
		font-size: 13.5px;
		line-height: 1.4;
	}

	/* Its title says enough until someone opens it, and so a whole map fits on one screen. */
	details:not([open]) .lead {
		display: none;
	}

	details[open] > summary {
		padding-bottom: 6px;
	}

	details[open] > .chain:last-child {
		padding-bottom: 14px;
	}

	.chain + .chain {
		margin-top: 12px;
	}

	.stop {
		display: block;
		padding: 5px 0;
		color: var(--fg);
		font-size: 15px;
		line-height: 1.4;
		text-decoration: none;
	}

	.stop:hover .title,
	.stop:focus-visible .title {
		text-decoration: underline;
	}

	.stop.showing .title,
	.stop[aria-current='location'] .title {
		color: var(--accent);
		font-weight: 600;
	}

	.tag {
		margin-left: 6px;
		color: var(--muted);
		font-size: 12px;
	}

	/* Beside the diagram, the diagram says it. Still there for anyone who cannot see that. */
	@media (min-width: 1100px) {
		.summary {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
		}
	}

	@media (max-width: 1099px) {
		.summary {
			display: block;
			color: var(--muted);
			font-size: 13.5px;
		}
	}
</style>
