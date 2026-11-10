# ADR-014: A colour means one thing, and what is ahead is faint

Colours come from the tokens in `src/app.css`, and each means one thing everywhere: how a message travels, what it carries, or who has no business here. Every hue on screen is about the protocol. There are few of them, because one thing should stand out at a time, and the test holds the list. The two ways a message travels are told apart by hue alone, so they have the same lightness and strength: warm for what goes through the user's browser and cool for what goes direct, on the blue and yellow axis that red and green colour blindness leaves. What it carries is three quiet groups, what proves something, what gets something and what remembers, because the chip already says which it is. What a setting just changed is a soft band that goes again, with no hue of its own. Text meets WCAG AA on what it sits on, in both themes, and `src/theme.test.ts` holds it to that. A new pair of text and background goes in that test. What each thing that gets passed around looks like is there too, one rule for each, so a new one touches no component. Two forms of one thing, such as a verifier and its challenge, share a colour.

Where you are is in ink and weight, and never in a hue: the current step, Next, the diagram and mode on screen, a switch that is on, and a link (#231). The test holds where you are to the colour of the text.

Only the current step stands out: its arrow is heavier and its number is filled in, on a grey band. What has happened stays readable and quiet, on the timeline under the diagram too, and the parties the current step is between take the band's grey and not ink.

What is passed around has a shape of its own wherever it is shown: filled in its group's colour, with no outline, and its corners cut, so it is never taken for a button, a link, or a tag in any dashboard (#231). `src/lib/diagram/shape.ts` draws it on the diagram, and the `token` class anywhere else, with the same cut.

Motion is for what changed, and nothing else moves. Next and Execute send a message, so one small marker travels its arrow in 350 ms, and its words, its chips and what it adds under a lifeline show when it gets there. The marker is hollow when nothing in it is a token or a secret, as with a refusal, and then nothing lands. Back and a jump show a step without moving anything. A setting moves the diagram in stages that keep anything from crossing anything: what leaves goes, the rows move with new arrows and lifelines coming into the room they make, and then new words and chips arrive. Words that change go with what leaves and come with what arrives. With reduced motion nothing moves, and all of it is simply there.

Seen as one party, every message still says what happens, and where that party was not part of it the arrow is nearly gone. What it was never sent is a muted bar as wide as the chip was, and the value is not on the page. A bar has no hue of its own, because it says only that something was there.

Pointing at something moves nothing on the diagram. A setting the mouse rested on used to show what it would do, and a question on the map used to move the diagram beside it. On 2026-11-03 the maintainer, who had watched people use it, turned both off, because the diagram changing under the mouse made the steps hard to follow. A click, a key or a switch changes what is drawn, and a row under the mouse only gets the band that says it can be clicked.

Following one thing lights up its path and quiets the rest, with no hue of its own either. What it carries ahead shows, because someone asked for exactly that, like a setting's change, the only other place where what is ahead carries anything.

A step shows what has happened in full, and what is to come as an outline. Every message has a number and a label. Up to the current step it has its chips too. Ahead it is a faint arrow with its number and its label, and what it carries shows when it gets there, or when a setting has just changed it. Labels were left off ahead at first, and the maintainer found a numbered line with nothing on it mysterious, more so seen as one party. A label ahead is in the same quiet colour as one that has happened, so text is readable or absent, never faded. The faint arrow is below the 3:1 WCAG 1.4.11 asks of what someone needs, on purpose: it is an outline and not a thing to read, its number and label are AA, and a stronger one would compete with the current step, which the maintainer has asked to stand out alone.

A message says how it travels: through the browser, direct, or between people. Credentials and tokens are chips on the message, on the line of its label, and that label wraps rather than overrun its arrow. A test holds that in every combination. Under each lifeline are chips for what it has seen so far, which `holdingsAt` works out from the fields on the steps and is never written by hand, so it cannot disagree with the flow. The heads keep room for the most they will hold at any step, so stepping never moves a row.

Limited context per step is the quality the maintainer asked to keep, and the numbers let someone presenting say which step they mean. What crosses the browser and what does not is the security idea of a redirect flow, and who has seen what is the question behind "why a code and then a token". Both were only in the text before, and a colour that meant two things would teach nothing.

The whole flow at once, which someone asks for to see all of the shape, is the same, with more room.

## Not chosen

- **Draw only the messages so far, as IdentiFlows does**: A setting that changes something ahead would change nothing on screen, and that change is what this application exists to show.
- **Only a numbered arrow ahead, with a switch for the words**: What was built first. It made people wonder what was coming, and the switch was one more control to find.
- **A preview of a setting, or of a question, under the mouse**: Built and taken out. The diagram moving whenever the mouse crossed something made the current step hard to keep hold of.
- **A refusal that stops short of the lifeline**: It would draw a 400 as not arriving, and it does arrive. What it does is leave nothing behind, which the hollow marker and the unchanged chips show.
- **A marker on every step, in either direction**: Something moving on Back says a message is being sent when nothing is.
- **Faded labels for what is ahead**: They fail contrast, and they are noise at the step someone is trying to read.
- **A picture of what each lifeline has seen, written per step**: It would drift from the flow, and adding a setting would mean rewriting it.
- **An accent colour for where you are**: What was built first, an indigo on everything that could be chosen. It is the colour people recognise from generated sites, it was one more hue that said nothing about the protocol, and the current step already had a heavier arrow and a filled number (#231).
- **Amber and teal for the channels**: Tailwind's amber-700 and teal-700 exactly, which looked taken and not chosen. Brown and green were tried in their place, and red and green colour blindness makes those one colour.
- **Pills for what is passed around**: They looked like any tag in any dashboard, and like the buttons beside them.
