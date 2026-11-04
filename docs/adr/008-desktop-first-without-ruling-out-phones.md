# ADR-008: Desktop comes first, and nothing may rule out phones

The diagram is laid out for the room it has, with its text at a fixed size, instead of a fixed drawing being scaled. From 1240 pixels wide everything is side by side. Below that the settings open over the diagram when asked for, and below 1024 the step goes underneath it. A test measures the text from 853x480, which is a laptop at 150% zoom, up to 2560x1440. Spare height goes to the rows, up to a limit, and spare width stops at 1240 pixels, so a bigger window shows more of the flow and not bigger words.

Below 768 pixels, on a phone, the diagram stays, because the picture is what explains it (#15). The lanes go in a narrow strip on the left, as close as their arrows can be told apart and never more than half the width. Each message's words go beside the strip, at the size they have anywhere else, the way a list of commits sits beside its graph. The names slant above the lanes. A field too long for the room is shortened, and the step has all of it. Under a head there is no room for what that party has seen, so selecting the head says it. A switch shows the diagram at its own size instead, moved sideways to the current message, with the heads held at the top. Back and Next sit at the bottom of the screen, where a thumb is. The page itself never scrolls sideways. A test lays out every diagram under every setting in the strip at 360 pixels, and checks that every word and chip is beside the strip and inside the screen. **For the maintainer to judge, on a real phone:** this was built from the research in #15, and no person has tried it yet. The switch is not in the address yet, which ADR-003 asks for if it stays.

The application is still designed for desktop first. Nothing may make a phone impossible: keep settings and step detail separable from the diagram, keep every state reachable by URL so a phone can open it, and render lifelines from data so a smaller screen can lay them out its own way.

## Not chosen

- **Phone first**: It would decide what gets cut before it is clear what the application is.
- **Shrink the desktop layout to fit**: A wide diagram is unusable at that size.
- **The steps without the diagram**: What a phone showed at first. The maintainer found it "not very helpful. You need the visuals to guide you."
- **The desktop picture, panned, as what a phone shows**: It keeps the picture readable, but shows only two or three lanes at a time, and it moves sideways on Next. It is the switch instead.
- **Only the two lanes of the current message, wide**: The layout would change on every step.
- **Asking people to turn the phone sideways**: Research on tables on phones calls that a last resort.
