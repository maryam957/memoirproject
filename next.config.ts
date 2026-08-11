import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Next 16 writes AGENTS.md and CLAUDE.md into the repo root on dev. The
  // flow specification and README carry that context here.
  agentRules: false,
};

export default nextConfig;
