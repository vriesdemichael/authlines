<script lang="ts">
	import { untrack } from 'svelte';
	import { ICONS } from '#lib/diagram/icons.ts';
	import {
		FULL_HEAD_WIDTH,
		layHeld,
		TIME_GAP,
		SELF_LOOP,
		STRIP_SELF_LOOP,
		WHOLE_SELF_LOOP,
		type DiagramLayout
	} from '#lib/diagram/layout.ts';
	import { interpolate, toFrame, TRANSITION_MS, type Frame } from '#lib/diagram/motion.ts';
	import type { Lit } from '#lib/flow/explain.ts';
	import { sees } from '#lib/flow/eyes.ts';
	import { artifacts, type ArtifactId } from '#lib/flow/vocabulary.ts';

	interface Props {
		layout: DiagramLayout;
		currentStep: string;
		fresh?: ReadonlySet<string>;
		/** Someone just flipped a setting, so these rows go first, even over the current step. */
		flipped?: ReadonlySet<string> | null;
		animate?: boolean;
		/** What is being explained, to light up where it is. */
		lit?: Lit | null;
		/** What each lifeline has seen, up to the current step. */
		holdings?: Readonly<Record<string, readonly ArtifactId[]>>;
		/** The step whose message is on its way, when someone just sent it. */
		sending?: string | null;
		/** What it adds to what they have seen, as `lifeline:artifact`, to show when it gets there. */
		landing?: ReadonlySet<string>;
		/** The one party whose view to show. What it never got is not drawn, only how much there was. */
		eyes?: string | null;
		/** The steps one thing goes through, and what forms it takes, to light up that path. */
		followed?: { steps: ReadonlySet<string>; forms: readonly ArtifactId[] } | null;
		/** As wide as it is laid out, and moved sideways to the current message, on a screen too narrow. */
		fullSize?: boolean;
		onselect?: (step: string) => void;
		onexplainlifeline?: (id: string) => void;
		onexplainartifact?: (id: ArtifactId) => void;
	}

	let {
		layout,
		currentStep,
		fresh = new Set(),
		animate = true,
		lit = null,
		holdings = {},
		flipped = null,
		sending = null,
		landing = new Set(),
		eyes = null,
		followed = null,
		fullSize = false,
		onselect,
		onexplainlifeline,
		onexplainartifact
	}: Props = $props();

	let frame = $state.raw<Frame>(untrack(() => toFrame(layout)));
	let animating = $state(false);
	let scroller = $state<HTMLElement>();
	let root = $state<HTMLElement>();
	const loop = $derived(frame.whole ? WHOLE_SELF_LOOP : frame.strip ? STRIP_SELF_LOOP : SELF_LOOP);
	let scrolled = $state(false);
	let drawn = untrack(() => layout);
	const BREATHING_ROOM = 60;
	const TIGHT_ROOM = 12;

	$effect(() => {
		// The first frame is already this layout, so a new diagram appears without moving.
		if (layout === drawn) return;
		// A new window size is not a change to the flow, so nothing should look as if it changed.
		const resized = layout.roomKey !== drawn.roomKey;
		drawn = layout;
		const target = toFrame(layout);
		const start = untrack(() => frame);
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (!untrack(() => animate) || reduced || resized) {
			frame = target;
			animating = false;
			return;
		}
		let raf = 0;
		const began = performance.now();
		animating = true;
		const tick = (now: number) => {
			const t = Math.min(1, (now - began) / TRANSITION_MS);
			frame = interpolate(start, target, t);
			if (t < 1) raf = requestAnimationFrame(tick);
			else animating = false;
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});

	const order = $derived(new Map(layout.rows.map((row, i) => [row.id, i])));
	const currentIndex = $derived(order.get(currentStep) ?? 0);
	const currentRow = $derived(layout.rows[currentIndex]);
	const hiddenRows = $derived(
		new Set(eyes ? frame.rows.filter((row) => !sees(row, eyes)).map((row) => row.id) : [])
	);
	const eyesName = $derived(frame.lanes.find((lane) => lane.id === eyes)?.name);
	const eyesHold = (artifact: ArtifactId) => !eyes || (holdings[eyes] ?? []).includes(artifact);
	// An arrow to travel, because what stays with one lifeline and time going by have nothing to carry,
	// and nothing goes by for someone who was not part of it.
	const travelling = $derived(
		layout.rows.find(
			(row) => row.id === sending && row.kind !== 'time' && !row.self && !hiddenRows.has(row.id)
		)?.id ?? null
	);
	const carries = (step: string) =>
		frame.chips.some((chip) => chip.step === step && chip.artifact && !chip.leaving);

	const boxOf = (step: string) =>
		scroller?.querySelector(`[data-step="${CSS.escape(step)}"] .hit`)?.getBoundingClientRect() ??
		null;

	// A setting can change what is inside a message without changing the message's own words.
	const freshRows = $derived(new Set([...fresh].map((id) => id.split(':')[0])));

	/**
	 * The current step stays on screen with room around it, whatever moved it there. A setting that was
	 * just flipped goes first, because a change nobody can see has not been shown, and someone who has
	 * just flipped something is looking for what it did. The next step brings the current one back.
	 */
	function keepInView() {
		const row = boxOf(currentStep);
		if (!scroller || !row) return;
		const view = scroller.getBoundingClientRect();
		const rows = (ids: ReadonlySet<string>) =>
			layout.rows.flatMap((candidate) =>
				ids.has(candidate.id) ? (boxOf(candidate.id) ?? []) : []
			);
		const span = (boxes: readonly DOMRect[]) => ({
			from: Math.min(...boxes.map((box) => box.top)),
			to: Math.max(...boxes.map((box) => box.bottom))
		});
		const fits = ({ from, to }: { from: number; to: number }) =>
			to - from + TIGHT_ROOM * 2 <= view.height;
		const changed = rows(freshRows);
		const looked = flipped ? rows(flipped) : [];
		const alone = looked.length ? span(looked) : null;
		// All of it if that fits. After a flip, then what it changed with the current step, and then that
		// alone, as much as fits from where it starts. Otherwise what came before with the current step,
		// because what is ahead is still to come.
		const { from, to } = [
			span([...changed, row]),
			alone ? span([...looked, row]) : span([...changed.filter((box) => box.top <= row.top), row]),
			...(alone
				? [{ from: alone.from, to: Math.min(alone.to, alone.from + view.height - TIGHT_ROOM * 2) }]
				: [])
		].find(fits) ?? { from: row.top, to: row.bottom };
		const room = Math.max(0, Math.min(BREATHING_ROOM, (view.height - (to - from)) / 2));
		if (from - room < view.top) scroller.scrollTop -= view.top - (from - room);
		else if (to + room > view.bottom) scroller.scrollTop += to + room - view.bottom;
		if (fullSize) keepInViewSideways();
	}

	/** Its arrow and its words, from one end to the other, or as much of that as there is room for. */
	function keepInViewSideways() {
		const row = layout.rows[currentIndex];
		if (!root || !row) return;
		const words = row.lines.flatMap((line) => [line.x - 60, line.x + 60]);
		const left = Math.min(row.x1, row.x2, ...words) - layout.viewX - TIGHT_ROOM * 2;
		const right = Math.max(row.x1, row.x2, ...words) - layout.viewX + TIGHT_ROOM * 2;
		const seen = root.clientWidth;
		if (right - left > seen || left < root.scrollLeft) root.scrollLeft = Math.max(0, left);
		else if (right > root.scrollLeft + seen) root.scrollLeft = right - seen;
	}

	// Every frame of a transition, because rows move under it, but not on someone scrolling by hand.
	$effect(() => {
		void frame;
		keepInView();
	});

	$effect(() => {
		if (!scroller) return;
		const observer = new ResizeObserver(() => keepInView());
		observer.observe(scroller);
		return () => observer.disconnect();
	});

	const tipX = (x1: number, x2: number, draw: number) => x1 + (x2 - x1) * draw;
	const HEAD_LENGTH = 8;
	const headPoints = (x: number, y: number, direction: number) =>
		`${x},${y} ${x - HEAD_LENGTH * direction},${y - 4.5} ${x - HEAD_LENGTH * direction},${y + 4.5}`;
	// Into the head's base and no further, because a line as thick as the current one shows past its point.
	const lineEnd = (x1: number, tip: number) =>
		Math.abs(tip - x1) <= HEAD_LENGTH ? x1 : tip - (HEAD_LENGTH - 1) * Math.sign(tip - x1);

	function rowState(id: string) {
		const index = order.get(id);
		if (index === undefined) return 'leaving';
		return index === currentIndex ? 'current' : index < currentIndex ? 'past' : 'future';
	}

	function heldText(lane: string, ids: readonly ArtifactId[]) {
		const shown = lane === eyes ? ids : ids.filter(eyesHold);
		const hidden = ids.length - shown.length;
		if (hidden)
			return `${shown.map((id) => artifacts[id].label).join(', ')} ${hidden} hidden`.trim();
		return shown.length ? shown.map((id) => artifacts[id].label).join(', ') : 'nothing yet';
	}
	const activate = (event: KeyboardEvent, then: () => void) => {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		then();
	};
</script>

<div
	class="diagram"
	class:whole={frame.whole}
	class:strip={frame.strip}
	class:full-size={fullSize}
	data-testid="diagram"
	data-animating={animating}
	data-lit={lit?.part}
	bind:this={root}
>
	<!-- As wide as the screen, or as wide as it is laid out, with the heads held while it scrolls down. -->
	<div class="wide" style:width={fullSize ? `${frame.viewWidth}px` : null}>
		<div class="heads-band" class:scrolled>
			<svg
				class="heads"
				viewBox={`${frame.viewX} 0 ${frame.viewWidth} ${frame.headHeight}`}
				role="group"
				aria-label="Who takes part, and what each has seen so far"
				data-testid="diagram-heads"
			>
				{#each frame.lanes as lane (lane.id)}
					<line
						class="lifeline"
						x1={lane.x}
						x2={lane.x}
						y1={frame.strip ? frame.headHeight - 6 : 51}
						y2={frame.headHeight}
						style:opacity={lane.opacity}
					/>
					<g
						class="lane-head"
						class:fresh={fresh.has(lane.id)}
						class:lit={lit?.lifeline === lane.id}
						class:eyes={eyes === lane.id}
						class:active={currentRow && (lane.id === currentRow.from || lane.id === currentRow.to)}
						style:opacity={lane.opacity}
						data-lifeline={lane.leaving ? undefined : lane.id}
						transform={`translate(${lane.x} 0)`}
						role="button"
						tabindex={lane.leaving ? -1 : 0}
						aria-describedby={`seen-${lane.id}`}
						onclick={() => {
							// On its way out, so there is nothing left to explain.
							if (!lane.leaving) onexplainlifeline?.(lane.id);
						}}
						onkeydown={(event) => activate(event, () => onexplainlifeline?.(lane.id))}
					>
						<desc id={`seen-${lane.id}`}
							>Has seen: {heldText(lane.id, holdings[lane.id] ?? [])}.</desc
						>
						{#if frame.strip}
							<!-- A small head, and its name slanting up over the words, which leaves the room to them. -->
							<rect
								x={-lane.headWidth / 2}
								y={frame.headHeight - 30}
								width={lane.headWidth}
								height={lane.headWidth}
								rx="6"
							/>
							<path
								class="icon"
								d={ICONS[lane.icon]}
								transform={`translate(-9 ${frame.headHeight - 27}) scale(0.75)`}
							/>
							<text
								class="name slanted"
								class:given={lane.given}
								transform={`translate(4 ${frame.headHeight - 36}) rotate(-34)`}
								style:opacity={lane.words}
								>{lane.name}{#if lane.given}<tspan class="kind"> · {lane.role}</tspan>{/if}</text
							>
						{:else}
							<rect x={-lane.headWidth / 2} y="5" width={lane.headWidth} height="46" rx="8" />
						{/if}
						{#if frame.strip}
							<!-- Drawn above. -->
						{:else if lane.headWidth >= FULL_HEAD_WIDTH}
							<path class="icon" d={ICONS[lane.icon]} transform="translate(-65 16) scale(0.95)" />
							<g style:opacity={lane.words}>
								<text class="name" class:given={lane.given} x="-38" y="25">{lane.nameLines[0]}</text
								>
								{#if lane.nameLines[1]}
									<text class="name" class:given={lane.given} x="-38" y="41"
										>{lane.nameLines[1]}</text
									>
								{:else}
									<text class="role" x="-38" y="41">{lane.role}</text>
								{/if}
							</g>
						{:else}
							<g style:opacity={lane.words}>
								<text class="name tight" class:given={lane.given} y="25" text-anchor="middle"
									>{lane.nameLines[0]}</text
								>
								{#if lane.nameLines[1]}
									<text class="name tight" class:given={lane.given} y="41" text-anchor="middle"
										>{lane.nameLines[1]}</text
									>
								{:else}
									<text class="role tight" y="41" text-anchor="middle">{lane.role}</text>
								{/if}
							</g>
						{/if}
						<!-- In a strip there is no room under a head, and selecting it says what it has seen. -->
						{#if !lane.leaving && !frame.whole && !frame.strip}
							{#each layHeld(holdings[lane.id] ?? [], frame.heldWidth) as chip (chip.artifact)}
								{#if lane.id !== eyes && !eyesHold(chip.artifact)}
									<g data-hidden-held
										><rect
											class="bar"
											x={chip.x}
											y={chip.y}
											width={chip.width}
											height="16"
											rx="8"
										/></g
									>
								{:else}
									<!-- Inside a button, so only for the mouse. The keyboard gets to the same words through
							     the lifeline's own explanation, which lists these as buttons. -->
									<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
									<g
										class="held"
										class:followed={followed?.forms.includes(chip.artifact)}
										class:off-path={followed && !followed.forms.includes(chip.artifact)}
										class:landing={travelling && landing.has(`${lane.id}:${chip.artifact}`)}
										data-artifact={chip.artifact}
										data-held={`${lane.id}:${chip.artifact}`}
										onclick={(event) => {
											event.stopPropagation();
											onexplainartifact?.(chip.artifact);
										}}
									>
										<rect x={chip.x} y={chip.y} width={chip.width} height="16" rx="8" />
										<text x={chip.x + chip.width / 2} y={chip.y + 11.5} text-anchor="middle">
											{chip.text}
										</text>
									</g>
								{/if}
							{/each}
						{/if}
					</g>
				{/each}
			</svg>
		</div>

		<div
			class="scroller"
			bind:this={scroller}
			onscroll={(event) => (scrolled = event.currentTarget.scrollTop > 0)}
		>
			<svg
				class="body"
				viewBox={`${frame.viewX} 0 ${frame.viewWidth} ${frame.height}`}
				role="group"
				aria-label="The messages in this diagram"
			>
				{#each frame.lanes as lane (lane.id)}
					<line
						class="lifeline"
						class:active={currentRow && (lane.id === currentRow.from || lane.id === currentRow.to)}
						x1={lane.x}
						x2={lane.x}
						y1="0"
						y2={frame.height}
						style:opacity={lane.opacity}
					/>
				{/each}

				{#each frame.groups as group (group.id)}
					<g
						class="group"
						style:opacity={group.opacity}
						data-group={group.leaving ? undefined : group.id}
					>
						<rect x={group.x} y={group.y} width={group.width} height={group.height} rx="10" />
						<text x={group.x + 12} y={group.y + (frame.whole ? 14 : 18)}>{group.label}</text>
					</g>
				{/each}

				{#each frame.rows as row (row.id)}
					{@const state = rowState(row.id)}
					{@const tip = tipX(row.x1, row.x2, row.draw)}
					<g
						class={`row ${row.kind} ${row.channel} ${state}`}
						class:fresh={fresh.has(row.id)}
						class:lit={lit?.step === row.id}
						class:sending={travelling === row.id}
						class:unseen={hiddenRows.has(row.id)}
						class:on-path={followed?.steps.has(row.id)}
						class:off-path={followed && !followed.steps.has(row.id)}
						style:opacity={row.opacity}
						data-step={row.leaving ? undefined : row.id}
						data-state={state}
						data-channel={row.channel}
						role="button"
						tabindex={row.leaving ? -1 : 0}
						aria-describedby={`route-${row.id}`}
						aria-current={state === 'current' ? 'step' : undefined}
						onclick={() => {
							// On its way out, so it is not a step any more.
							if (!row.leaving) onselect?.(row.id);
						}}
						onkeydown={(event) => {
							if (event.key === 'Enter' || event.key === ' ') {
								event.preventDefault();
								onselect?.(row.id);
							}
						}}
					>
						<desc id={`route-${row.id}`}>
							{hiddenRows.has(row.id)
								? `${row.route} ${eyesName} was not part of this.`
								: row.route}
						</desc>
						{#if row.kind === 'time'}
							<!-- A gap in every line, which is how a sequence diagram says that time went by. -->
							<rect
								class="gap"
								x={frame.viewX}
								y={row.y - TIME_GAP / 2}
								width={frame.viewWidth}
								height={TIME_GAP}
							/>
						{/if}
						<rect
							class="hit"
							x={frame.viewX}
							y={row.top}
							width={frame.viewWidth}
							height={row.band}
						/>
						{#if row.kind === 'time'}
							{#each [row.y - TIME_GAP / 2, row.y + TIME_GAP / 2] as y (y)}
								<line x1={frame.viewX} x2={frame.viewX + frame.viewWidth} y1={y} y2={y} />
							{/each}
						{:else if row.self}
							<path
								d={`M ${row.x1} ${row.y - loop.top} h ${row.selfSide * loop.width} v ${loop.height} h ${-row.selfSide * (loop.width - 6)}`}
								pathLength="1"
								stroke-dasharray={`${row.draw} 1`}
							/>
							<polygon
								points={headPoints(row.x1, row.y - loop.top + loop.height, -row.selfSide)}
								style:opacity={row.draw}
							/>
						{:else}
							<line x1={row.x1} x2={lineEnd(row.x1, tip)} y1={row.y} y2={row.y} />
							<polygon points={headPoints(tip, row.y, Math.sign(row.x2 - row.x1) || 1)} />
							{#if travelling === row.id && !row.leaving}
								<!-- Hollow when it has no token or secret in it, like a refusal, so nothing lands. -->
								<circle
									class="packet"
									class:empty={!carries(row.id)}
									cx={row.x1}
									cy={row.y}
									r="5"
									style:--travel={`${row.x2 - row.x1}px`}
								/>
							{/if}
						{/if}
						<g
							class="number"
							transform={`translate(${row.x1} ${row.self ? row.y - loop.top : row.y})`}
						>
							<circle r={frame.numberRadius} />
							<text y={frame.whole ? 3 : 3.7} text-anchor="middle">{row.number}</text>
						</g>
						<!-- The spaces are for anything reading this, because lines are only places on a screen. -->
						<!-- Every row says what happens, ahead and unseen too, because a numbered line with nothing
					     on it only made people wonder. What it carries waits until it gets there. -->
						<text class="label" style:--words={row.words}>
							{#each row.lines as line, l (l)}
								<tspan x={line.x} y={line.y} text-anchor={line.anchor}>{`${line.text} `}</tspan>
							{/each}
						</text>
					</g>
				{/each}

				{#each frame.chips as chip (chip.id)}
					{@const state = rowState(chip.step)}
					{#if hiddenRows.has(chip.step)}
						<rect
							class={`bar chip-bar ${state}`}
							style:opacity={chip.opacity}
							x={chip.x}
							y={chip.y}
							width={chip.width}
							height="18"
							rx="9"
						/>
					{:else}
						<!-- A chip with no token in it is not a button, so the role depends on the chip. -->
						<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
						<g
							class={`chip ${state}`}
							class:fresh={fresh.has(chip.id) || fresh.has(chip.step)}
							class:sending={travelling === chip.step}
							class:followed={followed?.steps.has(chip.step) &&
								chip.artifact &&
								followed.forms.includes(chip.artifact)}
							class:off-path={followed &&
								!(
									followed.steps.has(chip.step) &&
									chip.artifact &&
									followed.forms.includes(chip.artifact)
								)}
							style:opacity={chip.opacity}
							data-chip={chip.leaving ? undefined : chip.id}
							data-artifact={chip.artifact}
							role={chip.artifact ? 'button' : undefined}
							tabindex={chip.artifact ? -1 : undefined}
							onclick={() => {
								if (chip.artifact && !chip.leaving) onexplainartifact?.(chip.artifact);
							}}
							onkeydown={(event) => {
								if (chip.artifact) activate(event, () => onexplainartifact?.(chip.artifact!));
							}}
						>
							<rect x={chip.x} y={chip.y} width={chip.width} height="18" rx="9" />
							<text x={chip.x + chip.width / 2} y={chip.y + 13} text-anchor="middle"
								>{chip.text}</text
							>
						</g>
					{/if}
				{/each}
			</svg>
		</div>
	</div>
</div>

<style>
	.diagram {
		--send: 350ms;
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}

	.wide {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}

	/* Wider than the screen, so it scrolls sideways as a whole, and the heads go with it. */
	.diagram.full-size {
		overflow-x: auto;
		overflow-y: hidden;
	}

	.diagram.full-size .wide {
		min-width: 100%;
	}

	.heads-band {
		position: relative;
		z-index: 1;
		flex: none;
		background: var(--bg);
	}

	.lane-head .name.slanted {
		font-size: 12px;
	}
	/* Named by the link that was opened, which the note beside the diagram says. */
	.lane-head .name.given {
		font-style: italic;
	}

	/* What a party a link named is, beside its name where there is no room under it. */
	.lane-head .name .kind {
		fill: var(--muted);
		font-style: normal;
		font-weight: 400;
	}

	.heads-band.scrolled {
		box-shadow: 0 1px 0 var(--line);
	}

	.heads {
		display: block;
		width: 100%;
	}

	.scroller {
		flex: 1;
		min-height: 0;
		overflow-x: hidden;
		overflow-y: auto;
	}

	.body {
		display: block;
		width: 100%;
		height: auto;
	}

	text {
		fill: var(--fg);
		font-size: 13px;
	}

	.lane-head rect {
		fill: var(--raised);
		stroke: var(--line);
		transition:
			fill 0.2s,
			stroke 0.2s;
	}

	.lane-head .icon {
		fill: none;
		stroke: var(--muted);
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.lane-head .name {
		font-weight: 600;
		font-size: 13px;
	}

	.lane-head .role {
		fill: var(--muted);
		font-size: 11px;
	}

	.lane-head .tight {
		font-size: 11.5px;
	}

	.lane-head .name.tight {
		font-size: 12.5px;
	}

	.lane-head.active > rect {
		fill: var(--accent-soft);
		stroke: var(--accent);
		stroke-width: 1.5;
	}

	.lane-head.active .icon {
		stroke: var(--accent);
	}

	/* What is being explained, and what a part of the diagram is, shown where it is. */
	.row.lit .hit {
		stroke: var(--accent);
		stroke-width: 1.5;
	}

	.lane-head.lit > rect,
	[data-lit='part-column'] .lane-head > rect {
		stroke: var(--accent);
		stroke-width: 2;
	}

	[data-lit='part-column'] .lifeline {
		stroke: var(--accent);
		stroke-width: 2;
		opacity: 1 !important;
	}

	[data-lit='part-arrow'] .row.request:not(.future) line,
	[data-lit='part-arrow'] .row.request:not(.future) polygon,
	[data-lit='part-answer'] .row.response:not(.future) line,
	[data-lit='part-answer'] .row.response:not(.future) polygon,
	[data-lit='part-browser'] .row.front:not(.future) line,
	[data-lit='part-browser'] .row.front:not(.future) polygon,
	[data-lit='part-direct'] .row.back:not(.future) line,
	[data-lit='part-direct'] .row.back:not(.future) polygon {
		stroke-width: 4;
	}

	[data-lit='part-number'] .number circle,
	[data-lit='part-chip'] .chip rect,
	[data-lit='part-seen'] .held rect {
		stroke: var(--accent);
		stroke-width: 2;
	}

	[data-lit='part-ahead'] .row.future line,
	[data-lit='part-ahead'] .row.future path,
	[data-lit='part-ahead'] .row.future polygon {
		opacity: 1;
		stroke-width: 3;
	}

	.lane-head.fresh > rect {
		fill: var(--fresh-soft);
	}

	.lane-head[data-lifeline='attacker'] > rect {
		stroke: var(--attacker);
	}

	.lane-head[data-lifeline='attacker'] .role,
	.lane-head[data-lifeline='attacker'] .icon {
		fill: var(--attacker);
	}

	.lane-head[data-lifeline='attacker'] .icon {
		fill: none;
		stroke: var(--attacker);
	}

	.held rect {
		stroke-width: 1;
	}

	.held text {
		font-size: 10.5px;
		font-weight: 600;
	}

	.lifeline {
		stroke: var(--line);
		stroke-width: 1;
	}

	.lifeline.active {
		stroke: var(--strong-line);
	}

	.group rect {
		fill: color-mix(in srgb, var(--panel) 55%, transparent);
		stroke: var(--strong-line);
		stroke-dasharray: 6 4;
	}

	.group text {
		fill: var(--muted);
		font-size: 11.5px;
		font-weight: 600;
	}

	.row {
		cursor: pointer;
		--row: var(--strong-line);
	}

	.row.front {
		--row: var(--front);
	}

	.row.back {
		--row: var(--back);
	}

	.row.people {
		--row: var(--people);
	}

	.row.internal {
		--row: var(--muted);
	}

	.row:focus {
		outline: none;
	}

	.row:focus-visible .hit {
		stroke: var(--accent);
		stroke-width: 1.5;
	}

	.hit {
		fill: transparent;
	}

	.row:hover .hit {
		fill: color-mix(in srgb, var(--panel) 70%, transparent);
	}

	.row line,
	.row path {
		stroke: var(--row);
		stroke-width: 1.6;
		fill: none;
	}

	.row polygon {
		fill: var(--row);
	}

	.row.response line {
		stroke-dasharray: 7 5;
	}

	.gap {
		fill: var(--bg);
	}

	.row.time line {
		stroke-dasharray: 1.5 5;
		stroke-linecap: round;
		stroke-width: 1.4;
	}

	.row.human line {
		stroke-dasharray: 1.5 5;
		stroke-linecap: round;
		stroke-width: 2.4;
	}

	/* Knocked out of whatever passes behind it, so that a lifeline never strikes through the words. */
	/* Enough to read, and no more, so that every row fits. */
	.whole .label {
		font-size: 11.5px;
		stroke-width: 4px;
	}

	.whole .number text {
		font-size: 8.5px;
	}

	.label {
		paint-order: stroke;
		stroke: var(--bg);
		stroke-width: 7px;
		stroke-linejoin: round;
		fill: var(--muted);
		opacity: var(--words, 1);
	}

	/* What is ahead is faint and says what will happen, with nothing in it until it gets there. */
	.row.future line,
	.row.future path,
	.row.future polygon {
		opacity: 0.32;
	}

	/* Only the current step is filled in. What has happened stays readable, and quiet. */
	.number circle {
		fill: var(--bg);
		stroke: var(--row);
		stroke-width: 1.2;
	}

	.number text {
		fill: var(--row);
		font-size: 10.5px;
		font-weight: 600;
	}

	.row.current .number circle {
		fill: var(--row);
		stroke: var(--accent-soft);
		stroke-width: 2;
	}

	.row.current .number text {
		fill: var(--on-tone);
	}

	.row.past line,
	.row.past path,
	.row.past polygon {
		opacity: 0.55;
	}

	.row.future .number circle {
		fill: var(--bg);
		stroke: var(--line);
		stroke-width: 1;
	}

	.row.future .number text {
		fill: var(--muted);
	}

	/* On paper there is no next step to wait for, so everything is spelled out. */
	@media print {
		.scroller {
			overflow: visible !important;
			height: auto !important;
		}

		.row.future line,
		.row.future path,
		.row.future polygon,
		.row.future .label,
		.chip.future:not(.fresh) {
			opacity: 1 !important;
		}
	}

	@media (forced-colors: active) {
		.row.current .hit,
		.row.current:hover .hit {
			fill: none;
			stroke: Highlight;
			stroke-width: 2;
			forced-color-adjust: none;
		}

		.row.current .number circle {
			fill: Highlight;
			forced-color-adjust: none;
		}

		.row.current .number text {
			fill: HighlightText;
			forced-color-adjust: none;
		}
	}

	.row.current .hit,
	.row.current:hover .hit {
		fill: var(--accent-soft);
	}

	.row.current .label {
		fill: var(--fg);
		font-weight: 600;
		stroke: var(--accent-soft);
	}

	.row.current line,
	.row.current path {
		stroke-width: 2.6;
	}

	/* The one thing that moves on Next, and only there. What it carries shows when it gets there. */
	.packet {
		fill: var(--row);
		stroke: var(--accent-soft);
		stroke-width: 2;
		opacity: 0;
		animation: travel var(--send) ease-in-out;
	}

	.packet.empty {
		fill: var(--accent-soft);
		stroke: var(--row);
		stroke-width: 1.6;
	}

	.row.sending .label,
	.chip.sending,
	.held.landing {
		animation: lands 150ms var(--send) backwards;
	}

	@keyframes travel {
		from {
			transform: translateX(0);
			opacity: 1;
		}

		to {
			transform: translateX(var(--travel));
			opacity: 1;
		}
	}

	@keyframes lands {
		from {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.packet {
			display: none;
		}

		.row.sending .label,
		.chip.sending,
		.held.landing {
			animation: none;
		}
	}

	/* What just changed is a soft band that goes again, and not a colour or a box that stays. */
	.row.fresh .hit {
		fill: var(--fresh-soft);
		animation: settle-down 2.4s ease-out forwards;
	}

	.row.current.fresh .hit {
		fill: var(--accent-soft);
		animation: none;
	}

	@keyframes settle-down {
		to {
			fill: transparent;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.row.fresh .hit {
			animation: none;
		}
	}

	/* What is ahead stays faint, even when it is new, because it has not happened yet. */
	.row.fresh:not(.future) line,
	.row.fresh:not(.future) path,
	.row.fresh:not(.future) polygon {
		opacity: 1;
	}

	.row.fresh .label {
		fill: var(--fresh);
	}

	.row.fresh.future .number circle {
		fill: var(--bg);
		stroke: var(--fresh);
	}

	.row.fresh.future .number text {
		fill: var(--fresh);
	}

	.lane-head {
		cursor: pointer;
	}

	.lane-head:hover > rect {
		stroke: var(--strong-line);
	}

	.lane-head:focus {
		outline: none;
	}

	.lane-head:focus-visible > rect {
		stroke: var(--accent);
		stroke-width: 2;
	}

	.chip {
		pointer-events: none;
	}

	.chip:not([data-artifact]) {
		--chip: var(--muted);
		--chip-soft: var(--panel);
	}

	.chip[role='button']:not(.future) {
		pointer-events: auto;
		cursor: pointer;
	}

	.chip rect,
	.held rect {
		fill: var(--chip-soft);
		stroke: var(--chip);
	}

	.chip text,
	.held text {
		fill: var(--chip);
	}

	.chip text {
		font-size: 11.5px;
		font-weight: 600;
	}

	.chip:not([data-artifact]) text {
		font-family: var(--mono);
		font-weight: 500;
	}

	.chip.future:not(.fresh) {
		opacity: 0 !important;
	}

	/* Following one thing: its path stays, ahead as well because that is what was asked for, and the
	   rest goes quiet. Nothing gets a colour of its own. */
	.row.off-path line,
	.row.off-path path,
	.row.off-path polygon,
	.row.off-path .label,
	.row.off-path .number text,
	.held.off-path {
		opacity: 0.25;
	}

	/* Its circle stays solid, so that a lifeline does not run through the number. */
	.row.off-path .number circle {
		stroke-opacity: 0.25;
	}

	.chip.off-path {
		opacity: 0.25 !important;
	}

	.chip.off-path.future:not(.fresh) {
		opacity: 0 !important;
	}

	.row.on-path line,
	.row.on-path path,
	.row.on-path polygon {
		opacity: 1;
	}

	.chip.followed.future {
		opacity: 1 !important;
	}

	.chip.followed rect,
	.held.followed rect {
		stroke-width: 2;
	}

	/* What someone never saw, which is how much there was and nothing of what it said. */
	.bar,
	.lane-head .bar {
		fill: var(--line);
		stroke: none;
		opacity: var(--words, 1);
		pointer-events: none;
	}

	.chip-bar.future {
		opacity: 0 !important;
	}

	.row.unseen line,
	.row.unseen path,
	.row.unseen polygon {
		opacity: 0.18;
	}

	.row.unseen .number circle {
		fill: var(--bg);
		stroke: var(--line);
		stroke-width: 1;
	}

	.row.unseen .number text {
		fill: var(--muted);
	}

	.lane-head.eyes > rect {
		stroke: var(--fg);
		stroke-width: 2;
	}
</style>
