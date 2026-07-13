"use client";

import { useEffect, useRef } from "react";

type Fly = {
  x: number;
  y: number;
  s: number; // sprite size px
  a: number; // heading
  v: number; // px/sec
  t: number; // blink phase
  ft: number; // blink rate
};

// a warm gold glow matching the tree's in-canvas fireflies and the lantern
function makeSprite(): HTMLCanvasElement {
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 64;
  const sctx = sprite.getContext("2d")!;
  const g = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255, 244, 214, 0.95)");
  g.addColorStop(0.25, "rgba(255, 231, 150, 0.5)");
  g.addColorStop(1, "rgba(255, 231, 150, 0)");
  sctx.fillStyle = g;
  sctx.fillRect(0, 0, 64, 64);
  return sprite;
}

export default function Background() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const sprite = makeSprite();
    let w = 0;
    let h = 0;
    let flies: Fly[] = [];
    let raf = 0;
    let last = performance.now();

    const spawn = (): Fly => ({
      x: Math.random() * w,
      y: Math.random() * h,
      // mostly small, a couple of large ones for depth
      s: Math.random() < 0.06 ? 13 + Math.random() * 4 : 5 + Math.random() * 8,
      a: Math.random() * Math.PI * 2,
      v: 5 + Math.random() * 9,
      t: Math.random() * Math.PI * 2,
      ft: 0.5 + Math.random() * 1.2,
    });

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 1.5); // battery cap
      w = innerWidth;
      h = innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      flies = Array.from({ length: Math.min(70, Math.round((w * h) / 26000)) }, spawn);
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); // 120Hz-safe
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (const f of flies) {
        f.a += (Math.random() - 0.5) * 0.8 * dt; // gentle wander
        f.x += Math.cos(f.a) * f.v * dt;
        f.y += Math.sin(f.a) * f.v * dt - 1.5 * dt; // faint upward drift
        if (f.x < -20) f.x = w + 20;
        if (f.x > w + 20) f.x = -20;
        if (f.y < -20) f.y = h + 20;
        if (f.y > h + 20) f.y = -20;
        f.t += f.ft * dt * Math.PI;
        const pulse = Math.pow(0.5 + 0.5 * Math.sin(f.t), 3); // asymmetric blink
        ctx.globalAlpha = 0.15 + 0.75 * pulse;
        ctx.drawImage(sprite, f.x - f.s / 2, f.y - f.s / 2, f.s, f.s);
      }
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (!raf && !reduced.matches && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    const onReduced = () => {
      if (reduced.matches) {
        stop();
        ctx.clearRect(0, 0, w, h);
      } else {
        start();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    reduced.addEventListener("change", onReduced);
    addEventListener("resize", resize);
    resize();
    start();

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      reduced.removeEventListener("change", onReduced);
      removeEventListener("resize", resize);
    };
  }, []);

  return (
    <>
      <div className="sky-base" aria-hidden="true" />
      <div className="aurora-b" aria-hidden="true" />
      <canvas ref={canvasRef} className="fireflies" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
    </>
  );
}
