import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/visualizer',
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
