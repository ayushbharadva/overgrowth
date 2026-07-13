// Grows the tree skeleton as pure data. Rendering happens in render.ts.
// Every branch stores its angle relative to its parent's tip direction,
// so the renderer can sway the whole canopy hierarchically with nested
// canvas transforms.

import { TreeParams } from "./params";
import { Rng, rngFromString } from "./rng";
import { hexToRgb, mix, lighten, darken, rgbStr } from "./color";

export interface Leaf {
  t: number; // position along the branch curve, 0..1
  offAngle: number; // leaf rotation
  side: number; // -1 | 1, which side of the branch
  size: number;
  color: string;
  appear: number; // extra delay after branch finishes, 0..1
}

export interface Blossom {
  size: number;
  phase: number; // pulse phase
  color: string;
  glow: string;
}

export interface Branch {
  angle: number; // relative to parent tip direction
  length: number;
  width: number; // base width
  endWidth: number;
  bend: number; // perpendicular curve offset as fraction of length
  tipRot: number; // rotation of tip tangent relative to branch base axis
  depth: number;
  birth: number; // normalized 0..1 growth start
  duration: number; // normalized growth duration
  dead: boolean;
  swayPhase: number;
  swayAmp: number;
  children: Branch[];
  leaves: Leaf[];
  blossom?: Blossom;
}

const BROWN_LEAF: [number, number, number] = [138, 106, 60];

export interface TreeBounds {
  minX: number;
  maxX: number;
  minY: number; // topmost point (negative = above the root)
}

// world-space extent of the skeleton (ignoring sway), so the renderer
// can scale any tree to fit the canvas
export function measureTree(root: Branch): TreeBounds {
  const bounds: TreeBounds = { minX: 0, maxX: 0, minY: 0 };
  function walk(b: Branch, x: number, y: number, rot: number) {
    const r = rot + b.angle;
    const ex = b.bend * b.length;
    const ey = -b.length;
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    const wx = x + ex * cos - ey * sin;
    const wy = y + ex * sin + ey * cos;
    const pad = b.leaves.length ? 14 : 4;
    bounds.minX = Math.min(bounds.minX, wx - pad);
    bounds.maxX = Math.max(bounds.maxX, wx + pad);
    bounds.minY = Math.min(bounds.minY, wy - pad);
    for (const c of b.children) walk(c, wx, wy, r + b.tipRot);
  }
  walk(root, 0, 0, 0);
  return bounds;
}

export function generateTree(params: TreeParams): Branch {
  const rng: Rng = rngFromString(params.seed);
  // dark language colors (C #555, Lua navy…) would read as a dead canopy;
  // lift them to a leaf-worthy lightness while keeping the hue
  const leafPalette = params.palette.map((hex) => {
    const c = hexToRgb(hex);
    const lum = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
    return lum < 0.34 ? lighten(c, (0.34 - lum) * 1.7) : c;
  });
  const terminals: Branch[] = [];
  let branchCount = 0;
  const MAX_BRANCHES = 2600;

  const depthDur = 0.92 / (params.maxDepth + 1);

  function makeLeaves(b: Branch, count: number) {
    for (let i = 0; i < count; i++) {
      // dominant language claims about half the canopy; rest share it
      const idx =
        rng() < 0.5 ? 0 : 1 + Math.floor(rng() * Math.max(1, leafPalette.length - 1));
      let c = leafPalette[Math.min(idx, leafPalette.length - 1)];
      // fresher accounts get vivid leaves; dormant ones fade toward brown
      const fade = (1 - params.freshness) * (0.35 + rng() * 0.65);
      c = mix(c, BROWN_LEAF, fade);
      // natural per-leaf variation
      c = rng() < 0.5 ? lighten(c, rng() * 0.18) : darken(c, rng() * 0.15);
      b.leaves.push({
        t: 0.45 + rng() * 0.55,
        offAngle: (rng() - 0.5) * Math.PI,
        side: rng() < 0.5 ? -1 : 1,
        size: 4.5 + rng() * 6,
        color: rgbStr(c),
        appear: rng(),
      });
    }
  }

  function grow(
    depth: number,
    length: number,
    width: number,
    birth: number,
    dead: boolean,
    angle: number,
    heading: number // cumulative angle from vertical
  ): Branch {
    branchCount++;
    // trunk bend stays capped — high-crookedness (night-owl) trees
    // otherwise fold their longest branch clean over
    let bend =
      (rng() - 0.5) * params.crookedness * 0.9 + params.lean * 0.25;
    if (depth === 0) bend = Math.max(-0.14, Math.min(0.14, bend));
    const b: Branch = {
      angle,
      length,
      width,
      endWidth: width * 0.62,
      bend,
      // tip tangent of the quadratic curve, so children continue smoothly
      tipRot: Math.atan2(bend * length * 0.4, length * 0.5),
      depth,
      birth,
      duration: depthDur * (0.85 + rng() * 0.3),
      dead,
      swayPhase: rng() * Math.PI * 2,
      swayAmp: 0.0025 + depth * 0.0035,
      children: [],
      leaves: [],
    };

    const canopy = depth >= params.maxDepth - 2;
    if (!dead && depth >= params.maxDepth - 3) {
      const count =
        depth >= params.maxDepth - 1
          ? 5 + Math.floor(rng() * 3)
          : depth >= params.maxDepth - 2
          ? 3
          : rng() < 0.6
          ? 2
          : 0;
      if (count) makeLeaves(b, count);
    }

    const terminal =
      depth >= params.maxDepth || width < 1.1 || branchCount > MAX_BRANCHES;
    if (terminal) {
      terminals.push(b);
      return b;
    }

    // how many children this branch splits into
    let n: number;
    if (depth === 0) {
      n = 1; // trunk continues once before the crown starts splitting
    } else {
      n = 2;
      if (rng() < params.branchiness) n++;
      if (dead && n > 2) n = 2;
      // deep canopy thins out so the tree stays performant and airy
      if (depth >= params.maxDepth - 1 && rng() < 0.35) n = 1;
    }

    const spread = params.angleSpread * (depth === 1 ? 0.85 : 1);
    for (let i = 0; i < n; i++) {
      // fan children across the spread, jittered
      let childAngle: number;
      if (n === 1) {
        childAngle = (rng() - 0.5) * spread * 0.5;
      } else {
        const f = i / (n - 1) - 0.5; // -0.5..0.5
        childAngle = f * spread * 2 + (rng() - 0.5) * spread * 0.5;
      }
      // night-owl lean pulls every branch the same way, but damped with
      // depth so deep trees bend instead of curling into ferns
      childAngle += (params.lean * 0.9) / (1 + depth * 0.6);
      // crookedness adds individual wobble
      childAngle += (rng() - 0.5) * params.crookedness * 0.45;
      // negative gravitropism: branches spring back toward the sky instead
      // of curling into drooping tendrils
      childAngle -= heading * 0.16;
      // the lower structure stays grounded — night-owl lean + wobble can
      // otherwise kink the leader 40° right at the first split
      if (depth <= 1) childAngle = Math.max(-0.3, Math.min(0.3, childAngle));
      if (Math.abs(heading + childAngle) > 1.7) {
        childAngle = (1.7 * Math.sign(heading + childAngle) - heading) * 0.85;
      }

      // wide length jitter keeps terminals from all reaching the same
      // radius, which reads as an umbrella shell instead of a canopy
      const childLen =
        length *
        (depth === 0 ? 0.85 : 0.66 + rng() * 0.24) *
        (n === 3 ? 0.94 : 1);
      const childWidth = Math.max(0.8, width * (0.58 + rng() * 0.12));
      // some subtrees died with the repos that fed them
      const childDead =
        dead || (depth >= 1 && !canopy && rng() < params.deadFraction * 0.28);
      const childBirth = birth + b.duration * (1.0 + rng() * 0.12);
      b.children.push(
        grow(
          depth + 1,
          childLen,
          childWidth,
          childBirth,
          childDead,
          childAngle,
          heading + childAngle
        )
      );
    }
    return b;
  }

  const trunk = grow(
    0,
    64 + params.maxDepth * 6,
    params.trunkWidth,
    0,
    false,
    params.lean * 0.5,
    params.lean * 0.5
  );

  // stars become blossoms on living branch tips
  const live = terminals.filter((t) => !t.dead);
  // deterministic shuffle
  for (let i = live.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [live[i], live[j]] = [live[j], live[i]];
  }
  const nBlossoms = Math.min(params.blossomCount, Math.floor(live.length * 0.35));
  const blossomBase = hexToRgb(params.palette[0]);
  for (let i = 0; i < nBlossoms; i++) {
    const warm = mix(lighten(blossomBase, 0.55), [255, 214, 145], 0.45);
    live[i].blossom = {
      size: 2.6 + rng() * 2.4,
      phase: rng() * Math.PI * 2,
      color: rgbStr(warm),
      glow: rgbStr(lighten(blossomBase, 0.3), 0.9),
    };
  }

  return trunk;
}
