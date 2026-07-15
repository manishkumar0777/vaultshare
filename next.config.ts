import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true, // We'll handle encryption/decryption ourselves
  },
};

export default nextConfig;