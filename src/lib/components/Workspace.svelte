<script lang="ts">
	import { tick, untrack } from 'svelte';
	import ChannelLegend from '#lib/components/ChannelLegend.svelte';
	import Diagram from '#lib/components/Diagram.svelte';
	import DiagramSwitch from '#lib/components/DiagramSwitch.svelte';
	import ExplainDialog from '#lib/components/ExplainDialog.svelte';
	import type { Opens } from '#lib/pictures/index.ts';
	import { landingSettings } from '#lib/pictures/build.ts';
	import Explanation from '#lib/components/Explanation.svelte';
	import EyesSwitch from '#lib/components/EyesSwitch.svelte';
	import FlowSwitch from '#lib/components/FlowSwitch.svelte';
	import WordsSwitch from '#lib/components/WordsSwitch.svelte';
	import FollowPath from '#lib/components/FollowPath.svelte';
	import LeftToYouPanel from '#lib/components/LeftToYouPanel.svelte';
	import Mark from '#lib/components/Mark.svelte';
	import PageWindow from '#lib/components/PageWindow.svelte';
	import QuestionAnswer from '#lib/components/QuestionAnswer.svelte';
	import ModeSwitch from '#lib/components/ModeSwitch.svelte';
	import OnTheWire from '#lib/components/OnTheWire.svelte';
	import SettingsPanel from '#lib/components/SettingsPanel.svelte';
	import SourcePanel from '#lib/components/SourcePanel.svelte';
	import StepControls from '#lib/components/StepControls.svelte';
	import StepDetail from '#lib/components/StepDetail.svelte';
	import Timeline from '#lib/components/Timeline.svelte';
	import { freshIds } from '#lib/diagram/fresh.ts';
	import { layoutDiagram } from '#lib/diagram/layout.ts';
	import { readingTime } from '#lib/diagram/motion.ts';
	import {
		afterFlip,
		afterMove,
		NOTHING_CHANGED,
		settingsNotHere,
		type LastChange
	} from '#lib/flow/changes.ts';
	import {
		arrivalsAt,
		diffViews,
		evaluate,
		holdingsAt,
		type BaseFlow,
		type DiagramId,
		introOf
	} from '#lib/flow/model.ts';
	import {
		namesSaid,
		parseNames,
		problemWith,
		seamOf,
		withNames,
		type GivenNames
	} from '#lib/flow/names.ts';
	import {
		defaultSettings,
		settingDefs,
		settingIds,
		simpleSettingIds,
		type SettingId,
		type Settings
	} from '#lib/flow/settings.ts';
	import {
		nextStep,
		previousStep,
		resolveStep,
		withDiagram,
		withSettingsHidden,
		withExplained,
		withEyes,
		withList,
		withDecoded,
		withRaw,
		withWhole,
		withFullSize,
		refFor,
		withWording,
		wordingOf,
		withFollow,
		withMode,
		withServerNotes,
		withSetting,
		withSourceClosed,
		withSourceOpen,
		withSourceSection,
		type AppState,
		type DroppedFromLink,
		type Explained
	} from '#lib/flow/state.ts';
	import { explanationOf, litBy, stateShowing } from '#lib/flow/explain.ts';
	import { sees } from '#lib/flow/eyes.ts';
	import { formsOf, pathOf } from '#lib/flow/follow.ts';
	import { artifacts, type ArtifactId } from '#lib/flow/vocabulary.ts';
	import type { ShotId } from '#lib/flow/vocabulary.ts';
	import { leftToYou } from '#lib/flow/left-to-you.ts';
	import { addressAt } from '#lib/recordings/address.ts';
	import type { Recording } from '#lib/recordings/format.ts';
	import {
		knownFrom,
		nearestRecordings,
		provenance,
		recordingFor,
		settingsOf
	} from '#lib/recordings/known.ts';
	import { notesFor } from '#lib/keycloak/notes.ts';
	import { searchState } from '#lib/search/open.svelte.ts';
	import { SITE_NAME } from '#lib/site.ts';
	import { nameIn, sayer, speak } from '#lib/flow/wording.ts';
	import { nameSources, sources } from '#lib/sources/sources.ts';

	interface Props {
		base: BaseFlow;
		state: AppState;
		animate?: boolean;
		/** What someone came to find out, when this came from the map. */
		question?: string | null;
		/** The answer to it, in a sentence or two. */
		answer?: string | null;
		/** What to follow through the flow, when its path is the answer. */
		questionFollows?: ArtifactId | null;
		/** The question someone came with, once the settings no longer answer it. */
		leftQuestion?: { title: string; href: string } | null;
		/** The question to go on to, once this flow is done. */
		onward?: { title: string; summary: string; href: string } | null;
		/** Where to run the same server at home, with these settings. */
		runHref?: string | null;
		/** How to set up an agent to make links with names, said where a link has them. */
		agentsHref?: string | null;
		/** What the link opened asked for and could not have, said in either mode (#177). */
		dropped?: readonly DroppedFromLink[];
		homeHref: string;
		/** The first screen, for someone who wants to start again and not go to where they were. */
		startHref?: string;
		hrefFor: (state: AppState) => string;
		loadText: (file: string) => Promise<string>;
		loadRecording: (preset: string) => Promise<Recording>;
		/** Where the picture of a page is. */
		pageImage?: ((shot: ShotId) => string) | null;
		/** The other base flows, and what to do when one is picked. */
		/** All that is left to someone is what they came for, so it says so. */
		questionOffersList?: boolean;
		flowChoices?: readonly { id: string; title: string }[];
		onflow?: (flow: string) => void;
		onnavigate: (next: AppState, history: 'push' | 'replace') => void;
		/** The part of the address after #, where a link can name the parties (#168). */
		linkNames?: string;
		/** Back to the site's own names. */
		ondropnames?: () => void;
		/** Names someone gave by hand, which go in the address the same way. */
		onnames?: ((names: GivenNames) => void) | null;
	}

	let {
		base,
		state: appState,
		animate = true,
		question = null,
		answer: questionAnswer = null,
		questionFollows = null,
		leftQuestion = null,
		onward = null,
		runHref = null,
		agentsHref = null,
		dropped = [],
		homeHref,
		startHref = homeHref,
		hrefFor,
		loadText,
		loadRecording,
		pageImage = null,
		flowChoices = [],
		questionOffersList = false,
		onflow,
		onnavigate,
		linkNames = '',
		ondropnames,
		onnames = null
	}: Props = $props();

	const flow = $derived(base.diagrams[appState.diagram]);
	// Every navigation makes a new state, and stepping should not count as the settings changing,
	// because a new view is what makes the diagram animate.
	const settingsKey = $derived(JSON.stringify(appState.settings));
	const unnamed = $derived.by(() => {
		const diagram = flow;
		void settingsKey;
		return evaluate(
			diagram,
			untrack(() => appState.settings)
		);
	});
	// The names a link gave go on the heads, and nowhere else (#168, ADR-017).
	const fromLink = $derived(parseNames(linkNames, base));
	const view = $derived(withNames(unnamed, fromLink.names));
	const namedHere = $derived(view.lifelines.filter((line) => line.given));
	const mode = $derived(appState.mode);
	const steps = $derived(view.steps);
	// Measured, because the diagram is laid out for the room it has and not scaled to fit.
	let canvasWidth = $state(0);
	let canvasHeight = $state(0);
	const room = $derived(canvasWidth ? { width: canvasWidth, height: canvasHeight } : undefined);
	// Whose words this is in, which only changes what is said, so all the rest goes on using the view.
	const wording = $derived(wordingOf(appState));
	// Read on its own, because a new state on every step should not mean a new layout.
	const whole = $derived(appState.whole);
	const say = $derived(sayer(wording));
	const spoken = $derived(speak(view, say));
	// A phone draws the lanes in a strip with every message's words beside them, and the whole thing at
	// its own size, moved sideways to the current message, for someone who asks for that (#15).
	const FULL_SIZE_WIDTH = 720;
	let phone = $state(false);
	// In the address, so a reload or a link keeps it, and it does nothing wider than a phone.
	const fullSize = $derived(appState.fullSize);
	$effect(() => {
		const query = window.matchMedia('(max-width: 767px)');
		const check = () => (phone = query.matches);
		check();
		query.addEventListener('change', check);
		return () => query.removeEventListener('change', check);
	});
	const strip = $derived(phone && !fullSize && !whole);
	const laidOutFor = $derived(
		phone && fullSize && room ? { width: FULL_SIZE_WIDTH, height: room.height } : room
	);
	const layout = $derived(layoutDiagram(view, mode, laidOutFor, wording, whole, strip));

	// Below this the settings do not fit beside the diagram, so they open over it when asked for.
	let settingsDoNotFit = $state(false);
	let settingsOpen = $state(false);
	$effect(() => {
		const query = window.matchMedia('(max-width: 1239px)');
		const check = () => {
			settingsDoNotFit = query.matches;
			if (!query.matches) settingsOpen = false;
		};
		check();
		query.addEventListener('change', check);
		return () => query.removeEventListener('change', check);
	});
	const settingsShown = $derived(settingsDoNotFit ? settingsOpen : !appState.settingsHidden);
	function toggleSettings() {
		if (settingsDoNotFit) settingsOpen = !settingsOpen;
		else onnavigate(withSettingsHidden(appState, !appState.settingsHidden), 'replace');
	}
	const position = $derived(steps.findIndex((step) => step.id === appState.step));
	const current = $derived(steps[position]);
	const holdings = $derived(holdingsAt(view, appState.step));
	const channelsHere = $derived([...new Set(steps.map((step) => step.channel))]);
	// Simple mode is the diagram and the step. Each thing it leaves out is one press of Advanced away,
	// and still there if an address or a question has it on, so nobody is left with no way back.
	const simple = $derived(appState.mode === 'simple');

	/** A dropped setting by its name on screen, with the value the link asked for and why. */
	function droppedSaid({ setting, asked, because }: DroppedFromLink): string {
		const def = settingDefs[setting];
		const label = simple ? (def.simple?.label ?? def.label) : def.label;
		const value = asked.slice(asked.indexOf('=') + 1);
		const option =
			def.kind === 'choice' ? def.options.find((o) => String(o.value) === value) : null;
		return `${label}${option ? `: ${option.label}` : ''}. ${because}`;
	}
	const nothingOnOffer = $derived(
		simple &&
			!base.settings.some((id) => simpleSettingIds.includes(id)) &&
			settingIds.every((id) => appState.settings[id] === defaultSettings[id])
	);
	const origin = $derived(provenance(base, flow, appState.settings));

	let statusLine = $state<HTMLElement>();
	let last = $state.raw<LastChange>(NOTHING_CHANGED);
	// Set by flipping a setting, until the screen has moved to what that asked for.
	let flipping: Settings | null = null;
	let previousView = untrack(() => view);
	let previousStepId = untrack(() => appState.step);
	let previousDiagram = untrack(() => appState.diagram);

	$effect.pre(() => {
		const nextView = view;
		const stepId = appState.step;
		const diagram = appState.diagram;
		untrack(() => {
			last = afterMove(last, {
				diff: diffViews(previousView, nextView),
				stepChanged: stepId !== previousStepId,
				diagramChanged: diagram !== previousDiagram,
				ready: animate,
				byFlip: flipping !== null && JSON.stringify(flipping) === settingsKey
			});
			flipping = null;
			previousView = nextView;
			previousStepId = stepId;
			previousDiagram = diagram;
		});
	});

	const fresh = $derived(last.diff ? freshIds(last.diff) : new Set<string>());
	// What a flip changed, to bring into view. New steps if there are any, because a message reworded
	// further up is not what someone is looking for.
	const flipped = $derived.by(() => {
		if (!last.setting || !last.diff) return null;
		const { addedSteps } = last.diff;
		return new Set(addedSteps.length ? addedSteps : [...fresh].map((id) => id.split(':')[0]));
	});

	const otherDiagram = $derived<DiagramId>(appState.diagram === 'flow' ? 'setup' : 'flow');
	// Going to look at the other diagram and coming back should not lose your place.
	let stepIn = $state<Record<DiagramId, string | null>>({ flow: null, setup: null });
	$effect(() => {
		stepIn[appState.diagram] = appState.step;
	});
	const hrefs = $derived({
		flow: hrefFor(withDiagram(base, appState, 'flow', stepIn.flow)),
		setup: hrefFor(withDiagram(base, appState, 'setup', stepIn.setup))
	});
	// At the end of the setup, the way on is the flow it was for, and not some other question.
	// What the first diagram is called, in the middle of a sentence.
	const flowName = $derived((base.diagrams.flow.named ?? 'The user flow').replace(/^The/, 'the'));
	const wayOn = $derived(
		appState.diagram === 'setup'
			? {
					label: `On to ${flowName}`,
					title: `${flowName[0].toUpperCase()}${flowName.slice(1)}`,
					summary: `${base.diagrams.flow.caption.replace(/\.$/, '')}, now that this is set up.`,
					href: hrefs.flow
				}
			: onward
	);
	const links = $derived(
		current.links.map((link) => ({
			text: link.text,
			href: hrefFor(withDiagram(base, appState, link.diagram, link.step))
		}))
	);
	const elsewhere = $derived(
		last.elsewhere
			? {
					text: `It changes ${otherDiagram === 'flow' ? flowName : 'the setup'}.`,
					href: hrefs[otherDiagram]
				}
			: null
	);

	const notHere = $derived(
		mode === 'simple' ? settingsNotHere(base, appState.diagram, appState.settings) : []
	);
	const settingsElsewhere = $derived({
		text: otherDiagram === 'flow' ? 'user flow' : 'setup',
		href: hrefs[otherDiagram]
	});

	function setSetting<K extends SettingId>(id: K, value: Settings[K]) {
		const result = withSetting(base, appState, id, value);
		last = afterFlip(
			last,
			id,
			flow,
			base.diagrams[otherDiagram],
			appState.settings,
			result.state.settings,
			result.resets
		);
		flipping = result.state.settings;
		sending = null;
		onnavigate(result.state, 'push');
	}

	function go(next: AppState | null) {
		if (next) onnavigate(next, 'replace');
	}

	const focusControls = () =>
		window.document
			.querySelector<HTMLElement>('[data-testid="next"], [data-testid="next-question"]')
			?.focus();

	const back = () => go(previousStep(base, appState));
	// Next and Execute send a message. Back and a jump only show where it was, so nothing moves.
	let sending = $state<string | null>(null);
	$effect.pre(() => {
		if (appState.step !== untrack(() => sending)) sending = null;
	});
	const landing = $derived(sending ? arrivalsAt(view, sending) : new Set<string>());
	const forward = () => {
		const next = nextStep(base, appState);
		sending = next?.step ?? null;
		go(next);
	};

	// Only ever about what is shown, so a flow looks the same underneath (ADR-004).
	const parties = $derived(
		view.lifelines.map((line) => ({ id: line.id, name: nameIn(line, wording) }))
	);
	const eyesName = $derived(parties.find((party) => party.id === appState.eyes)?.name ?? null);
	const seesStep = (id: string) => {
		const step = steps.find((candidate) => candidate.id === id);
		return !appState.eyes || !step || sees(step, appState.eyes);
	};
	const stepsSeen = $derived(steps.filter((step) => seesStep(step.id)).length);
	const seeAs = (party: string | null) => onnavigate(withEyes(appState, party), 'push');

	const stops = $derived(appState.follow ? pathOf(view, appState.follow) : []);
	const followed = $derived(
		appState.follow
			? { steps: new Set(stops.map(({ step }) => step)), forms: formsOf(appState.follow) }
			: null
	);
	const follow = (thing: ArtifactId | null) => onnavigate(withFollow(appState, thing), 'push');

	// A name of someone's own is typed into the head's explanation, which a right-click or a long press
	// opens ready for it. A plain click only explains, so nothing is renamed by accident. In advanced
	// mode first, and the name stays on in simple mode, because it is in the address.
	let renaming = $state<string | null>(null);
	const canRename = $derived(!simple && Boolean(onnames));
	function renameFor(party: string | undefined) {
		if (!party || !canRename || !onnames) return null;
		const give = onnames;
		return {
			current: fromLink.names[party] ?? null,
			apply: (name: string) => {
				const problem = problemWith(name);
				if (problem) return problem;
				give({ ...fromLink.names, [party]: name.trim().replace(/\s+/g, ' ') });
				renaming = null;
				return null;
			},
			reset: () =>
				give(Object.fromEntries(Object.entries(fromLink.names).filter(([id]) => id !== party))),
			focus: renaming === party
		};
	}
	function renameLifeline(id: string) {
		renaming = id;
		explain({ kind: 'lifeline', id });
	}

	const decode = (decoded: boolean) => onnavigate(withDecoded(appState, decoded), 'push');
	// A part of a picture goes to the steps it stands for, with the settings on screen where they can
	// draw them, and otherwise with a recorded preset's. Back comes back to the picture.
	function openPart(opens: Opens) {
		const settings = landingSettings(opens, appState.settings);
		onnavigate(
			{
				...appState,
				diagram: opens.diagram,
				settings,
				step: opens.step,
				explained: null,
				eyes: null,
				follow: null
			},
			'push'
		);
	}
	const explain = (explained: Explained | null) =>
		onnavigate(withExplained(appState, explained), 'push');
	const explanation = $derived(explanationOf(appState, view, holdings));
	const lit = $derived(litBy(appState, view));
	// Away from what it is about, so that it can still be seen. Otherwise it can be in the middle.
	const sideFor = $derived.by(() => {
		if (lit?.part) return 'right';
		const line =
			lit?.lifeline ?? (appState.explained?.kind === 'lifeline' ? appState.explained.id : null);
		const row = lit?.step ? layout.rows.find((candidate) => candidate.id === lit.step) : null;
		const x = row
			? (row.x1 + row.x2) / 2
			: layout.lanes.find((candidate) => candidate.id === line)?.x;
		if (x === undefined) return null;
		return x > layout.width / 2 ? 'left' : 'right';
	});
	const showing = $derived(stateShowing(base, appState));
	const explainTerm = (id: string) => explain({ kind: 'term', id });
	// The setting an open explanation is about is where its sources should open from.
	const explainedSetting = $derived(
		appState.explained?.kind === 'setting' ? appState.explained.id : null
	);
	// Someone with a question has its answer, which already says what this would.
	const intro = $derived(
		position === 0 && !questionAnswer ? say(introOf(flow, appState.settings)) : null
	);
	// Said once, on the step someone enters it by, and the first step has more to say than this.
	const partWhy = $derived(
		position > 0 ? spoken.parts.find((part) => part.steps[0] === current.id)?.why : null
	);
	const notes = $derived(
		appState.serverNotes
			? notesFor(base.id, current.id, appState.settings).map((note) => ({
					...note,
					title: say(note.title),
					text: say(note.text)
				}))
			: []
	);

	// Raw traffic is only for advanced mode, and only what is on the wire has any.
	const onWire = $derived(
		appState.mode === 'advanced' && (current.channel === 'front' || current.channel === 'back')
	);
	// Loaded when it is first asked for, so simple mode downloads none of it.
	const wantedPreset = $derived(
		onWire || current.page ? (recordingFor(base, appState.settings)?.id ?? null) : null
	);
	let loaded = $state.raw<Recording | null>(null);
	let failedPreset = $state<string | null>(null);
	$effect(() => {
		const preset = wantedPreset;
		if (!preset || untrack(() => loaded?.preset) === preset) return;
		let stale = false;
		loadRecording(preset).then(
			(recording) => {
				if (!stale) loaded = recording;
			},
			() => {
				if (!stale) failedPreset = preset;
			}
		);
		return () => {
			stale = true;
		};
	});
	const recording = $derived(loaded?.preset === wantedPreset ? loaded : null);
	// The recording keeps its own names, so the raw view says which recorded value is which.
	const seam = $derived(
		recording && namedHere.length ? seamOf(recording, view, appState.serverNotes) : null
	);
	// It is what the browser showed, so it is not what anyone else saw.
	const inBrowser = $derived(!appState.eyes || appState.eyes === 'browser');
	const pageAddress = $derived(
		recording && current.page ? addressAt(recording, current.page.address) : null
	);
	const imageOf = $derived(appState.serverNotes ? pageImage : null);
	const wireStatus = $derived.by(() => {
		if (!recordingFor(base, appState.settings)) return 'none';
		if (recording) return 'loaded';
		return failedPreset === wantedPreset ? 'failed' : 'loading';
	});
	const nearest = $derived(
		wireStatus === 'none'
			? nearestRecordings(base, appState.settings).map((preset) => {
					const settings = settingsOf(preset);
					const step = resolveStep(flow, evaluate(flow, settings), appState.step);
					return { text: preset.title, href: hrefFor({ ...appState, settings, step }) };
				})
			: []
	);
	// Only what can really be replayed: with no recording, or nothing recorded here, it would be a lie.
	const answer = $derived(
		recording?.messages.some((message) => message.step === current.id) ? current.execute : undefined
	);
	const numberOf = (id: string) => {
		const at = steps.findIndex((step) => step.id === id);
		return at < 0 ? null : at + 1;
	};
	const goToStep = (step: string) => {
		if (numberOf(step) !== null) onnavigate({ ...appState, step }, 'replace');
	};

	// For presenting, and for someone who only wants to watch. Anything anyone does stops it, and a
	// step replaces the last one in the history, so Back still leaves the page.
	let playing = $state(false);
	const toRead = $derived(
		readingTime(`${mode === 'simple' ? current.plain : current.label} ${current.concept}`)
	);
	function togglePlaying() {
		if (!playing && position === steps.length - 1) goToStep(steps[0].id);
		playing = !playing;
	}
	$effect(() => {
		if (!playing) return;
		if (!nextStep(base, appState)) {
			playing = false;
			return;
		}
		const moving = setTimeout(forward, toRead);
		const stop = (event: Event) => {
			const onPlay = (event.target as Element).closest?.('[data-testid="play"]');
			const pressesIt = !(event instanceof KeyboardEvent) || [' ', 'Enter'].includes(event.key);
			if (!onPlay || !pressesIt) playing = false;
		};
		const inputs = ['pointerdown', 'keydown', 'wheel', 'popstate'];
		for (const input of inputs) window.addEventListener(input, stop, true);
		return () => {
			clearTimeout(moving);
			for (const input of inputs) window.removeEventListener(input, stop, true);
		};
	});

	// The answer stays marked until someone moves on. A link to the step just shows the step.
	let executed = $state<{ from: string; to: string } | null>(null);
	// Only while that step is still there, which a setting changed since may have ended.
	const answerTo = $derived(
		executed?.to === appState.step && numberOf(executed.from) !== null ? executed.from : null
	);
	function execute() {
		if (!answer) return;
		executed = { from: appState.step, to: answer };
		sending = answer;
		goToStep(answer);
		// The button is gone now, and what came back is what to read next.
		tick().then(() =>
			window.document.querySelector<HTMLElement>('[data-testid="payload"]')?.focus()
		);
	}

	const openSource = $derived(appState.source);
	const openWhy = $derived(
		openSource
			? refFor(
					openSource.fromStep
						? current.cites
						: openSource.setting
							? settingDefs[openSource.setting].sources
							: nameSources,
					openSource.id,
					openSource.section
				)?.why
			: undefined
	);
	const closeSource = () => onnavigate(withSourceClosed(appState), 'push');

	const left = $derived(appState.list ? leftToYou(base, appState.settings, say) : null);
	const openList = () => onnavigate(withList(appState, true), 'push');
	const closeList = () => {
		onnavigate(withList(appState, false), 'push');
		tick().then(() =>
			window.document
				.querySelector<HTMLElement>('[data-testid="to-list"], [data-testid="answer-list"]')
				?.focus()
		);
	};

	// Back to the source that opened it, however it closed, so a keyboard user keeps their place.
	let lastSource = untrack(() => appState.source);
	$effect(() => {
		const source = appState.source;
		untrack(() => {
			if (lastSource && !source) {
				const opener = lastSource.fromStep
					? `[data-step-source="${lastSource.id}"]${lastSource.section ? `[data-section="${lastSource.section}"]` : ''}`
					: `[data-name-source="${lastSource.id}"]`;
				tick().then(() => window.document.querySelector<HTMLElement>(opener)?.focus());
			}
			lastSource = source;
		});
	});

	// Someone who tabbed into what they are reading wants the page keys to scroll it. Someone who clicked
	// something there, as a presenter does, has a clicker that only sends those keys.
	let tabbedIn = false;

	// A new step is read from its start, which the panel scrolled down for the last one would hide.
	let detailPanel = $state<HTMLElement>();
	$effect(() => {
		void appState.step;
		untrack(() => detailPanel?.scrollTo({ top: 0 }));
	});

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Tab') tabbedIn = true;
		// What is open on top has these keys, and closes itself.
		if (window.document.querySelector('dialog[open]')) return;
		// With a modifier these belong to the browser, such as Alt+Left and Shift+End.
		if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
		if (event.key === 'Escape' && appState.list) {
			closeList();
			return;
		}
		if (event.key === 'Escape' && appState.raw) {
			onnavigate(withRaw(appState, false), 'push');
			return;
		}
		if (event.key === 'Escape' && appState.whole) {
			onnavigate(withWhole(appState, false), 'push');
			return;
		}
		const target = event.target as HTMLElement;
		// A switch has no use for these keys, and keeps the focus after it is clicked.
		const typing = 'input:not([type="checkbox"]), select, textarea';
		const isPageKey = event.key.startsWith('Page');
		// A list would change on a page key, without anyone having asked for that.
		if (target.closest(typing) && !(isPageKey && target.closest('select'))) return;
		if (isPageKey && target.closest('.detail') && tabbedIn) return;
		const move = {
			ArrowRight: forward,
			ArrowLeft: back,
			PageDown: forward,
			PageUp: back,
			Home: () => goToStep(steps[0].id),
			End: () => goToStep(steps[steps.length - 1].id)
		}[event.key];
		if (move) {
			event.preventDefault();
			move();
		}
	}
</script>

{#snippet recorded()}
	{#if origin.recorded && origin.noServer}
		Recorded from a small demo app and API, on {origin.date}.
	{:else if origin.recorded}
		{origin.onlyItsHttp ? 'Its HTTP was recorded from' : 'Recorded from'}
		{#if !appState.serverNotes}
			a real server
		{:else}
			Keycloak {origin.keycloak}
		{/if}
		on {origin.date}.
	{:else}
		Recorded message by message, with other settings, not these together.
	{/if}
{/snippet}

{#snippet stepping()}
	<StepControls
		position={position + 1}
		total={steps.length}
		canGoBack={previousStep(base, appState) !== null}
		onback={back}
		onnext={forward}
		answerAt={answer ? numberOf(answer) : null}
		onexecute={execute}
		onwardHref={wayOn?.href ?? null}
		onwardLabel={wayOn && 'label' in wayOn ? wayOn.label : undefined}
	/>
{/snippet}

<svelte:window {onkeydown} onpointerdown={() => (tabbedIn = false)} />

<div
	class="workspace"
	data-testid="workspace"
	class:settings-hidden={appState.settingsHidden}
	class:no-panel={nothingOnOffer}
	class:whole={appState.whole}
	class:settings-open={settingsOpen}
	data-ready={animate}
	data-diagram={appState.diagram}
>
	{#snippet howToRead()}
		<button
			type="button"
			class="quiet"
			data-testid="how-to-read"
			onclick={() => explainTerm('reading')}
		>
			How to read this
		</button>
	{/snippet}
	{#snippet wholeFlow()}
		<button
			type="button"
			class="quiet"
			data-testid="whole-flow"
			onclick={() => onnavigate(withWhole(appState, !appState.whole), 'push')}
		>
			{appState.whole ? 'Back to the step' : 'See the whole flow'}
		</button>
	{/snippet}
	{#snippet recordedLine()}
		<p class="recorded">
			<span data-testid="provenance">{@render recorded()}</span>
			<button
				type="button"
				class="quiet"
				data-testid="server-notes-quick"
				onclick={() =>
					appState.serverNotes
						? explainTerm('keycloak')
						: onnavigate(withServerNotes(appState, true), 'push')}
			>
				{appState.serverNotes ? 'What is Keycloak?' : 'Show the server notes'}
			</button>
		</p>
	{/snippet}

	<header>
		<!-- The way forward is after every setting, so it should not take thirty presses to get to. -->
		<button type="button" class="skip" data-testid="skip-to-controls" onclick={focusControls}>
			Skip to the step controls
		</button>
		<span class="brands">
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the route resolves it -->
			<a class="brand" href={startHref} data-testid="to-the-start">
				<Mark />
				<span class="name">{SITE_NAME}</span>
			</a>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the route resolves it -->
			<a class="brand" href={homeHref}>Map</a>
		</span>
		<span class="slash" aria-hidden="true">/</span>
		<h1 data-testid="title" title={question ?? flow.title}>{question ?? flow.title}</h1>
		{#if leftQuestion}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the route resolves it -->
			<a class="from" href={leftQuestion.href} data-testid="from-question">
				From: {leftQuestion.title}
			</a>
		{/if}
		<ModeSwitch
			mode={appState.mode}
			onchange={(mode) => onnavigate(withMode(appState, mode), 'push')}
		/>
		{#if (!simple || appState.wording) && !phone}
			<WordsSwitch
				current={wording}
				serverNotes={appState.serverNotes}
				onchange={(chosen) => onnavigate(withWording(appState, chosen), 'push')}
			/>
		{/if}
		<p class="status">
			{#if !simple}
				<span
					class="what"
					data-testid="provenance"
					bind:this={statusLine}
					title={statusLine?.textContent?.trim()}
				>
					{#if question}{flow.title}.{/if} Based on {origin.specs.join(', ')}.
					{@render recorded()}
				</span>
			{/if}
			<button
				type="button"
				class="quiet"
				data-testid="open-search"
				title="Press / from anywhere"
				onclick={() => (searchState.open = true)}
			>
				Search
			</button>
			{#if !simple}
				<button
					type="button"
					class="quiet"
					data-testid="server-notes-quick"
					onclick={() =>
						appState.serverNotes
							? explainTerm('keycloak')
							: onnavigate(withServerNotes(appState, true), 'push')}
				>
					{appState.serverNotes ? 'What is Keycloak?' : 'Show the server notes'}
				</button>
			{/if}
		</p>
	</header>

	{#if !nothingOnOffer}
		<!-- At the side the settings are on, and in one place, so it can be pressed twice. -->
		<button
			type="button"
			class="settings-toggle"
			class:rail={!settingsShown || settingsDoNotFit}
			data-testid="settings-toggle"
			aria-expanded={settingsShown}
			onclick={toggleSettings}
		>
			<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
				<path
					d={settingsShown ? 'M8 2 L4 6 L8 10' : 'M4 2 L8 6 L4 10'}
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
				/>
			</svg>
			<span>{settingsShown ? 'Hide settings' : 'Show settings'}</span>
		</button>
	{/if}

	<aside class="settings" aria-label="Settings">
		{#if phone}
			<!-- Not needed while stepping, so on a phone it waits here and leaves the room to the step. -->
			{#if !simple || appState.wording || appState.eyes || appState.whole}
				<section class="shown" data-testid="how-it-is-shown">
					{#if !simple || appState.wording}
						<WordsSwitch
							current={wording}
							serverNotes={appState.serverNotes}
							onchange={(chosen) => onnavigate(withWording(appState, chosen), 'push')}
						/>
					{/if}
					{#if !simple || appState.eyes}
						<EyesSwitch {parties} current={appState.eyes} onchange={seeAs} />
					{/if}
					{#if !simple || appState.whole}
						{@render wholeFlow()}
					{/if}
					{#if !simple}
						{@render recordedLine()}
					{/if}
				</section>
			{/if}
		{/if}
		{#if !simple && flowChoices.length > 1}
			<FlowSwitch flows={flowChoices} current={base.id} onchange={(id) => onflow?.(id)} />
		{/if}
		<SettingsPanel
			notApplicable={base.notHere}
			{say}
			settings={appState.settings}
			available={base.settings}
			mode={appState.mode}
			onchange={setSetting}
			serverNotes={appState.serverNotes}
			onservernotes={(on) => onnavigate(withServerNotes(appState, on), 'push')}
			{notHere}
			elsewhere={settingsElsewhere}
			onexplain={(id) => explain({ kind: 'setting', id })}
		/>
	</aside>

	<main class="diagram">
		<div class="above">
			<DiagramSwitch
				current={appState.diagram}
				{hrefs}
				caption={simple || phone ? '' : say(flow.caption)}
				flowName={base.diagrams.flow.named}
			/>
			{#if (!simple || appState.eyes) && !phone}
				<EyesSwitch {parties} current={appState.eyes} onchange={seeAs} />
			{/if}
			{#if !phone}
				{@render howToRead()}
			{/if}
			{#if phone && !appState.whole}
				<button
					type="button"
					class="quiet"
					data-testid="full-size"
					aria-pressed={fullSize}
					onclick={() => onnavigate(withFullSize(appState, !fullSize), 'push')}
				>
					{fullSize ? 'Fit to the screen' : 'Full size'}
				</button>
			{/if}
			{#if (!simple || appState.whole) && !phone}
				{@render wholeFlow()}
			{/if}
		</div>
		<div class="canvas" bind:clientWidth={canvasWidth} bind:clientHeight={canvasHeight}>
			<!-- Two diagrams, not two states of one, so switching does not animate. -->
			{#key appState.diagram}
				<Diagram
					{layout}
					{animate}
					{fresh}
					{flipped}
					{holdings}
					{lit}
					{sending}
					{landing}
					eyes={appState.eyes}
					{followed}
					fullSize={phone && fullSize}
					currentStep={appState.step}
					onexplainlifeline={(id) => {
						renaming = null;
						explain({ kind: 'lifeline', id });
					}}
					onrenamelifeline={canRename ? renameLifeline : null}
					onexplainartifact={(id: ArtifactId) => explain({ kind: 'artifact', id })}
					onselect={goToStep}
				/>
			{/key}
		</div>
		<div class="legend">
			<ChannelLegend present={channelsHere} />
			<!-- Where it was recorded is said only where what was recorded can be seen, in advanced mode,
			     because in simple mode it pointed at nothing (the maintainer, 2026-11-06). -->
			{#if phone}
				{@render howToRead()}
			{/if}
		</div>
	</main>

	<aside class="detail" aria-label="The current step" bind:this={detailPanel}>
		{#if dropped.length}
			<!-- A link that asks for what does not go together loses some of it, and says so (#177). -->
			<section class="named" data-testid="dropped-note" role="status">
				<p><strong>Turned off from the link you opened:</strong></p>
				<ul>
					{#each dropped as off (off.setting)}
						<li>{droppedSaid(off)}</li>
					{/each}
				</ul>
			</section>
		{/if}
		{#if namedHere.length || fromLink.problems.length}
			<!-- Whoever made the link chose these, so it says so, and what was recorded stays the site's. -->
			<section class="named" data-testid="names-note" role="status">
				{#if namedHere.length}
					<p>
						<strong>Names from the link you opened:</strong>
						{namesSaid(namedHere)}. Whoever made the link chose them. What was recorded is the
						site's own, from its own server.
						{#if agentsHref}
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the route resolves it -->
							<a href={agentsHref} data-testid="names-agents">How an agent makes these.</a>
						{/if}
					</p>
				{/if}
				{#if fromLink.problems.length}
					<p>Some of what the link names could not be used:</p>
					<ul data-testid="names-problems">
						{#each fromLink.problems as problem (problem)}
							<li>{problem}</li>
						{/each}
					</ul>
				{/if}
				<button type="button" class="quiet" data-testid="names-off" onclick={() => ondropnames?.()}>
					Use the site's names
				</button>
			</section>
		{/if}
		{#if eyesName}
			<section class="eyes" data-testid="eyes-note" role="status">
				<p>
					<strong>Seen as: {eyesName}.</strong>
					This shows what it was sent or sent itself, {stepsSeen} of the {steps.length} steps. Not what
					it could work out, or what anything else running there could read.
				</p>
				<button type="button" class="quiet" data-testid="eyes-off" onclick={() => seeAs(null)}>
					See everything again
				</button>
			</section>
		{/if}
		{#if appState.follow}
			<FollowPath
				label={artifacts[appState.follow].label}
				{stops}
				current={appState.step}
				{numberOf}
				onstep={goToStep}
				onstop={() => follow(null)}
			/>
		{/if}
		{#if questionAnswer}
			<QuestionAnswer
				answer={say(questionAnswer)}
				follows={questionFollows && !appState.follow ? artifacts[questionFollows].label : null}
				onfollow={() => follow(questionFollows)}
				onrewind={position > 0 ? () => goToStep(steps[0].id) : null}
				onterm={explainTerm}
				serverNamed={appState.serverNotes}
				onlist={questionOffersList ? openList : null}
			/>
		{/if}
		{#if !appState.whole}
			<div class="stepping">{@render stepping()}</div>
		{/if}
		<StepDetail
			step={spoken.steps[position]}
			lifelines={view.lifelines}
			mode={appState.mode}
			{wording}
			pageImage={imageOf}
			oncite={(ref) => onnavigate(withSourceOpen(appState, null, ref, true), 'push')}
			onlist={openList}
			{intro}
			{partWhy}
			unseenButInThePage={appState.eyes === 'browser' &&
				appState.settings.clientType === 'public' &&
				appState.settings.appRuns !== 'page'}
			unseenBy={seesStep(current.id) ? null : eyesName}
			previousChannel={steps[position - 1]?.channel ?? null}
			atEnd={position === steps.length - 1}
			onward={wayOn}
			mapHref={homeHref}
			change={last.diff}
			resets={last.resets}
			{links}
			{elsewhere}
			changed={last.setting}
			changedTo={last.setting ? appState.settings[last.setting] : undefined}
			onterm={explainTerm}
			{notes}
			serverNamed={appState.serverNotes}
			known={knownFrom(base, current, appState.settings)}
			folded={phone}
		>
			{#snippet inTheBrowser()}
				{@const page = spoken.steps[position].page}
				{#if page && inBrowser}
					<PageWindow
						address={pageAddress}
						marks={page.marks}
						shows={page.shows}
						image={page.shot && imageOf ? imageOf(page.shot) : null}
						upstream={page.shot === 'login-upstream'}
						everything={appState.mode === 'advanced'}
						onterm={explainTerm}
					/>
				{/if}
			{/snippet}
			{#snippet wire()}
				{#if onWire}
					<OnTheWire
						step={current}
						{recording}
						status={wireStatus}
						{nearest}
						{answerTo}
						{numberOf}
						onstep={goToStep}
						serverNamed={appState.serverNotes}
						{seam}
						folded={phone}
						{notes}
						{seesStep}
						{runHref}
						onlarge={() => onnavigate(withRaw(appState, true), 'push')}
						decoded={appState.decoded}
						ondecode={decode}
					/>
				{/if}
			{/snippet}
		</StepDetail>
	</aside>

	<!-- Where the whole flow is, and a way to watch it go by. Stepping is beside the step, unless the
	     diagram has the screen to itself. -->
	<footer>
		{#if appState.whole}{@render stepping()}{/if}
		<button class="play" data-testid="play" onclick={togglePlaying}>
			{playing ? 'Stop' : 'Play'}
		</button>
		<Timeline
			parts={spoken.parts}
			current={current.id}
			onjump={goToStep}
			waiting={playing ? toRead : null}
		/>
	</footer>

	{#if appState.raw && appState.mode === 'advanced'}
		<div class="source raw-large" data-testid="raw-large">
			<header>
				<h2>{spoken.steps[position].label}</h2>
				<button
					type="button"
					data-testid="raw-close"
					onclick={() => onnavigate(withRaw(appState, false), 'push')}
				>
					Close
				</button>
			</header>
			{#if onWire}
				<OnTheWire
					step={current}
					{recording}
					status={wireStatus}
					{nearest}
					{answerTo}
					{numberOf}
					onstep={goToStep}
					serverNamed={appState.serverNotes}
					{seam}
					{notes}
					{seesStep}
					large
					decoded={appState.decoded}
					ondecode={decode}
				/>
			{:else}
				<p>Nothing goes over the wire at this step.</p>
			{/if}
		</div>
	{/if}
	{#if left}
		<div class="source wide" data-list-open>
			<LeftToYouPanel
				list={left}
				serverNamed={appState.serverNotes}
				onterm={explainTerm}
				onclose={closeList}
				onstep={({ diagram, step }) =>
					onnavigate(
						diagram === appState.diagram
							? { ...appState, step }
							: withDiagram(base, appState, diagram, step),
						'push'
					)}
			/>
		</div>
	{/if}
	{#if explanation}
		<ExplainDialog
			label={explanation.title}
			side={sideFor}
			picture={Boolean(explanation.picture)}
			onclose={() => explain(null)}
		>
			<Explanation
				{...explanation}
				onpart={explainTerm}
				seeIt={showing ? hrefFor(showing) : null}
				onleaveout={explanation.aboutTheServer
					? () => onnavigate(withServerNotes(withExplained(appState, null), false), 'push')
					: null}
				onseeonly={explanation.party
					? () =>
							onnavigate(
								withEyes(
									withExplained(appState, null),
									appState.eyes === explanation.party ? null : explanation.party!
								),
								'push'
							)
					: null}
				seeingOnly={appState.eyes === explanation.party}
				rename={renameFor(explanation.party)}
				onfollow={explanation.follows
					? () =>
							onnavigate(
								withFollow(
									withExplained(appState, null),
									appState.follow === explanation.follows ? null : explanation.follows!
								),
								'push'
							)
					: null}
				following={appState.follow === explanation.follows}
				onclose={() => explain(null)}
				onopenpart={openPart}
				onexplainartifact={(id) => explain({ kind: 'artifact', id })}
				onopensource={(ref) => onnavigate(withSourceOpen(appState, explainedSetting, ref), 'push')}
			/>
		</ExplainDialog>
	{/if}
	{#if openSource && openWhy}
		{#key `${openSource.setting}:${openSource.id}`}
			<ExplainDialog
				label={`Source: ${sources[openSource.id].label}`}
				wide={Boolean(sources[openSource.id].textFile)}
				onclose={closeSource}
			>
				<SourcePanel
					source={sources[openSource.id]}
					why={openWhy}
					section={openSource.section}
					{loadText}
					onsection={(section) => onnavigate(withSourceSection(appState, section), 'replace')}
					onclose={closeSource}
				/>
			</ExplainDialog>
		{/key}
	{/if}
</div>

<style>
	.workspace {
		display: grid;
		grid-template:
			'header header header' auto
			'settings diagram detail' minmax(0, 1fr)
			'settings controls detail' auto
			/ 240px minmax(0, 1fr) 330px;
		height: 100dvh;
	}

	header {
		grid-area: header;
		display: flex;
		align-items: baseline;
		gap: 10px;
		padding: 10px 16px;
		border-bottom: 1px solid var(--line);
	}

	.brands {
		display: inline-flex;
		flex: none;
		align-items: baseline;
		gap: 6px;
	}

	.brand {
		display: inline-flex;
		flex: none;
		align-items: baseline;
		gap: 6px;
		color: var(--muted);
		font-weight: 500;
		text-decoration: none;
	}

	.brand:hover {
		color: var(--fg);
	}

	.name {
		color: var(--fg);
		font-weight: 600;
	}

	.slash {
		color: var(--muted);
	}

	.skip {
		position: absolute;
		z-index: 2;
		transform: translateY(-300%);
	}

	.skip:focus-visible {
		transform: none;
	}

	h1 {
		flex: 0 1 auto;
		min-width: 0;
		margin: 0;
		overflow: hidden;
		font-size: 16px;
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.from {
		flex: 0 2 auto;
		min-width: 0;
		overflow: hidden;
		color: var(--muted);
		font-size: 12.5px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.status {
		display: flex;
		flex: 1;
		align-items: baseline;
		justify-content: flex-end;
		gap: 10px;
		min-width: 0;
		margin: 0;
		color: var(--muted);
		font-size: 12px;
	}

	/* One line, so the diagram does not lose height to it. All of it is in the source and the title. */
	.what {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.settings-toggle {
		grid-area: settings;
		z-index: 3;
		display: flex;
		align-items: flex-start;
		align-self: start;
		justify-self: stretch;
		margin-right: 1px;
		gap: 6px;
		padding: 10px 10px 4px;
		border: 0;
		border-radius: 0;
		color: var(--muted);
		font-size: 12px;
		line-height: 12px;
		white-space: nowrap;
		background: var(--bg);
	}

	.settings-toggle svg {
		flex: none;
	}

	.settings-toggle:hover {
		color: var(--fg);
	}

	/* All the height of the page, so there is no missing it, in the room of one column of a row. */
	.settings-toggle.rail {
		flex-direction: column;
		align-self: stretch;
		justify-self: stretch;
		margin-right: 1px;
		gap: 8px;
		border-right: 1px solid var(--line);
	}

	.settings-toggle.rail span {
		align-self: center;
		writing-mode: vertical-rl;
	}

	.quiet {
		flex: none;
		padding: 0;
		border: 0;
		background: none;
		color: var(--muted);
		font-size: 12px;
		text-decoration: underline;
		white-space: nowrap;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 16px;
		border-top: 1px solid var(--line);
	}

	.recorded {
		margin: 0 12px 0 auto;
		color: var(--muted);
		font-size: 12px;
	}

	.above {
		display: flex;
		align-items: center;
		gap: 12px;
		padding-right: 12px;
	}

	.above :global(nav) {
		margin-right: auto;
	}

	.eyes,
	.named {
		margin: 0 0 14px;
		padding: 10px 12px;
		border-radius: 8px;
		background: var(--panel);
		font-size: 12.5px;
	}

	.eyes p,
	.named p {
		margin: 0 0 6px;
	}

	.named ul {
		margin: 0 0 6px;
		padding-left: 18px;
	}

	.settings-hidden {
		grid-template-columns: 33px minmax(0, 1fr) 330px;
	}

	.settings-hidden .settings {
		display: none;
	}

	.settings {
		grid-area: settings;
		overflow-y: auto;
		border-right: 1px solid var(--line);
		padding: 34px 16px 14px;
	}

	.workspace.no-panel {
		grid-template-columns: 0 minmax(0, 1fr) 330px;
	}

	.no-panel .settings {
		display: none;
	}

	.diagram {
		grid-area: diagram;
		display: flex;
		flex-direction: column;
		min-height: 0;
		min-width: 0;
	}

	.canvas {
		flex: 1;
		min-height: 0;
	}

	.detail {
		grid-area: detail;
		overflow-y: auto;
		border-left: 1px solid var(--line);
		padding: 14px 16px;
	}

	/* Staying where it is while what is under it scrolls, so it is never a scroll away. */
	.stepping {
		position: sticky;
		top: -14px;
		z-index: 1;
		margin: -14px 0 12px;
		padding: 14px 0 10px;
		border-bottom: 1px solid var(--line);
		background: var(--bg);
	}

	footer {
		grid-area: controls;
		display: flex;
		align-items: center;
		gap: 12px;
		border-top: 1px solid var(--line);
		padding: 8px 16px;
	}

	/* Same width either way, so that what is beside it does not move when it changes. */
	.play {
		flex: none;
		min-width: 3.6em;
	}

	/* Over the step detail, so the diagram stays put. An RFC's lines need a little more room. */
	.source {
		grid-row: 2 / 4;
		grid-column: 2 / 4;
		justify-self: end;
		z-index: 2;
		width: 340px;
		overflow-y: auto;
		background: var(--bg);
		border-left: 1px solid var(--line);
		box-shadow: -8px 0 24px rgb(0 0 0 / 0.12);
	}

	.source.wide {
		width: min(570px, 100%);
	}

	.raw-large {
		--raw-size: 16px;
		width: min(920px, 100%);
		padding: 14px 18px;
	}

	.raw-large header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
		position: static;
		padding: 0;
		border: 0;
	}

	.raw-large h2 {
		margin: 0;
	}

	/* The diagram and how to move through it, because that is what a room is looking at. */
	.workspace.whole {
		grid-template:
			'header' auto
			'diagram' minmax(0, 1fr)
			'controls' auto
			/ minmax(0, 1fr);
	}

	.workspace.whole :global(.seen-note),
	.workspace.whole .settings,
	.workspace.whole .detail,
	.workspace.whole .settings-toggle {
		display: none;
	}

	/* Too narrow for the settings beside the diagram at a readable size, so they open over it. */
	@media (max-width: 1239px) {
		.workspace,
		.settings-hidden {
			grid-template-columns: 33px minmax(0, 1fr) 330px;
		}

		.settings,
		.settings-hidden .settings {
			display: none;
		}

		.settings-open .settings {
			display: block;
			grid-area: 2 / 2 / 4 / 3;
			z-index: 2;
			justify-self: start;
			width: 260px;
			padding-top: 14px;
			background: var(--bg);
			box-shadow: 8px 0 24px rgb(0 0 0 / 0.12);
		}
	}

	/* Too narrow for the step beside it as well, so it goes underneath. */
	@media (max-width: 1023px) {
		.workspace,
		.settings-hidden {
			grid-template:
				'header header' auto
				'settings diagram' minmax(0, 1fr)
				'settings detail' minmax(96px, 30%)
				'settings controls' auto
				/ 33px minmax(0, 1fr);
		}

		.workspace.no-panel:not(.whole) {
			grid-template-columns: 0 minmax(0, 1fr);
		}

		.detail {
			border-top: 1px solid var(--line);
			border-left: 0;
		}

		.settings-open .settings {
			grid-area: diagram;
		}

		.source {
			grid-row: 2 / 5;
			grid-column: 1 / -1;
		}
	}

	/* Not much height: the rows need it more than these do. */
	@media (max-height: 560px) {
		.legend {
			display: none;
		}

		header {
			padding-block: 4px;
		}

		footer {
			padding-block: 4px;
		}

		.workspace,
		.settings-hidden {
			grid-template-rows: auto minmax(0, 1fr) minmax(72px, 22%) auto;
		}
	}

	/* A phone: the diagram as a strip with the words beside it, the step under it, and Back and Next where
	   a thumb is (#15, ADR-008). The page itself does not scroll, only the step under the diagram does,
	   because a bar fixed over a page that scrolls can end up behind a phone's toolbar when a step is
	   shorter than the last one. */
	@media (max-width: 767px) {
		.workspace {
			position: relative;
			display: flex;
			flex-direction: column;
			height: 100dvh;
			overflow: hidden;
		}

		header {
			flex-wrap: wrap;
			padding-right: 140px;
		}

		/* Shorter rather than on a line of its own, which would take the height from the diagram. */
		h1 {
			flex: 1 1 0;
		}

		.name,
		.status {
			display: none;
		}

		/* A button in the corner, and the settings over everything else while they are open. */
		.settings-toggle,
		.settings-toggle.rail {
			position: absolute;
			top: 8px;
			right: 12px;
			z-index: 5;
			flex-direction: row;
			align-items: center;
			margin: 0;
			padding: 7px 10px;
			border: 1px solid var(--line);
			border-radius: 6px;
		}

		.settings-toggle.rail span {
			align-self: auto;
			writing-mode: horizontal-tb;
		}

		.settings,
		.settings-hidden .settings {
			display: none;
		}

		.settings-open .settings {
			display: block;
			position: fixed;
			inset: 0;
			z-index: 4;
			width: auto;
			padding: 56px 16px 24px;
			overflow-y: auto;
			border: 0;
			box-shadow: none;
			background: var(--bg);
		}

		/* The controls that were above it are in the sheet, so less height still draws more of it. */
		.diagram {
			flex: 0 0 auto;
			height: 46dvh;
			min-height: 260px;
		}

		/* A finger reaching the end of the step should not move the whole screen. */
		:global(html),
		:global(body) {
			overscroll-behavior: none;
		}

		.shown {
			display: grid;
			gap: 10px;
			margin: 0 0 18px;
			padding: 0 0 14px;
			border-bottom: 1px solid var(--line);
		}

		.shown .recorded {
			margin: 0;
		}

		.shown > button {
			justify-self: start;
		}

		.above {
			flex-wrap: wrap;
			gap: 4px 12px;
			padding: 0 12px;
		}

		.detail {
			display: flex;
			flex: 1 1 auto;
			flex-direction: column;
			min-height: 0;
			overflow-y: auto;
			overscroll-behavior: contain;
			padding-bottom: 0;
			border-top: 1px solid var(--line);
			border-left: 0;
		}

		/* Last in the panel and held at its bottom, under however much or little the step says. */
		.stepping {
			order: 99;
			position: sticky;
			top: auto;
			bottom: 0;
			margin: auto -16px 0;
			padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
			border-top: 1px solid var(--line);
			border-bottom: 0;
		}

		/* Watching it play is for a room, and the parts are in the strip's numbers. */
		footer {
			display: none;
		}

		.source,
		.source.wide {
			position: fixed;
			inset: 0;
			width: 100%;
		}
	}

	/* The diagram and its words, as much paper as that takes. */
	@media print {
		.workspace {
			display: block;
			height: auto;
		}

		/* Someone who opened the list will hand that to their team, and not the diagram. */
		.workspace:has(.source[data-list-open]) > :not(.source) {
			display: none;
		}

		.source[data-list-open] {
			display: block;
			position: static;
			width: auto;
			box-shadow: none;
		}

		.settings,
		.settings-toggle,
		footer,
		.stepping,
		.source:not([data-list-open]) {
			display: none;
		}

		.detail {
			border: 0;
			overflow: visible;
		}

		.diagram {
			display: block;
		}
	}
</style>
