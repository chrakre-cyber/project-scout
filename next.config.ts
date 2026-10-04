import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ingen eksterne bildekilder i demo: bilbilder er lokale SVG-placeholdere.
  images: { remotePatterns: [] },
  poweredByHeader: false,
  // `next dev` skal ikke legge inn egne regler i AGENTS.md/CLAUDE.md; instruksjonsfilene eies av repoet.
  agentRules: false,
};

export default nextConfig;
