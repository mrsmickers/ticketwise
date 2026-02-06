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
          {
            key: "X-Frame-Options",
            value: "ALLOWALL",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
