// Canvas renderer: grows the tree over a few seconds, then keeps it
// alive with an idle sway, twinkling stars and drifting fireflies.

import { Branch, generateTree, measureTree } from "./tree";
import { TreeParams } from "./params";
import { mulberry32, hashString, Rng } from "./rng";
import { hexToRgb, rgbStr, lighten } from "./color";

export const CANVAS_W = 960;
export const CANVAS_H = 680;

const GROW_MS = 4600;

interface Star {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
}

interface Firefly {
  cx: number;
  cy: number;
  ax: number;
  ay: number;
  s1: number;
  s2: number;
  p1: number;
  p2: number;
  phase: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// point on the branch's quadratic curve in branch-local coords
function curvePoint(b: Branch, u: number): [number, number] {
  const cpx = b.bend * b.length * 0.6;
  const cpy = -b.length * 0.5;
  const ex = b.bend * b.length;
  const ey = -b.length;
  const v = 1 - u;
  return [v * v * 0 + 2 * v * u * cpx + u * u * ex, 2 * v * u * cpy + u * u * ey];
}

export interface RendererOptions {
  onComplete?: () => void;
}

export class TreeRenderer {
  private ctx: CanvasRenderingContext2D;
  private tree: Branch;
  private raf = 0;
  private startTime = 0;
  private completed = false;
  private disposed = false;
  private stars: Star[] = [];
  private fireflies: Firefly[] = [];
  private barkColor: string;
  private deadColor = "rgba(110,112,120,0.9)";
  private glowColor: string;
  private treeScale = 1;
  private baseX = CANVAS_W / 2;
  private dpr = 1;
  // blossoms are queued during the tree pass and drawn on top, so leaves
  // can't bury them
  private blossomQueue: { x: number; y: number; s: number; b: Branch }[] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private params: TreeParams,
    private opts: RendererOptions = {}
  ) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d unavailable");
    ctx.scale(dpr, dpr);
    this.ctx = ctx;

    this.tree = generateTree(params);

    // fit any tree — sapling or nine-depth veteran — inside the frame
    const bounds = measureTree(this.tree);
    const availH = CANVAS_H - 72 - 46; // ground line to top margin
    const availW = CANVAS_W - 140;
    this.treeScale = Math.min(
      1.15,
      availH / Math.max(1, -bounds.minY),
      availW / Math.max(1, bounds.maxX - bounds.minX)
    );
    const centerShift = (this.treeScale * (bounds.minX + bounds.maxX)) / 2;
    this.baseX = CANVAS_W / 2 - Math.max(-90, Math.min(90, centerShift));

    this.barkColor = "#4a3728";
    this.glowColor = rgbStr(lighten(hexToRgb(params.palette[0]), 0.15), 0.07);

    // background props seeded separately so the sky is unique per user too
    const [bgSeed] = hashString(params.seed.toLowerCase() + "|sky");
    const rng = mulberry32(bgSeed);
    this.stars = this.makeStars(rng);
    this.fireflies = this.makeFireflies(rng);
  }

  private makeStars(rng: Rng): Star[] {
    const stars: Star[] = [];
    for (let i = 0; i < 110; i++) {
      stars.push({
        x: rng() * CANVAS_W,
        y: rng() * CANVAS_H * 0.75,
        r: 0.4 + rng() * 1.1,
        phase: rng() * Math.PI * 2,
        speed: 0.4 + rng() * 1.2,
      });
    }
    return stars;
  }

  private makeFireflies(rng: Rng): Firefly[] {
    const flies: Firefly[] = [];
    for (let i = 0; i < 8; i++) {
      flies.push({
        cx: CANVAS_W * (0.25 + rng() * 0.5),
        cy: CANVAS_H * (0.3 + rng() * 0.35),
        ax: 40 + rng() * 90,
        ay: 25 + rng() * 55,
        s1: 0.15 + rng() * 0.25,
        s2: 0.1 + rng() * 0.2,
        p1: rng() * Math.PI * 2,
        p2: rng() * Math.PI * 2,
        phase: rng() * Math.PI * 2,
      });
    }
    return flies;
  }

  begin() {
    this.startTime = performance.now();
    const loop = (now: number) => {
      if (this.disposed) return;
      this.drawFrame(now);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
  }

  toPNG(): string {
    return this.canvas.toDataURL("image/png");
  }

  private drawFrame(now: number) {
    const elapsed = now - this.startTime;
    const growT = clamp(
      (elapsed / GROW_MS) * this.params.growthSpeed,
      0,
      1.0001
    );
    const time = elapsed / 1000;
    const ctx = this.ctx;

    this.drawBackground(ctx, time);

    // tree
    const groundY = CANVAS_H - 72;
    ctx.save();
    ctx.translate(this.baseX, groundY);
    ctx.scale(this.treeScale, this.treeScale);
    this.blossomQueue.length = 0;
    this.drawBranch(ctx, this.tree, growT, time);
    ctx.restore();
    for (const q of this.blossomQueue) this.drawBlossom(ctx, q, time);

    this.drawGround(ctx, groundY);
    this.drawFireflies(ctx, time, growT);
    this.drawSignature(ctx);

    if (!this.completed && growT >= 1) {
      this.completed = true;
      this.opts.onComplete?.();
    }
  }

  private drawBackground(ctx: CanvasRenderingContext2D, time: number) {
    const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    g.addColorStop(0, "#070b18");
    g.addColorStop(0.65, "#0b1224");
    g.addColorStop(1, "#0e1526");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // stars
    for (const s of this.stars) {
      const a = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(time * s.speed + s.phase));
      ctx.globalAlpha = a;
      ctx.fillStyle = "#dfe7ff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // soft canopy glow in the dominant language color
    const glow = ctx.createRadialGradient(
      CANVAS_W / 2,
      CANVAS_H * 0.42,
      30,
      CANVAS_W / 2,
      CANVAS_H * 0.42,
      330
    );
    glow.addColorStop(0, this.glowColor);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  private drawGround(ctx: CanvasRenderingContext2D, groundY: number) {
    const g = ctx.createLinearGradient(0, groundY - 14, 0, CANVAS_H);
    g.addColorStop(0, "rgba(26,34,52,0)");
    g.addColorStop(0.3, "rgba(26,34,52,0.9)");
    g.addColorStop(1, "#131a2c");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(CANVAS_W / 2, groundY + 60, CANVAS_W * 0.55, 96, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawBranch(
    ctx: CanvasRenderingContext2D,
    b: Branch,
    growT: number,
    time: number
  ) {
    const p = clamp((growT - b.birth) / b.duration, 0, 1);
    if (p <= 0) return;
    const eased = easeOutCubic(p);

    const sway = Math.sin(time * 1.1 + b.swayPhase) * b.swayAmp;
    ctx.save();
    ctx.rotate(b.angle + sway);

    this.strokeBranch(ctx, b, eased);

    if (p >= 1) {
      this.drawLeaves(ctx, b, growT, time);
      const [ex, ey] = curvePoint(b, 1);
      if (b.blossom) {
        const m = ctx.getTransform();
        const pt = m.transformPoint(new DOMPoint(ex, ey));
        this.blossomQueue.push({
          x: pt.x / this.dpr,
          y: pt.y / this.dpr,
          s: Math.hypot(m.a, m.b) / this.dpr,
          b,
        });
      }
      ctx.translate(ex, ey);
      ctx.rotate(b.tipRot);
      for (const child of b.children) {
        this.drawBranch(ctx, child, growT, time);
      }
    }
    ctx.restore();
  }

  private strokeBranch(ctx: CanvasRenderingContext2D, b: Branch, p: number) {
    ctx.strokeStyle = b.dead ? this.deadColor : this.barkColor;
    ctx.lineCap = "round";

    if (b.width < 2.4) {
      // thin twigs: single stroke, no taper needed
      const [ex, ey] = curvePoint(b, p);
      const [cx, cy] = curvePoint(b, p * 0.5);
      ctx.lineWidth = (b.width + b.endWidth) / 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(cx, cy - (b.length * p) * 0.05, ex, ey);
      ctx.stroke();
      return;
    }

    // thick branches: sampled segments with tapering width
    const SEGS = 7;
    let [px, py] = [0, 0];
    for (let i = 1; i <= SEGS; i++) {
      const u = (i / SEGS) * p;
      const [x, y] = curvePoint(b, u);
      ctx.lineWidth = Math.max(0.8, b.width + (b.endWidth - b.width) * u);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.stroke();
      [px, py] = [x, y];
    }
  }

  private drawLeaves(
    ctx: CanvasRenderingContext2D,
    b: Branch,
    growT: number,
    time: number
  ) {
    const done = b.birth + b.duration;
    for (const leaf of b.leaves) {
      const lp = clamp((growT - done - leaf.appear * 0.04) / 0.06, 0, 1);
      if (lp <= 0) continue;
      const scale = easeOutCubic(lp);
      const [x, y] = curvePoint(b, leaf.t);
      const w = b.width + (b.endWidth - b.width) * leaf.t;
      const flutter = Math.sin(time * 1.8 + leaf.offAngle * 7) * 0.08;
      ctx.save();
      ctx.translate(x + leaf.side * (w / 2 + leaf.size * 0.35), y);
      ctx.rotate(leaf.offAngle + flutter);
      ctx.scale(scale, scale);
      ctx.fillStyle = leaf.color;
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      ctx.ellipse(0, 0, leaf.size, leaf.size * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private drawBlossom(
    ctx: CanvasRenderingContext2D,
    q: { x: number; y: number; s: number; b: Branch },
    time: number
  ) {
    const bl = q.b.blossom!;
    const pulse = 1 + 0.18 * Math.sin(time * 2 + bl.phase);
    ctx.save();
    ctx.translate(q.x, q.y);
    ctx.shadowBlur = 14;
    ctx.shadowColor = bl.glow;
    ctx.fillStyle = bl.color;
    ctx.beginPath();
    ctx.arc(0, 0, bl.size * q.s * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawFireflies(
    ctx: CanvasRenderingContext2D,
    time: number,
    growT: number
  ) {
    if (growT < 0.6) return;
    const fade = clamp((growT - 0.6) / 0.4, 0, 1);
    for (const f of this.fireflies) {
      const x = f.cx + Math.sin(time * f.s1 + f.p1) * f.ax;
      const y = f.cy + Math.sin(time * f.s2 + f.p2) * f.ay;
      const a = fade * (0.25 + 0.55 * (0.5 + 0.5 * Math.sin(time * 1.4 + f.phase)));
      ctx.save();
      ctx.globalAlpha = a;
      ctx.shadowBlur = 10;
      ctx.shadowColor = "rgba(255,231,150,0.9)";
      ctx.fillStyle = "#ffe796";
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private drawSignature(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillStyle = "rgba(210,220,240,0.4)";
    ctx.textAlign = "left";
    ctx.fillText("overgrowth", 20, CANVAS_H - 18);
    ctx.textAlign = "right";
    ctx.fillText(`@${this.params.stats.username}`, CANVAS_W - 20, CANVAS_H - 18);
    ctx.restore();
  }
}
