import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "3000-is57m1uw4xw4rk1vwpzez.e2b.app",
    "*.e2b.app",
    "localhost",
    "127.0.0.1",
    "myailab.netlify.app",
    "*.netlify.app"
  ],
  images: {
    unoptimized: true,
  },
  // Remove standalone output for Netlify - let plugin handle it
};

export default nextConfig;
