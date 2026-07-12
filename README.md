# 🌿 Overgrowth

**Feed it a GitHub username. It grows a living tree out of years of commits, languages, stars and abandoned side projects.**

A contribution heatmap shows your work as flat colored squares. Overgrowth takes the same invisible history and grows it into something that looks *alive* — a generative tree that is a portrait of how you build. Same username always grows the same tree. No two people's are alike.

Built for the [DEV Weekend Challenge: Passion Edition](https://dev.to/t/weekendchallenge) — because this is literally *the love that fuels late-night side projects*, rendered.

## How behavior becomes biology

| Your GitHub history | Your tree |
| --- | --- |
| Years on GitHub + repos built | Height and branching depth |
| Push activity | Trunk thickness and growth speed |
| Language diversity | Branching, canopy spread and leaf colors (real linguist colors) |
| Stars earned | Glowing blossoms |
| Late-night pushes | The tree leans and grows crooked, reaching |
| Abandoned repos (18+ months dormant) | Bare grey branches — the honest scars |
| Recency of activity | Leaf color, vivid → brown |

Deterministic seeded RNG (mulberry32 keyed off the username) drives a recursive branch system, so a tree is *yours* — regrow it any time, it's the same tree, until your history changes it.

## Try it

**Live: https://overgrowth-one.vercel.app** (full experience: tree + Gemini poem + ElevenLabs voice)

Static mirror (tree + written reading only): https://ayushbharadva.github.io/overgrowth/

Type a username. Watch it grow. Paste your friend's username and meet a completely different creature. Try `torvalds` (a moonlit monolingual C giant with 250k-star blossoms and bare scars) next to a polyglot like `sindresorhus` (a dense multicolored canopy).

## The tree speaks

Every tree gets a **reading** — a one-line caption composed deterministically from its stats. With the full stack deployed, that upgrades: **Gemini** writes a 3-line poem in the voice of the tree, addressed to its owner, and **ElevenLabs** reads it aloud ("🔊 hear your tree"). Both degrade gracefully — without the backend you still get the tree and its written reading.

## Tech

- **Next.js + TypeScript**, single page — the tree itself is fully client-side; two optional serverless routes (`/api/poem`, `/api/voice`) power the AI reading, keys never touch the browser
- **Canvas 2D** with `requestAnimationFrame` — depth-staggered growth animation, then a perpetual idle sway, twinkling stars and fireflies
- **GitHub public REST API**, unauthenticated, fetched from the browser: `/users/{u}`, `/users/{u}/repos`, `/users/{u}/events/public`
- Save your tree as a PNG, share it with a `?u=` link

### Honest limitations

- The true green-square streak graph needs an authenticated GraphQL token, so Overgrowth reads languages, repos, stars, dormancy and push-hour rhythms instead — which turn out to be plenty.
- GitHub's unauthenticated rate limit is ~60 requests/hour per IP (3 requests per tree). If the forest gets crowded, it says so gracefully.
- Push times come from public event timestamps rendered in *your* timezone — close enough to catch a night owl.

## Run locally

```bash
npm install
npm run dev
```

Optional, for the AI reading + voice:

```bash
GEMINI_API_KEY=…        # Google AI Studio (free tier)
ELEVENLABS_API_KEY=…    # ElevenLabs (free tier)
```

Deploys: Vercel for the full app; `scripts/deploy-pages.sh` publishes the static tree-only mirror to GitHub Pages.

## Challenge eligibility

Everything here was built within the challenge window (July 12, 2026 IST — see commit timestamps). Any commits after the July 13, 6:59 AM UTC deadline are polish noted here, not submission content. AI-assisted (Claude Code), as permitted by the challenge rules.
