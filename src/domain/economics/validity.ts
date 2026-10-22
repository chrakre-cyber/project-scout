/**
 * Dokumentert gyldighetsperiode for økonomiprofilens 2026-regler (ECON-004 B1). Ren domenekode.
 * Stortingets mva.-vedtak gjelder «Budsjettåret 2026» (T76/T77/T80), elbilgrensen 300 000 kr er dokumentert fra 1.1.2026 (T71/T63; 2027 er et varsel, T75, ikke vedtatt) og
 * Tolltariffen 2026 er «gjeldende fra 1. januar 2026» (T83). Akseptdato utenfor perioden er derfor utenfor det kildene dokumenterer: beløp som avhenger av disse reglene
 * er IKKE beregnet (ikke et estimat og ikke en nedre grense for det aktuelle året).
 * Dette godkjenner ikke tollkursregimet: kursreglene i vareførselsforskriften § 6-12-1 trådte i kraft 3.9.2026 (T65/T69); regimet før det er bare lest i veiledning (T53).
 */
export const DOCUMENTED_RULE_PERIOD = { fromIso: "2026-01-01", toIso: "2026-12-31", label: "2026" } as const;
/** Første dato for det dokumenterte kursregimet (T65/T69). Brukes bare til varsel; er ikke en gyldighetsgrense. */
export const CUSTOMS_FX_REGIME_FROM_ISO = "2026-09-03";

/** ISO-datoer (YYYY-MM-DD) sammenlignes leksikografisk. */
export const isWithinDocumentedPeriod = (dateIso: string): boolean => dateIso >= DOCUMENTED_RULE_PERIOD.fromIso && dateIso <= DOCUMENTED_RULE_PERIOD.toIso;
