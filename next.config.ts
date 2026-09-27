import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the vendored protocol's Node-compatible .js imports byte-for-byte.
  // Prefer existing JavaScript; resolve TypeScript when that file is absent.
  webpack(config) {
    config.resolve.extensionAlias = { ...config.resolve.extensionAlias, ".js": [".js", ".ts"] };
    return config;
  },
};

export default nextConfig;
