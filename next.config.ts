import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  experimental: {
    viewTransition: true,
  },
  serverExternalPackages: ["pino", "pino-pretty"],
  images: {
    localPatterns: [
      {
        pathname: "/api/thumbnails/**",
        search: "?size=*",
      },
    ],
  },
};

export default nextConfig;
