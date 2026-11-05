// On their own, so that a script run with plain Node can read them without Vite's import.meta.env.
export { SITE_NAME, SITE_URL } from '#lib/site-url.ts';
import { SITE_NAME, SITE_URL } from '#lib/site-url.ts';

/** Whether search engines may index this build. Only production can say so, and only on request. */
export const INDEXABLE = import.meta.env.VITE_INDEXABLE === 'true';

interface Sharing {
	title: string;
	description: string;
	/** The path on the site, starting with a slash. */
	path: string;
	/** The name of a file in static/social. */
	image?: string;
}

/** What a shared link shows, as the attributes of each meta tag. */
export function sharingTags({ title, description, path, image = 'home' }: Sharing) {
	const imageUrl = `${SITE_URL}/social/${image}.png`;
	return [
		{ property: 'og:type', content: 'website' },
		{ property: 'og:site_name', content: SITE_NAME },
		{ property: 'og:title', content: title },
		{ property: 'og:description', content: description },
		{ property: 'og:url', content: `${SITE_URL}${path}` },
		{ property: 'og:image', content: imageUrl },
		{ property: 'og:image:width', content: '1200' },
		{ property: 'og:image:height', content: '630' },
		{ name: 'twitter:card', content: 'summary_large_image' }
	];
}
