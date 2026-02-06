import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Output standalone for Docker
  output: "standalone",
  
  // Allow embedding in ConnectWise iframe
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Explicitly unset X-Frame-Options (Next.js may add sameorigin by default)
          // CSP frame-ancestors supersedes X-Frame-Options
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *",
          },
        ],
      },
    ];
  },
  
  // Disable Next.js default security headers that conflict with iframe embedding
  poweredByHeader: false,
};

export default nextConfig;
