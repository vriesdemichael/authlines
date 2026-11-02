/**
 * What the first screen says, for someone who knows none of the words (#150). It names one company's
 * button as something familiar and claims nothing about how that button works, and "OAuth" only comes
 * once someone has seen what it is for.
 */
export const wayIn = {
	lead: 'You have probably clicked a button like “Log in with Google”. Here is what that kind of button saved you from, and how it works, one message at a time.',
	/** The question on the map that shows the old way, which is what the screen opens with. */
	node: 'the-old-way',
	/** All of it can be read from here, and the API has the password too. */
	step: 'old-way-answer',
	/** And what it turns into, at the message where the password goes somewhere else. */
	flipsTo: { node: 'how-access-works', step: 'submit-credentials' },
	switch: 'Log in where your account is',
	off: {
		title: 'The old way: the app asks for your password',
		says: 'It keeps your password and sends it with every call. So it can do anything you can, and if it leaks, so does your password.'
	},
	on: {
		title: 'Now your password stays where your account is',
		says: 'It goes there and nowhere else. The app gets something else instead: a token that allows only what you agreed to, and can be taken back. Many buttons like “Log in with ...” are built on this, and it is called OAuth.',
		link: 'Follow it, one message at a time'
	}
} as const;
