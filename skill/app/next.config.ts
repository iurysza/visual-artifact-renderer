import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/artifacts',
  trailingSlash: true,
  images: { unoptimized: true },
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  transpilePackages: ['@agents/visual-artifact-annotations'],
};

export default nextConfig;
