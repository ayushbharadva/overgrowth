// Canvas renderer: grows the tree over a few seconds, then keeps it
// alive with an idle sway, twinkling stars and drifting fireflies.

import { Branch, generateTree, measureTree } from "./tree";
import { TreeParams } from "./params";
import { mulberry32, hashString, Rng } from "./rng";
import { hexToRgb, rgbStr, lighten, mix } from "./color";

export const CANVAS_W = 960;
export const CANVAS_H = 680;

const GROW_MS = 4600;
// the wanderer: walks in when the poem arrives, then speaks it
const WALK_MS = 2600;
const TYPE_CPS = 26; // speech-bubble typewriter speed, chars/second

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
  private barkByDepth: string[];
  private speech: { lines: string[]; start: number } | null = null;
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

    // bark lightens toward the twigs — cheap depth cue that keeps the
    // canopy from reading as a flat diagram
    const barkBase = hexToRgb("#4a3728");
    const barkTip = hexToRgb("#7a5f45");
    this.barkByDepth = Array.from({ length: 10 }, (_, d) =>
      rgbStr(mix(barkBase, barkTip, Math.min(1, d / 8)))
    );
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

  // the poem arrived: a wanderer walks in from the left, stops under the
  // tree and delivers it in a speech bubble
  setSpeech(lines: string[]) {
    this.speech = { lines, start: performance.now() };
  }

  // exports the tree; when reading lines are passed, they're baked into a
  // band below the frame so the shared image carries its own story
  toPNG(reading?: string[]): string {
    if (!reading?.length) return this.canvas.toDataURL("image/png");
    const dpr = this.dpr;
    const pad = 36;
    const lh = 30;
    const extra = pad * 2 + lh * reading.length;
    const out = document.createElement("canvas");
    out.width = CANVAS_W * dpr;
    out.height = (CANVAS_H + extra) * dpr;
    const ctx = out.getContext("2d")!;
    ctx.scale(dpr, dpr);
    // continue the sky's bottom color so the band reads as one image
    ctx.fillStyle = "#0e1526";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H + extra);
    ctx.drawImage(
      this.canvas,
      0,
      0,
      this.canvas.width,
      this.canvas.height,
      0,
      0,
      CANVAS_W,
      CANVAS_H
    );
    ctx.font = "italic 17px Georgia, 'Times New Roman', serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#c5cfe6";
    reading.forEach((line, i) =>
      ctx.fillText(line, CANVAS_W / 2, CANVAS_H + pad + i * lh, CANVAS_W - 90)
    );
    return out.toDataURL("image/png");
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
    if (this.speech) this.drawWanderer(ctx, now, groundY);
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
    ctx.strokeStyle = b.dead
      ? this.deadColor
      : this.barkByDepth[Math.min(b.depth, 9)];
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

  private drawWanderer(
    ctx: CanvasRenderingContext2D,
    now: number,
    groundY: number
  ) {
    const speech = this.speech!;
    const fy = groundY + 16; // feet rest on the ground mound
    const stopX = Math.max(80, this.baseX - 170);
    const t = clamp((now - speech.start) / WALK_MS, 0, 1);
    const ease = t * t * (3 - 2 * t);
    const x = -34 + (stopX + 34) * ease;
    const walking = t < 1;
    const time = now / 1000;
    const step = walking ? Math.sin(time * 11) : 0;
    const bob = walking
      ? Math.abs(Math.cos(time * 11)) * 1.6
      : Math.sin(time * 1.6) * 0.8; // gentle idle breathing once stopped

    ctx.save();
    // pool of lantern light around them
    const glow = ctx.createRadialGradient(x, fy - 14, 2, x, fy - 14, 46);
    glow.addColorStop(0, "rgba(255,214,140,0.20)");
    glow.addColorStop(1, "rgba(255,214,140,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - 50, fy - 62, 100, 100);

    const hipY = fy - 15 - bob;
    const shY = fy - 29 - bob;
    const headY = fy - 36 - bob;
    ctx.strokeStyle = "#39466b";
    ctx.lineCap = "round";
    // legs
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(x, hipY);
    ctx.lineTo(x + step * 7 + 2, fy);
    ctx.moveTo(x, hipY);
    ctx.lineTo(x - step * 7 - 2, fy);
    ctx.stroke();
    // body
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x, hipY);
    ctx.lineTo(x, shY);
    ctx.stroke();
    // arm reaching forward with the lantern
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, shY + 3);
    ctx.lineTo(x + 9, shY + 9);
    ctx.stroke();
    // head
    ctx.fillStyle = "#39466b";
    ctx.beginPath();
    ctx.arc(x + 1, headY, 5.2, 0, Math.PI * 2);
    ctx.fill();
    // lantern
    const lx = x + 10;
    const ly = shY + 13;
    ctx.strokeStyle = "rgba(255,214,140,0.7)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x + 9, shY + 9);
    ctx.lineTo(lx, ly - 4);
    ctx.stroke();
    ctx.shadowBlur = 12;
    ctx.shadowColor = "rgba(255,214,140,0.95)";
    ctx.fillStyle = "#ffd98a";
    ctx.beginPath();
    ctx.arc(lx, ly, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (walking) return;
    const sinceStop = (now - speech.start - WALK_MS) / 1000;
    if (sinceStop <= 0) return;
    const full = speech.lines.join("\n");
    const shown = full.slice(0, Math.floor(sinceStop * TYPE_CPS));
    if (shown) this.drawBubble(ctx, shown, x, headY - 10);
  }

  private drawBubble(
    ctx: CanvasRenderingContext2D,
    text: string,
    ax: number,
    bottomY: number
  ) {
    ctx.save();
    ctx.font = 'italic 13.5px Georgia, "Times New Roman", serif';
    // wrap each poem line to the bubble width
    const lines: string[] = [];
    for (const raw of text.split("\n")) {
      let cur = "";
      for (const word of raw.split(" ")) {
        const cand = cur ? `${cur} ${word}` : word;
        if (cur && ctx.measureText(cand).width > 250) {
          lines.push(cur);
          cur = word;
        } else {
          cur = cand;
        }
      }
      lines.push(cur);
    }
    const lh = 19;
    const padX = 14;
    const padY = 11;
    const w =
      Math.max(...lines.map((l) => ctx.measureText(l).width), 40) + padX * 2;
    const h = lines.length * lh + padY * 2;
    const bx = clamp(ax - 20, 12, CANVAS_W - w - 12);
    const by = bottomY - h - 12;

    ctx.fillStyle = "rgba(11,17,33,0.92)";
    ctx.strokeStyle = "rgba(197,207,230,0.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(bx, by, w, h, 10);
    ctx.fill();
    ctx.stroke();
    // tail down to the wanderer
    ctx.beginPath();
    ctx.moveTo(ax + 2, bottomY - 2);
    ctx.lineTo(ax - 6, by + h - 1);
    ctx.lineTo(ax + 14, by + h - 1);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#d7e0f4";
    ctx.textAlign = "left";
    lines.forEach((l, i) =>
      ctx.fillText(l, bx + padX, by + padY + 14 + i * lh)
    );
    ctx.restore();
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
