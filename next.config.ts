import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/artifacts',
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
