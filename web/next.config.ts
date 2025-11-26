import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/qr_shapes",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
