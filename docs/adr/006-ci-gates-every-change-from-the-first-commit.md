# ADR-006: CI gates every change from the first code commit

From the first code commit, a pull request can merge only when the formatting and lint checks, the type checks, the unit tests, the Storybook build and an automated click-through pass. Branch protection on `main` enforces this, for the maintainer too, and a merge goes live only after the same checks pass on it. `pnpm verify` runs the same checks locally. The click-through runs against the real static build, served the way GitHub Pages serves it. It walks every step, flips the settings, switches mode once there are modes, uses the keyboard, opens a fixed list of URLs that must keep showing the same state, and renders every story in the Storybook inside that build.

CI also compares screenshots of key states in both themes, and checks each screen with an automated accessibility tool. It runs in one Linux image, because fonts render differently elsewhere, so the screenshot tests skip anywhere else. After a deliberate change to the look, `pnpm test:visual:update` regenerates the baselines in that image, and the new images get read before they are committed.

The click-through runs on Chromium, Firefox and WebKit in CI, in jobs of their own, because most tests run in all three and there are more with each setting. Chromium is split over two jobs, and Firefox and WebKit over three each because they are slower, so that they finish at about the same time, since every merge waits for the slowest. A job called `CI Complete` comes after them and is the one check branch protection requires. It says no unless they all passed, and it always runs, because GitHub counts a skipped check as passed. Working locally it runs on Chromium, and `pnpm test:browsers` runs all three in CI's image. Screenshots, stories and opening every valid combination are Chromium only, because a screenshot is only valid in one browser, a story only needs rendering once, and the view draws whatever the model returns. Setup opens one page for each different diagram, worked out from the model, because most settings do not change it.

Re-recording Keycloak traffic runs on demand and weekly, not on every pull request.

Passing says little if the tests cannot fail, and a review once broke the code in 68 ways and 24 went unnoticed. So `pnpm test:breakages` makes a list of mistakes in `scripts/breakages.mjs`, one at a time, and checks that a unit test notices each. It runs weekly and on demand, in three parts side by side because one run of all of them outlasts a job's time limit, and opens an issue when one goes unnoticed or a run does not finish. A unit test holds the list to the code, so an entry gone stale fails on the pull request that did it. A test added to catch a mistake adds that mistake to the list. Unit tests also run before every push, because a commit chained after a test command has pushed failing tests more than once. The click-through retries a failed test once in CI, because a browser can stumble for no reason, and the job summary names any test that only passed the second time, so a flaky test stays visible. It never reuses a server that is already running, so it cannot test an old build by mistake.

An automated click-through is why this repository exists. States multiply with every setting, and nobody can check them by hand.

## Not chosen

- **Every combination in every browser**: It was about 400 seconds of each run. Only one line of the components reads a named setting, the recordings and questions walked in all three browsers already show nearly everything they could, and no real bug was ever found this way.
- **One job for all three browsers, with a longer time limit**: It reached its 30 minutes on a day with no slow test in it, and a merge that goes live has to wait for it too.
- **Add CI once the application has settled**: Each setting added before then is one more state nothing has ever checked.
- **Re-record on every pull request**: A change to the view would fail for reasons that come from booting Keycloak.
- **Visual regression from the very first commit**: While the prototype's look was still moving, every change would have failed it.
- **Screenshots on each contributor's machine**: Baselines would differ per system, and a failure would say nothing about the change.
- **A mutation testing tool such as Stryker**: It finds what nobody thought of, but most of what went unnoticed here was words in data, which it does not change. It can still be tried on `src/lib/flow`.
- **Breakages on every pull request**: Each one runs the tests again.
