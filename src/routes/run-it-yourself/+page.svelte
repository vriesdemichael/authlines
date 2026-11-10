<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import CopyBlock from '#lib/components/CopyBlock.svelte';
	import Mark from '#lib/components/Mark.svelte';
	import { authorizationCodeBase as base } from '#lib/flow/index.ts';
	import { parseState } from '#lib/flow/state.ts';
	import { recordedIndex } from '#lib/recordings/known.ts';
	import {
		CODE_LASTS_MINUTES,
		PASSWORD,
		PASTE_CODE,
		PASTE_TOKEN,
		READY_WHEN,
		REDIRECT_URI,
		runYourself,
		USERNAME
	} from '#lib/recordings/run-yourself.ts';
	import { sharingTags, SITE_NAME } from '#lib/site.ts';

	// The query string does not exist while prerendering, so the first render is the plain case.
	let mounted = $state(false);
	onMount(() => (mounted = true));
	const search = $derived(mounted ? page.url.search : '');
	const settings = $derived(parseState(base, 'flow', search).settings);
	const commands = $derived(runYourself(settings, recordedIndex.keycloak));
	const backHref = $derived(`${resolve('/[flow]/[[view]]', { flow: base.id })}${search}`);

	const title = 'Run it yourself';
	const description = `The same server the recordings came from, on your own machine. Keycloak ${recordedIndex.keycloak}, with throwaway values.`;
</script>

<svelte:head>
	<title>{title}: {SITE_NAME}</title>
	<meta name="description" content={description} />
	{#each sharingTags( { title, description, path: '/run-it-yourself/' } ) as tag (tag.property ?? tag.name)}
		<meta {...tag} />
	{/each}
</svelte:head>

<main data-ready={mounted} data-testid="run-it-yourself">
	<p class="brand">
		<a href={resolve('/')}><Mark /> {SITE_NAME}</a>
		/
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved above -->
		<a href={backHref} data-testid="back-to-diagram">Back to the diagram</a>
	</p>
	<h1>{title}</h1>
	<p>
		This is the server the recordings came from, Keycloak {recordedIndex.keycloak}, with the same
		names. You need Docker, a browser and a terminal, and a few minutes once Docker has fetched the
		image. A real login, a real code in your own address bar, and real tokens.
	</p>
	<p class="warning" data-testid="throwaway">
		Everything here is a throwaway value for a server on your own machine. Never paste real secrets
		into these commands, and do not run this anywhere other people can reach it.
	</p>

	<p data-testid="fits-settings">
		These fit the settings you came from:
		{settings.clientType === 'public'
			? 'an app with no secret'
			: 'an app with a secret'}{settings.pkce ? ', PKCE' : ''}{settings.oidc
			? ', OpenID Connect'
			: ''}{settings.consent ? ', asking the user to agree' : ''}. Other settings are not part of
		this walk.
	</p>

	<h2>1. Start the server</h2>
	<p>
		In an empty folder. It stays running in that terminal, and it is ready when it says
		<code>{READY_WHEN}</code>. Inside the container, that is. It only takes connections from your
		own machine.
	</p>
	<CopyBlock text={commands.start} label="the commands that start the server" />
	<p class="aside" data-testid="on-windows">
		On Windows, use WSL or Git Bash. In Git Bash, put <code>MSYS_NO_PATHCONV=1</code> in front of
		<code>docker run</code>, or it rewrites the path to the file.
	</p>

	<h2>2. Log in, in your browser</h2>
	<p>
		Open this address, and log in as <code>{USERNAME}</code> with the password
		<code>{PASSWORD}</code>.{#if settings.consent}
			Then agree to what the app is asking for.{/if}
	</p>
	<CopyBlock text={commands.login} label="the address to log in at" />
	<p>
		You end up at an error page, because nothing is listening at <code>{REDIRECT_URI}</code>. That
		is fine, and it is the point: <strong>look at your address bar.</strong> The code is right
		there, which is what passing through the browser means. Copy what comes after
		<code>code=</code>, which is the last thing in the address.
	</p>

	<h2>3. Trade the code for tokens</h2>
	<p>
		Put the code in place of <code>{PASTE_CODE}</code> and run this in another terminal. A code
		works once, and lasts {CODE_LASTS_MINUTES} minutes on this server, where a default one gives it one.
		So if this says <code>invalid_grant</code>, open the address from step 2 again for a new one. It
		will not ask for the password this time, because your browser still has its session.
	</p>
	<CopyBlock text={commands.trade} label="the command that trades the code" />
	<p>
		The answer has your access token. It has the same parts as the recorded one on the diagram, with
		your own values.
	</p>

	{#if commands.who}
		<h2>4. Ask who logged in</h2>
		<p>Put the access token in place of <code>{PASTE_TOKEN}</code>, and it says who you are.</p>
		<CopyBlock text={commands.who} label="the command that asks who logged in" />
	{/if}

	<h2>When you are done</h2>
	<p>
		This stops the server and removes everything it knew, from any terminal. Docker keeps the image
		until you remove it, and your browser keeps the address with the code in its history, by then
		worth nothing. You can delete the folder.
	</p>
	<CopyBlock text={commands.stop} label="the command that stops the server" />
	<p class="checked">
		A scheduled job runs these commands against this version of the server, on Linux, for every
		combination of the settings above, so if they stop working, it fails. The advice for Windows is
		not part of that.
	</p>
</main>

<style>
	main {
		max-width: 720px;
		margin: 24px auto;
		padding: 0 24px 40px;
	}

	.brand {
		color: var(--muted);
		font-size: var(--size-ui);
	}

	h1 {
		margin: 12px 0;
		font-size: var(--size-headline);
	}

	h2 {
		margin: 22px 0 6px;
		font-size: var(--size-body);
	}

	p {
		margin: 0 0 8px;
		line-height: 1.5;
	}

	.warning {
		padding: 10px 12px;
		border-radius: var(--radius);
		background: var(--panel);
		font-weight: 600;
	}

	.checked,
	.aside {
		color: var(--muted);
		font-size: var(--size-ui);
	}

	code {
		font-family: var(--mono);
		font-size: 0.92em;
	}
</style>
