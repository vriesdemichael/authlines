/**
 * What makes a result this one and no other, in the list as well as in finding them. It is here on
 * its own because the list is on every page, and everything search needs only loads on first use.
 */
export const resultKey = ({
	flow,
	kind,
	title,
	query
}: {
	flow: string;
	kind: string;
	title: string;
	query: string;
}) => `${flow}:${kind}:${title}:${query}`;
