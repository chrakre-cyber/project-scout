import type { NextConfig } from "next";
import { LEGACY_ROUTES_FLAG, legacyRedirects } from "./src/lib/legacy-routes";

const nextConfig: NextConfig = {
  // Ingen eksterne bildekilder i demo: bilbilder er lokale SVG-placeholdere.
  images: { remotePatterns: [] },
  poweredByHeader: false,
  // `next dev` skal ikke legge inn egne regler i AGENTS.md/CLAUDE.md; instruksjonsfilene eies av repoet.
  agentRules: false,
  // DEV-006G: eldre Project Scout-ruter er blokkert (→ /login) med mindre SCOUT_ENABLE_LEGACY_ROUTES=1 er satt ved bygging.
  redirects: async () => legacyRedirects(process.env[LEGACY_ROUTES_FLAG]),
};

export default nextConfig;
