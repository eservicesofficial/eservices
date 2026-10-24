import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "standalone",
  typescript: { ignoreBuildErrors: true },
  reactStrictMode: false,
  allowedDevOrigins: ["*.space-z.ai","*.space.z.ai","21.0.3.116","21.0.5.137","21.0.16.227","21.0.22.135","127.0.0.1","localhost","0.0.0.0"],
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  async headers() {
    return [
      { source: "/(.*)", headers: [
        { key: "Access-Control-Allow-Origin", value: "*" },
        { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
        { key: "Access-Control-Allow-Headers", value: "X-Requested-With, Content-Type, Authorization" },
      ]},
    ];
  },
};
export default nextConfig;
