import type { NextConfig } from "next";
import { appContentSecurityPolicy, PREVIEW_DEV_ORIGINS } from "./src/server/web-preview";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["better-sqlite3", "pg", "ioredis", "pdf-parse", "mammoth"],
  poweredByHeader: false,
  allowedDevOrigins: PREVIEW_DEV_ORIGINS,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: appContentSecurityPolicy() },
        ],
      },
    ];
  },
};

export default nextConfig;
