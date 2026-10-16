/**
 * Isolasjon av de eldre Project Scout-rutene fra partnerdemoen (DEV-006G). Rent regelsett uten I/O; leser ikke miljøet selv.
 *
 * Sikker som standard: gamle ruter er BLOKKERT med mindre `SCOUT_ENABLE_LEGACY_ROUTES` er nøyaktig `"1"`. Manglende, tom eller
 * annen verdi gir blokkering. Blokkerte ruter omdirigeres (midlertidig, 307) til `/login`; innlogget bruker sendes derfra videre
 * til `/searches` av den eksisterende regelen i `/login`. Ingen sesjonslogikk her.
 * Variabelen leses ved bygging (redirects ligger i routes-manifestet), ikke ved kjøring.
 */
export const LEGACY_ROUTES_FLAG = "SCOUT_ENABLE_LEGACY_ROUTES";

/** Stier som tilhører den eldre flaten. `/agents/:path*` dekker også `/agents` selv. */
export const LEGACY_SOURCES = ["/dashboard", "/agents/:path*", "/opportunities/:path*"] as const;

export function legacyRoutesEnabled(flagValue: string | undefined): boolean {
  return flagValue === "1";
}

export interface LegacyRedirect { source: string; destination: string; permanent: false }

export function legacyRedirects(flagValue: string | undefined): LegacyRedirect[] {
  if (legacyRoutesEnabled(flagValue)) return [];
  return LEGACY_SOURCES.map((source) => ({ source, destination: "/login", permanent: false as const }));
}
