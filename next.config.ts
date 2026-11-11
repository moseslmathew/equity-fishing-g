import path from "node:path";
import type { NextConfig } from "next";

const isVinextRuntime =
  process.env.EQUITY_FISHING_RUNTIME === "vinext" ||
  Boolean(process.env.CLOUDFLARE_CF_FETCH_ENABLED || process.env.WRANGLER_LOG_PATH) ||
  process.argv.some((arg) => arg.includes("vinext") || arg.includes("vite"));

const nextConfig: NextConfig = isVinextRuntime
  ? {}
  : {
      turbopack: {
        resolveAlias: {
          "cloudflare:workers": "./lib/cloudflare-workers-shim.ts",
        },
      },
      webpack: (config) => {
        config.resolve.alias = {
          ...config.resolve.alias,
          "cloudflare:workers": path.join(process.cwd(), "lib", "cloudflare-workers-shim.ts"),
        };
        return config;
      },
    };

export default nextConfig;
