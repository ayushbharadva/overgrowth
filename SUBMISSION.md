# DEV post — 60-second publish checklist

> Deadline: **July 13, 6:59 AM UTC (12:29 PM IST)**. Everything below is ready — just paste and upload.
>
> 1. dev.to → **Create Post**
> 2. **Title:** `Every commit you've ever pushed was feeding a tree. I built the thing that lets you meet it.`
> 3. **Tags:** `devchallenge, weekendchallenge, showdev, creativecoding`
> 4. **Cover image:** upload `press/tree-ayushbharadva-cover.png`
> 5. Paste everything below the `POST BODY` line as the body
> 6. In the Demo section, use the image-upload button to replace the two `[upload …]` markers with `press/tree-torvalds.png` and `press/tree-sindresorhus.png`
> 7. **Publish.** (Demo GIF is optional polish — skip it if short on time; the post reads fine without.)

---

<!-- POST BODY — paste from here down -->

## What I Built

**Overgrowth** grows a living, breathing generative tree out of a GitHub username — a portrait of how a person builds, drawn from every repo, language, star and late-night push.

Type a name. Watch a few seconds of growth. Meet the tree you've been feeding for years without knowing it. Then the tree does something I didn't expect to love this much: **it writes you a short poem about yourself — a little lantern-carrying wanderer walks in under the canopy to deliver it — and reads it to you out loud.**

And because passion is also rivalry: hit **⚔ vs** and grow two trees side by side — you and a friend, stat face-off between them, one shareable link.

The challenge said *passion* — rivalries, fandom, the World Cup. But the line that got me was **"the love that fuels late-night side projects."** That love already has a data trail; GitHub just renders it as the least romantic thing imaginable — a grid of flat green squares. I wanted the same history to grow something that looks *alive*. The emotional distance between "a chart of my commits" and "a tree my commits have visibly been feeding" is the entire project.

And it's honest. Your abandoned repos are right there on the tree — bare, grey, leafless. Every builder has them. The tree doesn't hide its scars, and that's what makes it a portrait instead of a decoration.

## Demo

👉 **Grow yours: https://overgrowth-one.vercel.app**

Type a username → the tree grows → a lantern-carrying wanderer delivers its poem → 🔊 hear it read aloud.

Two trees I met this weekend, same API, opposite souls:

[upload press/tree-torvalds.png]
*@torvalds — a moonlit monolingual C giant, 250k-star blossoms, bare dead limbs, leaning into the night*

[upload press/tree-sindresorhus.png]
*@sindresorhus — a polyglot's dense multicolored canopy in real linguist colors*

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

**The tree's voice.** Every tree gets a deterministic one-line reading composed from its stats. When the full stack is live, that upgrades: **Gemini** receives the tree's raw signals — years, languages, blossoms, scars, night-owl rhythm — and writes a 3-line poem *in the voice of the tree, addressed to its owner*. A tiny lantern-carrying wanderer walks in from the dark, stops under your canopy, and types it out in a speech bubble — then **ElevenLabs** reads it aloud. Hearing a calm voice say the words your abandoned repos became is genuinely a little emotional, and I built the thing.

Both run behind two small serverless routes so no keys ever touch the client — and everything degrades gracefully: no backend, and you still get the tree and its written reading.

## Prize Categories

- **Best use of Google AI** — Gemini receives each tree's raw growth signals (years, languages, blossoms, scars, night-owl rhythm) and writes a 3-line poem *in the voice of the tree, addressed to its owner*. Structured output (schema-enforced JSON, thinking disabled) keeps draft scratch-work out of the poem.
- **Best use of ElevenLabs** — the tree then reads its poem aloud while a little lantern-carrying wanderer delivers it under the canopy. Serverless route, keys never touch the client, and it degrades gracefully to the written reading.

---

Try `torvalds` next to `sindresorhus`. Then try your own username — that's the whole point. Every builder has been growing one of these for years. Come meet yours. 🌿
