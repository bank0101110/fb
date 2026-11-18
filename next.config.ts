import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Image uploads go through a server action; Vercel functions accept up to ~4.5 MB.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
