import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Output standalone for Docker (Nixpacks requires this)
  output: "standalone",
  
  // Allow embedding in ConnectWise iframe
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Remove X-Frame-Options to allow iframe embedding in ConnectWise
          {
            key: "X-Frame-Options",
            value: "ALLOWALL",
          },
          // CSP frame-ancestors as the modern replacement
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
