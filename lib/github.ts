// Fetches public GitHub data (no auth, no keys — CORS-friendly REST) and
// distills it into the signals that shape the tree.

import { TreeParams, TreeStats, DEFAULT_PALETTE } from "./params";
import { languageColor } from "./langColors";

export type GithubErrorKind = "notfound" | "ratelimit" | "network";

export class GithubError extends Error {
  constructor(public kind: GithubErrorKind, message: string) {
    super(message);
  }
}

interface GhUser {
  login: string;
  name: string | null;
  created_at: string;
  public_repos: number;
  followers: number;
}

interface GhRepo {
  language: string | null;
  stargazers_count: number;
  pushed_at: string | null;
  fork: boolean;
}

interface GhEvent {
  type: string;
  created_at: string;
}

const API = "https://api.github.com";

async function gh<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      headers: { Accept: "application/vnd.github+json" },
    });
  } catch {
    throw new GithubError("network", "Couldn't reach GitHub — check your connection.");
  }
  if (res.status === 404) {
    throw new GithubError("notfound", "That GitHub user doesn't exist.");
  }
  if (res.status === 403 || res.status === 429) {
    throw new GithubError(
      "ratelimit",
      "GitHub's public rate limit was hit (60 requests/hour per IP). Give it a few minutes and try again."
    );
  }
  if (!res.ok) {
    throw new GithubError("network", `GitHub returned ${res.status}.`);
  }
  return res.json() as Promise<T>;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

const DAY = 86400000;

export async function fetchTreeParams(username: string): Promise<TreeParams> {
  const user = await gh<GhUser>(`/users/${encodeURIComponent(username)}`);
  const [repos, events] = await Promise.all([
    gh<GhRepo[]>(
      `/users/${encodeURIComponent(username)}/repos?per_page=100&sort=pushed`
    ),
    // events can fail independently; the tree still grows without them
    gh<GhEvent[]>(
      `/users/${encodeURIComponent(username)}/events/public?per_page=100`
    ).catch(() => [] as GhEvent[]),
  ]);

  const now = Date.now();
  const years = Math.max((now - Date.parse(user.created_at)) / (365.25 * DAY), 0.1);
  const own = repos.filter((r) => !r.fork);

  // languages by repo count, dominant first
  const langCounts = new Map<string, number>();
  for (const r of own) {
    if (r.language) langCounts.set(r.language, (langCounts.get(r.language) ?? 0) + 1);
  }
  const languages = [...langCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([l]) => l);

  const stars = own.reduce((s, r) => s + r.stargazers_count, 0);

  // dormancy: repos untouched for 18+ months are the tree's bare branches
  const dormant = own.filter(
    (r) => r.pushed_at && now - Date.parse(r.pushed_at) > 548 * DAY
  ).length;

  // freshness: how recently anything was pushed
  const latestPush = own.reduce(
    (t, r) => (r.pushed_at ? Math.max(t, Date.parse(r.pushed_at)) : t),
    0
  );
  const daysSince = latestPush ? (now - latestPush) / DAY : 999;
  const freshness = clamp(1 - daysSince / 240, 0.15, 1);

  // push rhythm from recent public events (times shown in the viewer's zone)
  const pushes = events.filter((e) => e.type === "PushEvent");
  let nightFrac = 0.25; // neutral default when there's no event data
  if (pushes.length >= 5) {
    const night = pushes.filter((e) => {
      const h = new Date(e.created_at).getHours();
      return h >= 22 || h < 6;
    }).length;
    nightFrac = night / pushes.length;
  }

  const repoCount = user.public_repos;
  const langN = languages.length;

  const stats: TreeStats = {
    username: user.login,
    displayName: user.name,
    years: Math.round(years * 10) / 10,
    repoCount,
    stars,
    languages,
    nightOwl: nightFrac > 0.35,
    dormantRepos: dormant,
    recentPushes: pushes.length,
    followers: user.followers,
  };

  const palette =
    languages.length > 0
      ? languages.slice(0, 5).map(languageColor)
      : DEFAULT_PALETTE;

  return {
    seed: user.login,
    maxDepth: Math.round(
      clamp(5.2 + Math.log2(1 + years) * 0.9 + Math.min(repoCount, 80) / 40, 5, 9)
    ),
    trunkWidth: clamp(10 + years * 1.1 + pushes.length * 0.12, 10, 26),
    growthSpeed: clamp(0.75 + pushes.length / 60, 0.7, 1.5),
    branchiness: clamp(0.18 + langN * 0.09, 0.2, 0.9),
    angleSpread: clamp(0.35 + langN * 0.05, 0.38, 0.85),
    lean: clamp((nightFrac - 0.25) * 0.9, -0.35, 0.35),
    crookedness: clamp(0.15 + nightFrac * 1.1, 0.15, 1),
    blossomCount: stars > 0 ? clamp(Math.round(8 * Math.log10(1 + stars)), 2, 40) : 0,
    deadFraction: own.length ? clamp((dormant / own.length) * 0.7, 0, 0.45) : 0,
    freshness,
    palette,
    stats,
  };
}
