import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The demo-snapshot provider reads these at runtime; make sure serverless
  // bundles include them.
  outputFileTracingIncludes: {
    "/**": ["./data/fixtures/**/*"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
