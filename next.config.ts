import type { NextConfig } from "next";

// Two deploy targets from one codebase:
// - default (dev/Vercel): full app with /api/poem and /api/voice
// - PAGES_BASE set (GitHub Pages): static export at a subpath; the deploy
//   script removes app/api first since route handlers can't be exported
const forPages = Boolean(process.env.PAGES_BASE);

const nextConfig: NextConfig = {
  ...(forPages && { output: "export" as const, basePath: process.env.PAGES_BASE }),
  images: { unoptimized: true },
};

export default nextConfig;
