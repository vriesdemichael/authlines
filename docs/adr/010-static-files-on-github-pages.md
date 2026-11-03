# ADR-010: The site is static files on GitHub Pages, with all state in the browser

Search engines may index production, because the maintainer let them in on 2026-11-03: the repository variable `ALLOW_INDEXING` is `true`, and setting it to anything else keeps them out again from the next deploy. Previews and Storybook never are. The address the site lives at for shared links is one constant, in `src/lib/site.ts`.

The application builds to plain static files, and nothing about a visitor is kept anywhere but their browser. There is no backend, no rendering at request time and no accounts. It is hosted on GitHub Pages for now, and a dedicated place may come later, so nothing may depend on Pages beyond a base path set at build time.

`pnpm build` produces what gets served: the site, with its Storybook under `storybook/` and the commit in `version.txt`. Production and pull request previews both deploy to the `gh-pages` branch. A merge to `main` deploys the build CI just tested, and the job then fails unless the live site and Storybook serve that commit. Each pull request gets a preview at `/pr-preview/pr-N/`, through pr-preview-action, which removes it when the pull request closes. `pnpm preview` serves a build locally the way Pages does.

Every page asks not to be indexed for now, because the application is rough and its content mostly unchecked.

The application needs no state outside the browser, so a server would only add something to run and secure. A preview on a sub page lets a change be reviewed without the checkout, including from a phone. Publishing the Storybook with the site lets a component be reviewed the same way, from the same commit.

## Not chosen

- **Cloudflare Pages**: Its preview links are built in, but it needs another account at a stage where GitHub Pages is easier.
- **`actions/deploy-pages`**: Its `preview` input is marked alpha and not available to the public, so previews could not share a site with production.
- **Local previews only**: A review would need the checkout and the maintainer's machine.
- **A deploy that builds again**: What goes live would not be what the click-through tested.
- **The Storybook on a host of its own**: It needs another account, and the components could come from a different commit than the site.
