/**
 * Råformat for SYNTETISKE kildeposter.
 *
 * Dette er et internt testformat som Project Scout har funnet på for å øve
 * normalisering (andre feltnavn, desimalstrenger, kodeverdier, datoer med
 * ulik presisjon). Det er IKKE mobile.de-format og ikke basert på
 * mobile.de-responser. Mapping mot et ekte kildeformat lages i DEV-006.
 *
 * Alle felt utenom id er valgfrie eller nullable fordi ekte kilder også kan
 * mangle dem; normaliseringen avgjør hva som er gyldig.
 */
export interface SyntheticRawListing {
  id: string;
  /** Kildens endringstidspunkt (ISO 8601), eller null. Flere poster med samme id = revisjoner. */
  modifiedAt: string | null;
  /** Syntetisk observasjonshistorikk i Scout. Ekte kilder leverer ikke dette (DEV-005). */
  observed: { firstSeenAt: string; lastSeenAt: string };
  price?: {
    /** Desimalstreng med punktum, f.eks. "32490" eller "32490.50". */
    amount: string;
    /** ISO 4217-kode slik kilden oppgir den. */
    currency: string;
    /** Kildens prisgrunnlag. null/udefinert = ikke oppgitt. */
    type?: "GROSS" | "NET" | null;
    /** Ordrett belegg for prisgrunnlaget. Uten belegg blir grunnlaget "unknown". */
    typeEvidence?: string | null;
    vat?: {
      /** Oppgitt sats som desimalstreng i prosent, f.eks. "19" eller "8.1". */
      rate?: string | null;
      /** Påstand om at mva. kan trekkes fra. null = ikke oppgitt. */
      reclaimable?: boolean | null;
      evidence?: string[];
      origin?: "FIELD" | "TEXT" | null;
    } | null;
  } | null;
  vehicle: {
    make?: string | null;
    model?: string | null;
    variant?: string | null;
    /** "YYYY", "YYYY-MM" eller "YYYY-MM-DD". Presisjonen bevares. */
    firstRegistration?: string | null;
    mileage?: { value: number; unit: "KM" | "MI" } | null;
    /** Kodeverdi, f.eks. "PETROL". Ukjent kode blir null, ikke gjettet. */
    fuel?: string | null;
    gearbox?: string | null;
    body?: string | null;
    powerKw?: number | null;
    co2?: { gramsPerKm: number; method: string | null } | null;
    weightKg?: number | null;
    color?: string | null;
  };
  description?: string | null;
  seller?: { type?: "DEALER" | "PRIVATE" | null; country?: string | null; city?: string | null } | null;
}
