import type { NextConfig } from "next";

// PAGES_BASE is set when building for GitHub Pages (project subpath);
// empty for local dev and Vercel.
const nextConfig: NextConfig = {
  output: "export",
  basePath: process.env.PAGES_BASE ?? "",
  images: { unoptimized: true },
};

export default nextConfig;
