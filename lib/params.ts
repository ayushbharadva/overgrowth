// TreeParams: everything the generative tree needs to grow.
// Produced either from fake defaults (dev) or real GitHub signals.

export interface TreeParams {
  seed: string; // username — drives the deterministic RNG
  maxDepth: number; // 5..9 — account age + repo count
  trunkWidth: number; // 10..26 px — commit/push activity
  growthSpeed: number; // 0.6..1.6 — activity multiplier for the grow animation
  branchiness: number; // 0..1 — probability of extra child branches (language diversity)
  angleSpread: number; // 0.35..0.85 rad — how wide branches fan out (language diversity)
  lean: number; // -0.35..0.35 rad — night-owl hours bend the whole tree
  crookedness: number; // 0..1 — per-branch wobble (night-owl too)
  blossomCount: number; // 0..40 — stars, log scale
  deadFraction: number; // 0..0.45 — abandoned repos become bare grey branches
  freshness: number; // 0..1 — recency of activity; leaf color green->brown
  palette: string[]; // language hex colors, dominant first
  stats: TreeStats;
}

export interface TreeStats {
  username: string;
  displayName: string | null;
  years: number;
  repoCount: number;
  stars: number;
  languages: string[]; // sorted by prevalence
  nightOwl: boolean; // majority of pushes between 10pm-5am local-ish
  dormantRepos: number;
  recentPushes: number; // pushes seen in recent public events
  followers: number;
}

export const DEFAULT_PALETTE = ["#3178c6", "#f1e05a", "#e34c26", "#563d7c", "#41b883"];

// A pleasant middle-of-the-road tree for building/tuning the visuals
// before real data is wired in.
export function fakeParams(seed: string): TreeParams {
  return {
    seed,
    maxDepth: 8,
    trunkWidth: 18,
    growthSpeed: 1,
    branchiness: 0.55,
    angleSpread: 0.6,
    lean: 0.12,
    crookedness: 0.4,
    blossomCount: 14,
    deadFraction: 0.15,
    freshness: 0.8,
    palette: DEFAULT_PALETTE,
    stats: {
      username: seed,
      displayName: null,
      years: 6,
      repoCount: 42,
      stars: 230,
      languages: ["TypeScript", "JavaScript", "Python"],
      nightOwl: true,
      dormantRepos: 7,
      recentPushes: 31,
      followers: 120,
    },
  };
}
