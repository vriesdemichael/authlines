/**
 * What the first screen says, for someone who knows none of the words (#150). It names one company's
 * button as something familiar and claims nothing about how that button works, and "OAuth" only comes
 * once someone has seen what it is for.
 */
export const wayIn = {
	lead: 'You have probably clicked a button like “Log in with Google”. A button like that can keep your password from the app. Here is why that matters, and how, one message at a time.',
	/** The question on the map that shows the old way, which is what the screen opens with. */
	node: 'the-old-way',
	/** All of it can be read from here, and the API has the password too. */
	step: 'old-way-answer',
	/** And what it turns into, at the message where the password goes somewhere else. */
	flipsTo: { node: 'how-access-works', step: 'submit-credentials' },
	switch: 'Log in where your account is',
	off: {
		title: 'The old way: the app asks for your password',
		says: 'It keeps your password and sends it with every call. So it can do anything you can with that account, and if the app is broken into, your password goes with it.'
	},
	on: {
		title: 'Now your password stays where your account is',
		says: 'It goes to an identity provider, which holds your account, and not to the app. The app gets a token instead, which is good for certain things and runs out. This is OAuth. Many “Log in with ...” buttons are built on it, and add a way to tell the app who you are.',
		link: 'Follow it, one message at a time'
	}
} as const;
