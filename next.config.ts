import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    viewTransition: true,
  },
  serverExternalPackages: ["pino", "pino-pretty"],
};

export default nextConfig;
