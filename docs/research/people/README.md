# Trying it on a real person

Everything so far has been read by the maintainer and by AI agents, and agents know the words. This is the page to send to someone, or to use sitting next to them. It takes under 30 minutes, and nothing needs installing.

## Who

Five people, and colleagues are fine for a first round:

- someone new to OAuth, who is the one that matters most
- someone told to add login to an app
- someone who runs Keycloak
- someone who explains this to others
- one more

## What to do

Give them the address, https://vriesdemichael.github.io/authlines/, and these three things to do, one at a time. Say nothing else, and answer no questions until they are done. Don't explain what they see, even when they are stuck. Where they are stuck is what this is for.

1. **"Have a look around, then tell me what this is for."** Stop after a couple of minutes.
2. **"Say in your own words what happens when you click 'Log in with Google'."** For someone who knows, ask instead what OpenID Connect adds to OAuth.
3. **"You get `Invalid parameter: redirect_uri`. What does that mean, and what would you do?"**

Then ask two things: **What did you expect that was not there?** and **Would you send this to someone, and who?**

## What to write down

A sentence each, with no scoring:

- Where they stopped, or went back.
- What they said out loud, in their words.
- What they pressed that did nothing, or did something they did not expect.
- Whether what they said at the end is true. Feeling you understand is not the same as understanding ([premise section 6](../../premise.md)).

## Where it goes

One file here for each person, named by date and what they do: `2026-11-03-new-to-oauth.md`. Leave out names unless they agreed. Start it with "A person, who ..." so that nobody can mistake it for an agent's reading ([ADR-001](../../adr/001-an-agent-builds-and-the-maintainer-reviews.md)).

Five of these reorder the backlog in [issue 44](https://github.com/vriesdemichael/authlines/issues/44), whichever way they point.
