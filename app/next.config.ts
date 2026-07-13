import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === 'development'

const nextConfig: NextConfig = {
  // Development needs a regular server so rewrites can proxy artifact data to
  // the static CLI server. The static export is only used for production builds.
  output: isDev ? undefined : 'export',
  // The renderer is served from the URL root both locally and on Cloudflare.
  basePath: '',
  trailingSlash: true,
  images: { unoptimized: true },
  allowedDevOrigins: ['127.0.0.1', 'localhost', 'iurys-macbook-pro.taila5dafe.ts.net'],
  transpilePackages: ['@agents/visual-artifact-annotations'],
  async rewrites() {
    if (!isDev) return []
    // Proxy artifact data and annotation API requests to the static CLI server
    // so `pnpm dev` can render real artifacts and save comments while keeping
    // HMR/live mode.
    return [
      {
        source: '/data/artifacts/:path*',
        destination: 'http://localhost:9998/data/artifacts/:path*',
      },
      {
        source: '/api/annotations/:path*',
        destination: 'http://localhost:9998/api/annotations/:path*',
      },
    ]
  },
};

export default nextConfig;
