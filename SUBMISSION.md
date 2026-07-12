# DEV post — paste into dev.to, tag `#weekendchallenge`

> Before posting: add a cover image (a saved PNG of YOUR tree), a short demo GIF after the live link, and two contrasting screenshots where marked. Replace `{VERCEL_URL}` if the Vercel deploy URL differs.

---

**Title:** Every commit you've ever pushed was feeding a tree. I built the thing that lets you meet it.

**Tags:** #weekendchallenge #showdev #javascript #creativecoding

---

*(cover image: your own tree PNG)*

## What I Built

**Overgrowth** grows a living, breathing generative tree out of a GitHub username — a portrait of how a person builds, drawn from every repo, language, star and late-night push.

Type a name. Watch a few seconds of growth. Meet the tree you've been feeding for years without knowing it. Then the tree does something I didn't expect to love this much: **it writes you a short poem about yourself, and reads it to you out loud.**

The challenge said *passion* — rivalries, fandom, the World Cup. But the line that got me was **"the love that fuels late-night side projects."** That love already has a data trail; GitHub just renders it as the least romantic thing imaginable — a grid of flat green squares. I wanted the same history to grow something that looks *alive*. The emotional distance between "a chart of my commits" and "a tree my commits have visibly been feeding" is the entire project.

And it's honest. Your abandoned repos are right there on the tree — bare, grey, leafless. Every builder has them. The tree doesn't hide its scars, and that's what makes it a portrait instead of a decoration.

## Demo

👉 **Grow yours: {VERCEL_URL}**

*(demo GIF here: type username → tree grows → poem appears → 🔊 hear your tree)*

Two trees I met this weekend, same API, opposite souls:

*(screenshot: torvalds — a moonlit monolingual C giant, 250k-star blossoms, bare dead limbs, leaning into the night)*

*(screenshot: a polyglot — dense multicolored canopy in real linguist colors)*

My favorite reading it produced, for a tree grown from 15 years of C:

> *"Fed by 15 years of C — leaning into the late hours — 250,742 stars in blossom, 2 scars it doesn't hide."*

## Code

**https://github.com/ayushbharadva/overgrowth** — built entirely within the challenge window (see commit timestamps), AI-assisted with Claude Code, as the rules allow.

## How I Built It

**How behavior becomes biology.** The tree isn't a skin on a chart — builder behavior maps onto growth rules:

- **Years on GitHub + repos** → height and branching depth
- **Push activity** → trunk thickness and growth speed
- **Language diversity** → branching and canopy colors (GitHub's real linguist colors)
- **Stars** → glowing blossoms
- **Late-night pushes** → the tree leans and grows crooked, reaching
- **Abandoned repos (18+ months)** → bare grey branches
- **Recency** → leaf color, vivid to brown

A seeded RNG (mulberry32) keyed off the username makes it **deterministic**: your tree is yours. Regrow it tomorrow — same tree. Push for another year — it will have changed, because you did.

**The generative core** is Next.js + TypeScript + Canvas 2D. Three unauthenticated GitHub REST calls run from the browser and distill into growth parameters for a recursive branch system. Things I had to learn the hard way in one weekend:

- **Negative gravitropism** — early trees curled into drooping ferns. Real branches spring back toward the sky, so mine track their cumulative angle from vertical and correct toward it.
- **Depth-damped lean** — a night owl's lean compounded over nine branching levels turns a tree into a spiral. Damped by depth, the tree *bends* instead.
- **Leaf-lightness floor** — C's linguist color is `#555555`; without a minimum-lightness lift, Linus Torvalds' tree looked dead. Now it looks like a birch in moonlight, which felt right.
- **Blossoms in a second pass** — 250k stars were getting buried under the leaves they earned.

Growth animates depth-by-depth via `requestAnimationFrame`, then settles into idle sway with stars and fireflies — 60fps on the biggest trees I could find. Save your tree as PNG, share it with a `?u=` link.

**The tree's voice.** Every tree gets a deterministic one-line reading composed from its stats. When the full stack is live, that upgrades: **Gemini** receives the tree's raw signals — years, languages, blossoms, scars, night-owl rhythm — and writes a 3-line poem *in the voice of the tree, addressed to its owner*. Then **ElevenLabs** reads it aloud. Hearing a calm voice say the words your abandoned repos became is genuinely a little emotional, and I built the thing.

Both run behind two small serverless routes so no keys ever touch the client — and everything degrades gracefully: no backend, and you still get the tree and its written reading.

## Prize Categories

**Google AI** (Gemini writes each tree's poem from its growth signals) and **ElevenLabs** (the tree reads its poem aloud).

---

Try `torvalds` next to `sindresorhus`. Then try your own username — that's the whole point. Every builder has been growing one of these for years. Come meet yours. 🌿
