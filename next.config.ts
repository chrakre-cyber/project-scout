import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ingen eksterne bildekilder i demo: bilbilder er lokale SVG-placeholdere.
  images: { remotePatterns: [] },
  poweredByHeader: false,
};

export default nextConfig;
