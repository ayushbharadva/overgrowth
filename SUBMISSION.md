# DEV post draft — paste into dev.to, tag `#weekendchallenge`

> Before posting: add a cover image (use a saved PNG of your own tree), a short demo GIF, and screenshots of 2–3 contrasting trees.

---

**Title:** Every commit you've ever pushed was feeding a tree. I built the thing that lets you meet it.

**Tags:** #weekendchallenge #showdev #javascript #creativecoding

---

## What I built

**Overgrowth** grows a living, breathing generative tree out of a GitHub username — a portrait of how that person builds, drawn from every repo, language, star and late-night push.

Type a name. Watch a few seconds of growth. Meet the tree you've been feeding for years without knowing it.

👉 **Try yours: https://ayushbharadva.github.io/overgrowth/**

*(cover image / demo GIF here)*

## The inspiration

The challenge said *passion* — and offered rivalry, fandom, the World Cup. But the line that got me was **"the love that fuels late-night side projects."**

That love already has a data trail. It's just rendered as the least romantic thing imaginable: a grid of flat green squares.

Years of building. Languages you fell for. The project you pushed to at 2 AM for a month straight. The repos you loved, then quietly abandoned. All of it flattened into a heatmap.

So I made the same history grow something that looks *alive* instead. The emotional distance between "a chart of my commits" and "a tree that my commits have visibly been feeding" — that distance is the entire project.

## How behavior becomes biology

The tree isn't a skin on a chart. Builder behavior maps onto growth rules:

- **Years on GitHub + repos** → height and branching depth
- **Push activity** → trunk thickness and how fast it grows
- **Language diversity** → branching and canopy color, using GitHub's real linguist colors — a monolingual C veteran grows a moonlit silver tree; a JavaScript polyglot grows a riot of yellow and blue
- **Stars** → glowing blossoms
- **Late-night pushes** → the tree leans and grows crooked, reaching for something
- **Abandoned repos** → bare grey leafless branches. The honest scars. Every builder has them; the tree doesn't hide them.
- **Recent activity** → leaf color, vivid to brown

And it's **deterministic** — a seeded RNG keyed off the username means your tree is *yours*. Regrow it tomorrow, it's the same tree. Push for another year and it will have changed, because you did.

Two trees I met this weekend:

*(screenshot: torvalds — monolingual silver-grey giant, 250k-star blossoms, one huge bare dead limb)*

*(screenshot: a polyglot — dense multicolored canopy)*

## How it works

- **Next.js + TypeScript + Canvas 2D**, fully client-side. No backend, no database, no tokens, no keys. $0 to run.
- Three unauthenticated GitHub REST calls from the browser (`/users`, `/repos`, `/events/public`) get distilled into growth parameters.
- A recursive branch system with a few things I had to learn the hard way:
  - **Negative gravitropism** — early trees curled into drooping ferns. Real branches spring back toward the sky, so mine track their cumulative angle from vertical and correct toward it.
  - **Depth-damped lean** — a night owl's lean compounded over nine branching levels turns a tree into a spiral. Damping it with depth makes the tree *bend*, like it should.
  - **Leaf-lightness floor** — C's linguist color is `#555555`. Without a minimum-lightness lift, Linus Torvalds' tree looked dead. Now it looks like a birch in moonlight, which felt right.
  - **Blossoms drawn in a second pass** — 700k stars were getting buried under the leaves they earned.
- Growth animates depth-by-depth with `requestAnimationFrame`, then settles into an idle sway with twinkling stars and fireflies. 60 fps even on the biggest trees I could find.
- Save your tree as a PNG, or share it with a `?u=` link.

## The honest part

Without an auth token you can't get the true contribution graph — so Overgrowth reads languages, stars, dormancy and push-hour rhythms instead. And the unauthenticated rate limit is 60 requests/hour per IP; if the forest gets crowded, it tells you kindly.

Code: **https://github.com/ayushbharadva/overgrowth** — built within the challenge window, AI-assisted (Claude Code), as the rules allow.

## Try these

- Your own username, obviously. That's the whole point.
- Your friend's — completely different creature.
- `torvalds` next to `sindresorhus`. Same API, opposite souls.

Every builder has been growing one of these for years. Come meet yours. 🌿
