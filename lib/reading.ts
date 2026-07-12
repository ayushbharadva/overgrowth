// The tree's "reading": a deterministic one-line caption composed from the
// stats. Always available, instant, works on the static build. When the
// backend is deployed, /api/poem upgrades it to a Gemini-written poem.

import { TreeStats } from "./params";
import { rngFromString, pick, Rng } from "./rng";

function opener(rng: Rng, s: TreeStats): string {
  const lang = s.languages[0];
  const yrs = s.years >= 1 ? `${Math.round(s.years)} year${Math.round(s.years) === 1 ? "" : "s"}` : "a first year";
  if (!lang) return pick(rng, [`Grown from ${yrs} of building`, `${yrs} of quiet work, rooted`]);
  return pick(rng, [
    `Grown from ${yrs} of ${lang}`,
    `${yrs} of ${lang}, rooted deep`,
    `Fed by ${yrs} of ${lang}`,
  ]);
}

function middle(rng: Rng, s: TreeStats): string {
  if (s.nightOwl)
    return pick(rng, [
      "bent by midnight pushes",
      "grown crooked after dark",
      "leaning into the late hours",
    ]);
  if (s.languages.length >= 4)
    return pick(rng, [
      `branching ${s.languages.length} languages wide`,
      "canopy of many tongues",
    ]);
  return pick(rng, ["steady in the daylight", "growing in season", "patient rings of work"]);
}

function closer(rng: Rng, s: TreeStats): string {
  const blossoms = s.stars > 0 ? `${s.stars.toLocaleString()} star${s.stars === 1 ? "" : "s"} in blossom` : "no blossoms yet";
  if (s.dormantRepos > 0) {
    return pick(rng, [
      `${blossoms}, ${s.dormantRepos} scar${s.dormantRepos === 1 ? "" : "s"} it doesn't hide`,
      `${blossoms} — and the bare branches it keeps`,
    ]);
  }
  return pick(rng, [`${blossoms}, nothing abandoned`, `${blossoms}, every branch still alive`]);
}

export function treeReading(s: TreeStats): string {
  const rng = rngFromString(s.username.toLowerCase() + "|reading");
  return `${opener(rng, s)} — ${middle(rng, s)} — ${closer(rng, s)}.`;
}
