import type { Settings } from '#lib/flow/settings.ts';

/** One half of an HTTP exchange, because a request and its response are separate steps on the diagram. */
export interface RecordedMessage {
	/** Null for a hop the diagram does not show, such as a redirect inside Keycloak. */
	step: string | null;
	direction: 'request' | 'response';
	/** Not HTTP: the other side's own log, word for word, and all that is shown of this message. */
	log?: readonly string[];
	/** Not HTTP: a Kerberos message, read from the wire by its spec (RFC 4120), and named by method. */
	protocol?: 'kerberos';
	/** A Kerberos message as it crossed, in base64, so that a test can read the body from it again. */
	bytes?: string;
	method?: string;
	url?: string;
	status?: number;
	headers: Record<string, string>;
	body?: unknown;
	/** What was left out, such as a whole HTML page. */
	bodyNote?: string;
}

/** One real run, so the code returned in one step is the code sent in the next (ADR-005). */
export interface Recording {
	preset: string;
	keycloak: string;
	recordedAt: string;
	settings: Settings;
	messages: RecordedMessage[];
}

/** What a real server says about one of its feature flags, on its defaults. */
export interface FlagStatus {
	type: string;
	enabled: boolean;
}

/** The small part the application needs up front. The recordings themselves load when asked for. */
export interface RecordingIndex {
	keycloak: string;
	recordedAt: string;
	/** Those made on another day than the rest, which are their own dates. */
	recordedOn?: Record<string, string>;
	/** What was recorded of each base flow, so one cannot claim what only another did. */
	flows: Record<string, { presets: string[]; steps: string[] }>;
	flags: Record<string, FlagStatus>;
}
